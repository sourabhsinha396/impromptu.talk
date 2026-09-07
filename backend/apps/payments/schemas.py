from ninja import Schema


class MarketOut(Schema):
    """One entry in the currency picker: the code it prints, and the flag
    it prints beside it. The country is what names the flag file, which is
    why it travels rather than being mapped again on the other side."""

    currency: str
    country: str
    name: str


class PlanOut(Schema):
    """One thing that can be bought, priced for the visitor."""

    code: str
    name: str
    unit: str
    note: str
    recurring: bool
    #: What it costs, written the way this currency is written, and the
    #: same amount as a number for anything that has to compare it.
    price: str
    amount_minor: int
    #: Days of streak and of calendar this plan tracks, which is the one
    #: thing that differs between the four. The page phrases it.
    tracks: int
    #: Why this account cannot buy this plan right now, or "". The page
    #: prints it in place of the button, so a card says which thing is
    #: already held rather than going quiet.
    refusal: str


class CardOut(Schema):
    """One card on the page: a shape, and the plans a pill switches
    between. An empty list is what makes a card say it is not open."""

    kind: str
    title: str
    plans: list[PlanOut]


class CatalogueOut(Schema):
    """Everything the pricing page draws, in one answer.

    Priced server-side, because the price table, the multipliers and the
    rounding are product policy and belong on one side of the wire. The
    page does no arithmetic; it prints what it is handed.
    """

    selling: bool
    currency: str
    currencies: list[MarketOut]
    cards: list[CardOut]
    #: The free streak, so the page can say what Pro is longer than
    #: without keeping its own copy of the number.
    free_days: int


class CheckoutIn(Schema):
    plan: str
    currency: str = ""


class CheckoutOut(Schema):
    url: str


class SettleIn(Schema):
    reference: str
    payment_id: str = ""
    subscription_id: str = ""


class ReceiptOut(Schema):
    """The done page. `charged` is what the card was charged where that is
    known and the quote otherwise, because a receipt should read back the
    statement rather than our arithmetic."""

    reference: str
    plan_name: str
    recurring: bool
    status: str
    charged: str
    expires_at: str | None
