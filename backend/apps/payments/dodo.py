"""The provider's wire format, and nothing else.

No webhooks: a read settles a purchase, and a read only happens because
somebody arrived on a page. The cost is a buyer who closes the tab, whose
row stays pending until the link in their receipt brings them back.
Reading is idempotent, so coming back once or fifty times is the same.
"""

import datetime as dt
import json
import logging
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field

from django.conf import settings

logger = logging.getLogger(__name__)

TIMEOUT = 20
USER_AGENT = "impromptu.talk (+https://impromptu.talk)"

# The provider's own vocabulary, kept verbatim rather than translated at
# the edge: a status nobody has seen before should read strangely in a log
# rather than quietly becoming "failed".
SUCCEEDED = "succeeded"
DEAD = ("failed", "cancelled")

# Their subscription words, same rule. `ACTIVE` is the only one that
# grants anything; `OVER` is the set that will never grant again, and is
# what stops a dead subscription being re-read forever. Anything else, an
# `on_hold` or a word they add next year, is neither, which means "ask
# again later" and is the right answer to a renewal still in flight.
SUBSCRIPTION_ACTIVE = "active"
SUBSCRIPTION_OVER = ("cancelled", "expired", "failed")


class DodoError(Exception):
    """The provider refused, or could not be reached. Never means "not
    paid": a purchase that cannot be read is a purchase nobody knows
    about yet, and the caller leaves the row where it is."""


@dataclass(frozen=True)
class Checkout:
    session_id: str
    url: str


@dataclass(frozen=True)
class Payment:
    """A payment as the provider sees it.

    `reference` and `session_id` are what tie it back to one of our rows;
    without both, it is somebody else's payment and worth nothing here.

    `subscription_id` is set when what was paid for renews, which is how
    the first charge hands us the id every later renewal is read against.

    `customer_id` is their id for whoever paid and the only thing the
    portal can be opened against. We never mint it, so reading it back off
    a payment is the only way we ever learn it.
    """

    payment_id: str
    status: str
    amount_minor: int
    currency: str
    session_id: str | None
    reference: str
    subscription_id: str | None = None
    settlement_minor: int | None = None
    settlement_currency: str | None = None
    customer_id: str = ""

    @property
    def amounts(self) -> tuple[tuple[int, str], ...]:
        """The one charge, in every currency the provider names it in.

        Adaptive pricing converts at the customer's end, so a payment
        carries two figures and neither is wrong: the total in `currency`
        is what the card was charged, and the settlement pair is what
        reaches the balance. Either side can be the currency we quoted,
        which is why a caller comparing them checks both rather than
        picking one.
        """
        pairs = [(self.amount_minor, self.currency)]
        if self.settlement_currency:
            pairs.append((self.settlement_minor or 0, self.settlement_currency))
        return tuple(pairs)


@dataclass(frozen=True)
class Subscription:
    """A subscription as the provider sees it.

    `next_billing_at` is the useful field: when they will charge again,
    and therefore how long the current payment has already bought. It can
    be absent on one that has ended, which is why `status` decides and not
    the date.

    `amount_minor` is the product's recurring figure, pre-tax and in the
    product's own currency. Deliberately not a payment's `amounts`: this
    is what the plan costs in the abstract, not what anybody's card was
    charged, and the two part company the moment a buyer switches currency
    in the checkout. For the charge, ask `subscription_payment`.

    `cancel_at_next_billing_date` is the one thing `status` cannot say. A
    cancelled subscription stays active until the period already paid for
    runs out, which is the promise rather than a bug, so the status alone
    would have us announcing a renewal on a date nobody will ever charge.
    """

    subscription_id: str
    status: str
    next_billing_at: dt.datetime | None
    amount_minor: int
    currency: str
    reference: str
    customer_id: str = ""
    cancel_at_next_billing_date: bool = False

    @property
    def active(self) -> bool:
        return self.status == SUBSCRIPTION_ACTIVE

    @property
    def over(self) -> bool:
        return self.status in SUBSCRIPTION_OVER


class DodoGateway:
    def __init__(self, api_key: str, base_url: str):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")

    def _call(self, method: str, path: str, body: dict | None = None, params: dict | None = None) -> dict:
        url = f"{self.base_url}{path}"
        if params:
            url = f"{url}?{urllib.parse.urlencode(params)}"
        data = json.dumps(body).encode() if body is not None else None
        request = urllib.request.Request(
            url,
            data=data,
            method=method,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
                # Named, because their edge answers Cloudflare 1010 to
                # `Python-urllib/3.x` before the request ever reaches them.
                "User-Agent": USER_AGENT,
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=TIMEOUT) as response:  # noqa: S310
                return json.loads(response.read() or b"{}")
        except urllib.error.HTTPError as exc:
            # The body says which field they disliked, and the key is in a
            # header rather than in either, so it cannot ride out in a log.
            logger.error("dodo %s %s -> %s %s", method, path, exc.code, exc.read()[:500])
            raise DodoError(f"{method} {path} failed") from exc
        except (urllib.error.URLError, TimeoutError, ValueError) as exc:
            logger.error("dodo %s %s unreachable: %s", method, path, exc)
            raise DodoError(f"{method} {path} failed") from exc

    def create_checkout(
        self,
        *,
        product_id: str,
        amount_minor: int,
        currency: str,
        country: str,
        email: str,
        return_url: str,
        reference: str,
    ) -> Checkout:
        """One cart shape for all four plans. A subscription product is
        what makes a session recurring: the provider decides that from the
        product, not from anything said here, which is why this only
        passes a product id.

        `country` is a guess and has to stay one. It is the market the
        price was quoted in, where somebody probably is and never where
        they certainly are, so `allow_customer_editing_country` keeps the
        prefill a default rather than a verdict: the provider locks a
        field it was handed, and a visitor priced in rupees whose card
        bills to Singapore would otherwise have no way to say so and no
        way to pay.
        """
        body = self._call(
            "POST",
            "/checkouts",
            {
                "product_cart": [{"product_id": product_id, "quantity": 1, "amount": amount_minor}],
                "customer": {"email": email},
                "billing_address": {"country": country},
                "billing_currency": currency,
                "feature_flags": {"allow_customer_editing_country": True},
                "return_url": return_url,
                "metadata": {"reference": reference},
            },
        )
        session_id, url = body.get("session_id"), body.get("checkout_url")
        if not session_id or not url:
            raise DodoError(f"checkout session came back without a url: {body}")
        return Checkout(session_id=session_id, url=url)

    def payment(self, payment_id: str) -> Payment:
        return _payment(self._call("GET", f"/payments/{payment_id}"), payment_id)

    def subscription_payment(self, subscription_id: str) -> Payment | None:
        """The most recent charge behind a subscription, or None.

        The only place the money a subscriber actually handed over can be
        read: the subscription object names its recurring pre-tax amount
        in the product's own currency, which is neither what the card was
        charged nor the currency it was charged in. The rows this lists
        are thinner than a fetched payment, with no checkout session,
        which is why the binding on this path is the reference alone.
        """
        body = self._call("GET", "/payments", params={"subscription_id": subscription_id})
        for item in body.get("items") or []:
            if isinstance(item, dict):
                charge = _payment(item)
                if charge.status == SUCCEEDED:
                    return charge
        return None

    def subscription(self, subscription_id: str) -> Subscription:
        body = self._call("GET", f"/subscriptions/{subscription_id}")
        return Subscription(
            subscription_id=body.get("subscription_id", subscription_id),
            status=body.get("status") or "",
            next_billing_at=_moment(body.get("next_billing_date")),
            # Recurring amounts come back pre-tax and under their own
            # name; the merchant of record adds tax at charge time.
            amount_minor=int(body.get("recurring_pre_tax_amount") or 0),
            currency=(body.get("currency") or "").upper(),
            reference=str((body.get("metadata") or {}).get("reference") or ""),
            customer_id=_customer(body),
            cancel_at_next_billing_date=bool(body.get("cancel_at_next_billing_date")),
        )

    def portal(self, customer_id: str, return_url: str = "") -> str:
        """A link into the provider's customer portal, good for one visit.

        Cancelling, a new card and past invoices all live behind it and
        none of them are ours to build. Our own cancel button would have
        been one call and no new column, and would still leave somebody
        whose card expires next month with nowhere in the product to go.
        """
        body = self._call(
            "POST",
            f"/customers/{customer_id}/customer-portal/session",
            params={"return_url": return_url} if return_url else None,
        )
        link = body.get("link")
        if not link:
            raise DodoError(f"portal session came back without a link: {body}")
        return link


def _payment(body: dict, fallback_id: str = "") -> Payment:
    """One payment, in whichever shape it arrived in. The same mapping
    serves a fetched payment and a row of the payments list; a field the
    thinner shape omits arrives as None, which is what it is."""
    return Payment(
        payment_id=body.get("payment_id") or fallback_id,
        status=body.get("status") or "",
        amount_minor=int(body.get("total_amount") or 0),
        currency=(body.get("currency") or "").upper(),
        session_id=body.get("checkout_session_id"),
        reference=str((body.get("metadata") or {}).get("reference") or ""),
        subscription_id=body.get("subscription_id") or None,
        settlement_minor=(None if body.get("settlement_amount") is None else int(body["settlement_amount"])),
        settlement_currency=(body.get("settlement_currency") or "").upper() or None,
        customer_id=_customer(body),
    )


def _customer(body: dict) -> str:
    """Their id for whoever paid, out of the object they nest it in. "" on
    a shape that does not carry one, because every caller is asking
    whether there is one to open the portal with."""
    return str((body.get("customer") or {}).get("customer_id") or "")


def _moment(value) -> dt.datetime | None:
    """One ISO-8601 timestamp, or nothing. An unparseable date is treated
    as absent rather than raised on: it means the next renewal is unknown,
    which every caller already handles, and a subscription is not worth a
    500 over a date format."""
    if not isinstance(value, str) or not value:
        return None
    try:
        moment = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        logger.warning("dodo sent a date that will not parse: %r", value)
        return None
    return moment if moment.tzinfo else moment.replace(tzinfo=dt.UTC)


@dataclass
class RecordingGateway:
    """For tests. Hands back whatever it was told to, and remembers the
    asking. Every test runs against this: a developer's `.env` can hold a
    real test key, and a suite that could reach it is one loop away from a
    few hundred sandbox checkout sessions."""

    url: str = "https://test.checkout.dodopayments.com/session/cks_fake"
    portal_url: str = "https://test.dodopayments.com/portal/session/pse_fake"
    checkouts: list[dict] = field(default_factory=list)
    payments: dict[str, Payment] = field(default_factory=dict)
    subscriptions: dict[str, Subscription] = field(default_factory=dict)
    #: Every subscription read, in order. A test that cares the renewal
    #: check is throttled counts these rather than timing anything.
    reads: list[str] = field(default_factory=list)
    #: Every customer the portal was opened against, in order.
    portals: list[str] = field(default_factory=list)
    error: Exception | None = None
    _next: int = 0

    def create_checkout(self, **kwargs) -> Checkout:
        if self.error:
            raise self.error
        self._next += 1
        self.checkouts.append(kwargs)
        return Checkout(session_id=f"cks_fake_{self._next}", url=self.url)

    def payment(self, payment_id: str) -> Payment:
        if self.error:
            raise self.error
        try:
            return self.payments[payment_id]
        except KeyError as exc:
            raise DodoError(f"no such payment {payment_id}") from exc

    def subscription_payment(self, subscription_id: str) -> Payment | None:
        if self.error:
            raise self.error
        for charge in self.payments.values():
            if charge.subscription_id == subscription_id and charge.status == SUCCEEDED:
                return charge
        return None

    def subscription(self, subscription_id: str) -> Subscription:
        # Recorded before the error, not after: what a throttling test
        # counts is how often we asked, and an outage retried on every
        # page view is exactly the bug it is looking for.
        self.reads.append(subscription_id)
        if self.error:
            raise self.error
        try:
            return self.subscriptions[subscription_id]
        except KeyError as exc:
            raise DodoError(f"no such subscription {subscription_id}") from exc

    def portal(self, customer_id: str, return_url: str = "") -> str:
        self.portals.append(customer_id)
        if self.error:
            raise self.error
        return self.portal_url

    def paid(self, payment: Payment) -> Payment:
        self.payments[payment.payment_id] = payment
        return payment

    def renewing(self, subscription: Subscription) -> Subscription:
        self.subscriptions[subscription.subscription_id] = subscription
        return subscription


_gateway = None


def gateway():
    global _gateway
    if _gateway is None:
        if not settings.DODO_API_KEY:
            raise DodoError("payments are not configured")
        _gateway = DodoGateway(settings.DODO_API_KEY, settings.DODO_BASE_URL)
    return _gateway


def use_gateway(replacement) -> None:
    """Tests, and nothing else. `None` puts the real one back."""
    global _gateway
    _gateway = replacement
