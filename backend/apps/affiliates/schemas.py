from ninja import Field, Schema


class ProgrammeOut(Schema):
    """What the public pitch prints. Every number is read from the same
    constants settlement pays and the payouts tool refuses under, so a
    page cannot promise a rate the code does not honour."""

    percent: int
    cookie_days: int
    minimum_payout: str
    #: This account's link, or null for a stranger reading the pitch.
    code: str | None
    link: str | None


class EventOut(Schema):
    at: str
    kind: str
    label: str
    amount: str


class PayoutOut(Schema):
    at: str
    amount: str
    reference: str


class SummaryOut(Schema):
    referrals: int
    purchases: int
    earned: str
    paid: str
    balance: str
    #: Whether the balance is over the minimum worth transferring.
    payable: bool


class ReferralsOut(Schema):
    """One affiliate's own page, in one call."""

    code: str
    link: str
    paypal_email: str
    percent: int
    minimum_payout: str
    summary: SummaryOut
    activity: list[EventOut]
    payouts: list[PayoutOut]


class PaypalIn(Schema):
    email: str = Field(default="", max_length=254)
