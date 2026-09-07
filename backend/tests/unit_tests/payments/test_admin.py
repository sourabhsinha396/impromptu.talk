"""The money ledger in the owner's console.

A refund starts in the provider's dashboard, so the only thing this
codebase can record is that one happened. That edit is the refund: there
is no `refund()` verb anywhere, and the one thing worth pinning is that it
announces itself exactly once.
"""

import datetime as dt

from django.forms.models import model_to_dict
from django.test import Client

from apps.authentication.models import User
from apps.payments import services
from apps.payments.models import Purchase
from tests.unit_tests import factories

CHANGE = "/re-admin/payments/purchase/{}/change/"


def owner_client(db) -> Client:
    owner = User.objects.create_superuser("owner@example.com", factories.PASSWORD)
    client = Client()
    client.force_login(owner)
    return client


def change_form(row: Purchase, **over) -> dict:
    """The row as its own change form would post it back, so a test edits
    one field and leaves everything else exactly where it was."""
    payload = {}
    for name, value in model_to_dict(row).items():
        if isinstance(value, dt.datetime):
            payload[f"{name}_0"] = value.date().isoformat()
            payload[f"{name}_1"] = value.time().isoformat()
        else:
            payload[name] = "" if value is None else value
    return {**payload, **over, "_save": "Save"}


def test_marking_a_paid_row_refunded_announces_it_once_and_pulls_the_access(db, user, channel):
    client = owner_client(db)
    row = factories.PurchaseFactory(user=user, status=Purchase.PAID, expires_at=None)

    response = client.post(CHANGE.format(row.pk), change_form(row, status=Purchase.REFUNDED))
    assert response.status_code == 302
    row.refresh_from_db()
    assert row.status == Purchase.REFUNDED
    assert channel.headlines == ["Refunded"]
    assert row.reference in channel.posted[0]
    # Entitlement reads paid rows only, so the edit is what pulls Pro.
    assert services.held(user) is None

    # Opening the row again and saving it is not a second refund.
    client.post(CHANGE.format(row.pk), change_form(row))
    assert channel.headlines == ["Refunded"]


def test_an_ordinary_edit_of_a_paid_row_announces_nothing(db, user, channel):
    client = owner_client(db)
    row = factories.PurchaseFactory(user=user, status=Purchase.PAID)
    response = client.post(CHANGE.format(row.pk), change_form(row, subscription_status="active"))
    assert response.status_code == 302
    assert channel.posted == []


def test_the_ledger_shows_the_quote_and_the_charge_side_by_side(db, user):
    """A product drifted at the provider is two columns disagreeing,
    which is the one thing nobody would otherwise notice."""
    client = owner_client(db)
    factories.PurchaseFactory(user=user, status=Purchase.PAID, amount_minor=3900, currency="USD",
                              charged_minor=4200, charged_currency="USD")
    page = client.get("/re-admin/payments/purchase/").content.decode()
    assert "$39" in page and "$42" in page


def test_an_ordinary_account_cannot_reach_the_ledger(db, user):
    """The console is Django's own login and the staff flag, not the site
    session: a stolen browser cookie must not be able to rewrite a
    purchase."""
    signed_in = Client()
    signed_in.force_login(user)
    response = signed_in.get("/re-admin/payments/purchase/")
    assert response.status_code == 302
    assert "/re-admin/login/" in response["Location"]
