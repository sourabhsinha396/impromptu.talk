"""The account.

Declared in the skeleton rather than on the accounts card because
AUTH_USER_MODEL has to be set before the first migration runs: swapping
the user model later means rewriting every foreign key to it. The
columns each later card reads landed with it (share token on 18, the
rest on 19), so the table is whole before the doors open.
"""

from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.db import models


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create(self, email: str, password: str | None, **extra):
        if not email:
            raise ValueError("An email address is required.")
        user = self.model(email=self.normalize_email(email).lower(), **extra)
        # None sets an unusable password, which is how a Google-only row
        # is told apart from one with a password: absence, not a placeholder.
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email: str, password: str | None = None, **extra):
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        return self._create(email, password, **extra)

    def create_superuser(self, email: str, password: str | None = None, **extra):
        extra["is_staff"] = True
        extra["is_superuser"] = True
        return self._create(email, password, **extra)


class User(AbstractBaseUser, PermissionsMixin):
    """Email is the login. `name` is what a person is called, not a login,
    and it is blank for every account that never gave one.

    `is_staff` opens the Django admin (the owner's console over the tables);
    `is_superuser` opens /administration (the operators' tools). Nothing on
    the site raises either flag; the admin and the database are the only
    doors.
    """

    email = models.EmailField(unique=True)
    name = models.CharField(max_length=80, blank=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    # The whole of streak sharing: null means no public page, which is the
    # default, because a streak is private until its owner decides
    # otherwise. Minted once on the streak page, cleared from the account's
    # additional settings or by hand in the admin for somebody who writes in.
    share_token = models.CharField(max_length=32, null=True, blank=True, unique=True)
    # One of the six in the palette, applied only while Pro is live; blank
    # is the default lime. On the account rather than in the browser,
    # unlike the theme, because it is a thing somebody chose about their
    # impromptu and choosing it again on a phone would make it a setting.
    accent = models.CharField(max_length=20, blank=True)
    # Google's own subject id, matched before the address because it
    # survives a change of address and the address does not survive a
    # change of owner. Unique, so two rows can never claim one Google
    # account; NULL for everybody else, and NULLs do not collide.
    google_sub = models.CharField(max_length=255, null=True, blank=True, unique=True)
    # The account whose link brought this one in, written once at signup
    # off the referral cookie and never overwritten: the affiliate who did
    # the work keeps them. SET_NULL because deleting an affiliate deletes
    # the affiliate, not the accounts they sent.
    referred_by = models.ForeignKey("self", null=True, blank=True, on_delete=models.SET_NULL, related_name="referrals")
    # The code in this account's own link, minted on the first look at
    # /account or /affiliate (card 31) and never changed. Read here at
    # signup to attribute the cookie.
    affiliate_code = models.CharField(max_length=24, null=True, blank=True, unique=True)
    # Where a payout goes. Blank until the affiliate gives one.
    paypal_email = models.EmailField(blank=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: list[str] = []

    class Meta:
        db_table = "users"

    def __str__(self) -> str:
        return self.email
