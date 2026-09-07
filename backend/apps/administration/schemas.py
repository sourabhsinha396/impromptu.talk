from ninja import Field, Schema


class LengthOut(Schema):
    code: str
    label: str


class GiftOut(Schema):
    id: int
    email: str
    name: str
    plan: str
    at: str
    #: Null is forever, which is the one thing a date cannot say.
    until: str | None


class ProOut(Schema):
    lengths: list[LengthOut]
    gifts: list[GiftOut]


class GiftIn(Schema):
    email: str = Field(max_length=254)
    plan: str = Field(max_length=20)


class RevokeIn(Schema):
    purchase_id: int


class OwedOut(Schema):
    user_id: int
    email: str
    name: str
    paypal_email: str
    balance: str
    earned: str
    #: Over the minimum and with somewhere to send it.
    ready: bool


class PaidOut(Schema):
    at: str
    email: str
    amount: str
    reference: str


class PayoutsOut(Schema):
    minimum: str
    owed: list[OwedOut]
    recent: list[PaidOut]


class PayoutIn(Schema):
    user_id: int
    #: Typed, because the balance on the page is a suggestion and not an
    #: instruction: PayPal takes a fee off some transfers.
    amount: str = Field(max_length=20)
    reference: str = Field(default="", max_length=120)


class OutreachRowOut(Schema):
    id: int
    name: str
    url: str
    at: str


class OutreachOut(Schema):
    message: str
    rows: list[OutreachRowOut]


class OutreachIn(Schema):
    name: str = Field(max_length=120)
    url: str = Field(default="", max_length=300)
