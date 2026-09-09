"""The genres people write for themselves: the paste, the caps, the
styles they coin and the link they share.

One pair of tables holds these and the built-in bank, so the test that
matters most is not in this file: `test_seed.py` pins that the seeder
never reads past `owner IS NULL`. What is here is everything the editor
can do, and what a stranger holding a link may see.
"""

import pytest
from django.test import Client

from apps.payments.models import Purchase
from apps.topics import owned
from apps.topics.models import Genre, Topic
from tests.unit_tests import factories

MINE = "/api/v1/topics/mine"
JSON = "application/json"

def lapse(user):
    """Pro ends. The held row goes, which is what an expiry or a refund
    leaves behind, and is now the only way to stop being Pro: the shop
    being open or shut has nothing to do with who is entitled."""
    Purchase.objects.filter(user=user).delete()


@pytest.fixture
def pro(user):
    """Signed in, holding Pro. The purchase is explicit because Pro is a
    held row and nothing else: an unconfigured shop used to stand in for
    one, which meant these tests passed without ever entitling anybody."""
    factories.PurchaseFactory(user=user, plan="lifetime")
    signed_in = Client()
    signed_in.force_login(user)
    return signed_in


def make(client, name="Interview questions", icon="mic"):
    return client.post(MINE, {"name": name, "icon": icon}, content_type=JSON)


def paste(client, slug, text, default_style=""):
    return client.post(
        f"{MINE}/{slug}/topics", {"text": text, "default_style": default_style}, content_type=JSON
    )


class TestThePaste:
    def test_every_line_is_a_topic_and_a_blank_one_is_not(self):
        assert owned.parse("One\n\n  Two  \n") == [("One", "just-talk"), ("Two", "just-talk")]

    def test_a_tail_that_names_a_style_tags_that_line(self):
        assert owned.parse("Tipping should end, hot take") == [("Tipping should end", "hot-take")]
        assert owned.parse("Tipping should end, hot-take") == [("Tipping should end", "hot-take")]

    def test_a_comma_that_is_part_of_the_sentence_stays_in_it(self):
        """The whole reason the rule reads the tail rather than splitting
        on the comma: this is what most lines with a comma look like."""
        assert owned.parse("Tipping should end, and here is why") == [
            ("Tipping should end, and here is why", "just-talk")
        ]

    def test_the_default_is_what_an_untagged_line_gets_and_a_tag_still_wins(self):
        pairs = owned.parse("Explain gravity\nTipping should end, hot take", "explain")
        assert pairs == [("Explain gravity", "explain"), ("Tipping should end", "hot-take")]

    def test_a_paste_cannot_coin_a_style(self):
        """If it could, every comma would. A style somebody named is
        picked in the editor, where they can see what they are doing."""
        assert owned.parse("Ready for the panel, panel round") == [
            ("Ready for the panel, panel round", "just-talk")
        ]
        assert owned.parse("Ready, hot take", "IELTS") == [("Ready", "hot-take")]

    def test_a_repeat_inside_one_paste_is_dropped(self):
        assert owned.parse("Same line\nsame line") == [("Same line", "just-talk")]


class TestMakingOne:
    def test_a_new_genre_is_owned_slugged_and_counted(self, pro, user):
        body = make(pro).json()
        assert body == {"slug": "interview-questions", "name": "Interview questions", "icon": "mic",
                        "topic_count": 0, "share_token": None, "topics": [], "own_styles": [],
                        "has_pictures": False}
        assert Genre.objects.get(slug="interview-questions").owner == user

    def test_an_icon_nobody_offers_becomes_the_default(self, pro):
        assert make(pro, icon="<script>").json()["icon"] == "sparkles"

    def test_a_name_that_slugs_to_nothing_is_refused(self, pro):
        assert make(pro, name="!!!").status_code == 400

    def test_two_people_can_hold_the_same_name_and_one_person_cannot(self, pro, user):
        assert make(pro).status_code == 201
        assert make(pro).status_code == 400

        them = factories.UserFactory(email="other@example.com")
        factories.PurchaseFactory(user=them, plan="lifetime")
        other = Client()
        other.force_login(them)
        assert make(other).status_code == 201

    def test_a_genre_can_never_shadow_a_built_in(self, pro, db):
        """The built-in keeps its own row and its own unique slug; an
        owned one with the same name is a different row under an owner,
        and the picker shows both."""
        factories.GenreFactory(slug="general", name="General", owner=None)
        assert make(pro, name="General").status_code == 201
        assert Genre.objects.filter(slug="general").count() == 2

    def test_the_eleventh_genre_is_refused_with_the_cap_in_the_sentence(self, pro):
        for n in range(owned.MAX_GENRES):
            assert make(pro, name=f"Genre {n}").status_code == 201
        response = make(pro, name="One too many")
        assert response.status_code == 400
        assert str(owned.MAX_GENRES) in response.json()["detail"]


class TestTheTopics:
    def test_a_paste_lands_in_order_and_a_second_one_skips_what_is_there(self, pro):
        make(pro)
        body = paste(pro, "interview-questions", "Tell me about yourself\nWhy this job, hot take").json()
        assert [t["text"] for t in body["topics"]] == ["Tell me about yourself", "Why this job"]
        assert [t["style"] for t in body["topics"]] == ["just-talk", "hot-take"]

        body = paste(pro, "interview-questions", "Tell me about yourself\nWhere do you see yourself").json()
        assert [t["text"] for t in body["topics"]] == [
            "Tell me about yourself", "Why this job", "Where do you see yourself"
        ]

    def test_two_topics_that_slug_the_same_both_land(self, pro):
        """The row is the topic, and the slug is only how it is addressed;
        a refusal here would be the paste failing on punctuation."""
        make(pro)
        body = paste(pro, "interview-questions", "Ready?\nReady").json()
        assert len(body["topics"]) == 2
        assert len({t["id"] for t in body["topics"]}) == 2

    def test_a_paste_over_the_cap_is_refused_whole_rather_than_trimmed(self, pro):
        """Keeping the first thirty of somebody's ninety is worse than
        saying no, because they cannot see which thirty."""
        make(pro)
        full = "\n".join(f"Line {n}" for n in range(owned.MAX_TOPICS))
        assert paste(pro, "interview-questions", full).status_code == 200
        response = paste(pro, "interview-questions", "One more")
        assert response.status_code == 400
        assert Topic.objects.count() == owned.MAX_TOPICS

    def test_a_topic_is_edited_in_place_and_its_style_can_be_coined(self, pro):
        make(pro)
        first = paste(pro, "interview-questions", "Tell me about yourself").json()["topics"][0]
        body = pro.patch(
            f"{MINE}/interview-questions/topics/{first['id']}",
            {"text": "  Tell me about   you  ", "style": "IELTS part 2"},
            content_type=JSON,
        ).json()
        assert body["topics"][0]["text"] == "Tell me about you"
        # Stored as the words typed, never slugified, and it reads back
        # as itself on the page.
        assert body["topics"][0]["style"] == "IELTS part 2"
        assert body["topics"][0]["style_label"] == "IELTS part 2"
        assert body["own_styles"] == ["IELTS part 2"]

    def test_typing_the_name_of_a_built_in_gets_the_built_in(self, pro):
        """There is no sense in an account holding its own "Hot take"
        that the style filter cannot see."""
        make(pro)
        first = paste(pro, "interview-questions", "Tipping should end").json()["topics"][0]
        body = pro.patch(
            f"{MINE}/interview-questions/topics/{first['id']}",
            {"text": "Tipping should end", "style": "Hot take"},
            content_type=JSON,
        ).json()
        assert body["topics"][0]["style"] == "hot-take"
        assert body["own_styles"] == []

    def test_a_coined_style_the_genre_already_holds_wins_on_spelling(self, pro):
        make(pro)
        rows = paste(pro, "interview-questions", "One\nTwo").json()["topics"]
        for row, typed in zip(rows, ["Panel round", "panel  round"], strict=True):
            body = pro.patch(
                f"{MINE}/interview-questions/topics/{row['id']}",
                {"text": row["text"], "style": typed},
                content_type=JSON,
            ).json()
        assert [t["style"] for t in body["topics"]] == ["Panel round", "Panel round"]

    def test_a_topic_id_from_somebody_elses_genre_edits_nothing(self, pro, db):
        make(pro)
        theirs = factories.TopicFactory(genre=factories.GenreFactory(owner=factories.UserFactory(email="x@e.com")))
        response = pro.patch(
            f"{MINE}/interview-questions/topics/{theirs.pk}",
            {"text": "Mine now", "style": ""},
            content_type=JSON,
        )
        assert response.status_code == 404
        theirs.refresh_from_db()
        assert theirs.text != "Mine now"

    def test_a_deleted_topic_is_really_gone(self, pro):
        make(pro)
        first = paste(pro, "interview-questions", "Tell me about yourself").json()["topics"][0]
        body = pro.delete(f"{MINE}/interview-questions/topics/{first['id']}").json()
        assert body["topics"] == []
        assert Topic.objects.count() == 0


class TestSharing:
    def test_sharing_mints_one_token_and_pressing_it_twice_keeps_the_link(self, pro):
        make(pro)
        first = pro.post(f"{MINE}/interview-questions/share").json()["token"]
        assert first
        assert pro.post(f"{MINE}/interview-questions/share").json()["token"] == first

    def test_a_stranger_can_read_a_shared_genre_and_never_the_owners_address(self, pro, client, user):
        user.name = "Ada"
        user.save(update_fields=["name"])
        make(pro)
        paste(pro, "interview-questions", "Tell me about yourself, hot take")
        token = pro.post(f"{MINE}/interview-questions/share").json()["token"]

        body = client.get(f"/api/v1/topics/shared/{token}").json()
        assert body["name"] == "Interview questions"
        assert body["owner_name"] == "Ada"
        assert user.email not in str(body)
        assert body["topics"][0]["style_label"] == "Hot take"

    def test_stopping_kills_the_link_that_was_already_sent(self, pro, client):
        make(pro)
        token = pro.post(f"{MINE}/interview-questions/share").json()["token"]
        pro.delete(f"{MINE}/interview-questions/share")
        assert client.get(f"/api/v1/topics/shared/{token}").status_code == 404
        # And sharing again is a new link, not the old one back.
        assert pro.post(f"{MINE}/interview-questions/share").json()["token"] != token

    def test_a_shared_link_shows_the_list_as_it_is_now(self, pro, client):
        """Nothing is copied, so a genre edited after a link went out is
        edited for everybody holding it."""
        make(pro)
        token = pro.post(f"{MINE}/interview-questions/share").json()["token"]
        paste(pro, "interview-questions", "Added later")
        body = client.get(f"/api/v1/topics/shared/{token}").json()
        assert [t["text"] for t in body["topics"]] == ["Added later"]


class TestWhatProCloses:
    def test_a_stranger_gets_no_list_at_all(self, client, db):
        assert client.get(MINE).status_code == 401

    def test_without_pro_making_pasting_and_sharing_are_refused(self, pro, user):
        make(pro)
        first = paste(pro, "interview-questions", "Tell me about yourself").json()["topics"][0]
        lapse(user)
        assert make(pro, name="Another").status_code == 403
        assert paste(pro, "interview-questions", "One more").status_code == 403
        assert pro.post(f"{MINE}/interview-questions/share").status_code == 403
        assert pro.patch(
            f"{MINE}/interview-questions/topics/{first['id']}",
            {"text": "Edited", "style": ""},
            content_type=JSON,
        ).status_code == 403

    def test_without_pro_the_genres_are_still_there_and_still_readable(self, pro, user):
        make(pro)
        paste(pro, "interview-questions", "Tell me about yourself")
        token = pro.post(f"{MINE}/interview-questions/share").json()["token"]
        lapse(user)
        assert len(pro.get(MINE).json()["genres"]) == 1
        assert len(pro.get(f"{MINE}/interview-questions").json()["topics"]) == 1
        # The link somebody was already sent keeps working, or sharing is
        # a thing that quietly breaks other people's bookmarks when a
        # subscription lapses.
        assert Client().get(f"/api/v1/topics/shared/{token}").status_code == 200

    def test_without_pro_tidying_up_is_still_allowed(self, pro, user):
        """Nobody should be locked in with ten genres they cannot clear."""
        make(pro)
        first = paste(pro, "interview-questions", "Tell me about yourself").json()["topics"][0]
        lapse(user)
        assert pro.delete(f"{MINE}/interview-questions/topics/{first['id']}").status_code == 200
        assert pro.delete(f"{MINE}/interview-questions/share").status_code == 200
        assert pro.delete(f"{MINE}/interview-questions").status_code == 204
        assert Genre.objects.filter(owner__isnull=False).count() == 0
