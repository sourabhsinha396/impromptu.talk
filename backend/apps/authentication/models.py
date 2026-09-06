"""The account.

Declared in the skeleton rather than on the accounts card because
AUTH_USER_MODEL has to be set before the first migration runs: swapping
the user model later means rewriting every foreign key to it. Only the
columns Django needs are here; the accounts card adds the rest (accent,
google_sub, referred_by, share_token, affiliate_code, paypal_email).
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

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: list[str] = []

    class Meta:
        db_table = "users"

    def __str__(self) -> str:
        return self.email
