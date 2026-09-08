"""The channel, and the guard that keeps the suite out of it.

Nothing here reaches the network: the outgoing post is captured, so the
request shape is pinned without a webhook, as `test_mail.py` pins Brevo's.

The failure this file exists to catch is a quiet one either way. A
notification that stops firing takes nothing down - the payment still
settles, the account is still made - so the only thing that would ever
notice is a channel going gradually silent, months later, with nobody able
to say since when.
"""

import urllib.error

from apps.common import slack
from yapholic.settings import testing


def test_the_suite_holds_no_webhook_and_the_recorder_is_what_is_in_play(channel):
    """Both halves of the guard, asserted rather than assumed. Every other
    recorded provider here is protecting a key that costs money to spend;
    this one is protecting something a run would never go red over, since a
    real webhook is reachable from a laptop for free."""
    assert testing.SLACK_WEBHOOK_URL == ""
    assert slack.post is channel


def test_a_blank_webhook_posts_nowhere_and_writes_the_line_instead(settings, caplog):
    """What the blanked setting buys on its own, with no fixture in play:
    the events still happen and are still worth finding afterwards."""
    settings.SLACK_WEBHOOK_URL = ""
    with caplog.at_level("INFO", logger="apps.common.slack"):
        assert slack.notify("New signup", who="a@b.com") is True
    assert "New signup" in caplog.text


def test_the_post_is_the_shape_slack_expects(channel, monkeypatch):
    sent = []
    monkeypatch.setattr(slack, "post", lambda url, body: sent.append((url, body)) or 200)
    slack.notify("New signup")
    url, body = sent[0]
    assert url == "https://hooks.slack.invalid/recorded"
    assert body == {"text": "*New signup*\nenv: testing"}


def test_fields_sit_under_the_headline_in_the_order_they_were_given(channel):
    slack.notify("Payment received", plan="Lifetime", amount="$39")
    headline, detail = channel.posted[0].split("\n")
    assert headline == "*Payment received*"
    assert detail.index("plan: Lifetime") < detail.index("amount: $39")


def test_an_empty_field_is_dropped_and_an_underscore_reads_as_a_word(channel):
    slack.notify("New signup", who="a@b.com", name="", charged_in="INR")
    assert "name" not in channel.posted[0]
    assert "charged in: INR" in channel.posted[0]


def test_anything_that_is_not_production_says_so(channel, settings):
    slack.notify("New signup")
    assert "env: testing" in channel.posted[0]
    settings.ENVIRONMENT = "production"
    slack.notify("New signup")
    assert "env" not in channel.posted[1]


def test_a_refusal_is_false_and_never_puts_the_webhook_in_the_log(monkeypatch, caplog):
    def refuse(url, body):
        raise urllib.error.HTTPError(url, 404, "Not Found", {}, None)

    monkeypatch.setattr(slack, "post", refuse)
    assert slack.notify("New signup") is False
    assert "404" in caplog.text
    # The webhook is the credential, and a 404 is exactly the failure
    # somebody pastes into a bug report with the log around it.
    assert "hooks.slack.invalid" not in caplog.text


def test_a_post_that_raises_anything_at_all_does_not(monkeypatch, caplog):
    """The guarantee every caller is built on. All of them sit after a
    committed row, so there is nothing in here worth a 500."""

    def explode(url, body):
        raise RuntimeError("the webhook is a potato")

    monkeypatch.setattr(slack, "post", explode)
    assert slack.notify("New signup") is False
    assert "potato" not in caplog.text
