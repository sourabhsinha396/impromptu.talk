import pytest

from apps.authentication.models import User


def test_email_is_the_login_and_is_lowercased(db):
    user = User.objects.create_user("Speaker@Example.COM", "correct horse battery")
    assert user.email == "speaker@example.com"
    assert user.check_password("correct horse battery")
    assert not user.is_staff
    assert not user.is_superuser


def test_a_row_without_a_password_cannot_be_signed_into_with_one(db):
    user = User.objects.create_user("google-only@example.com", None)
    assert not user.has_usable_password()
    assert not user.check_password("")


def test_a_superuser_is_also_staff(db):
    user = User.objects.create_superuser("owner@example.com", "correct horse battery")
    assert user.is_staff
    assert user.is_superuser


def test_an_email_is_required(db):
    with pytest.raises(ValueError):
        User.objects.create_user("", "correct horse battery")
