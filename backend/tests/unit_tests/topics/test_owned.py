"""The genres people write for themselves: the paste, the caps, the
styles they coin and the link they share.

One `Genre` table holds these and the built-in bank, so the test that
matters most is not in this file: `test_seed.py` pins that the seeder
never reads past `owner IS NULL`. What is here is everything the editor
can do, and what a stranger holding a link may see.

Two tables hang under that genre, and `TestOwnWarmUps` at the foot is
where the difference between them is pinned.
"""

import pytest
from django.test import Client

from apps.payments.models import Purchase
from apps.topics import bank, owned
from apps.topics.models import Genre, TongueTwister, Topic
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
                        "has_pictures": False, "mode": None, "max_topics": owned.MAX_TOPICS}
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


PASSAGE = (
    "Six strict speech specialists structured sixty sophisticated speaking scripts, subtly switching stressed "
    "syllables so that steady students stumbled slightly. Such scripts seemed simple, yet several speakers "
    "stalled, sighed, and started again. Should serious speakers surrender, or should they slow right down?"
)
SECOND = (
    "Which witch watched which watch, and which watch did the watching witch wish she had washed? The witch "
    "which watched the wristwatch wished the wristwatch worked, but the wristwatch the watching witch wore "
    "was worn out entirely, which is why the watching witch went on watching whichever watch was working."
)


class TestOwnWarmUps:
    """A warm-up somebody writes: the Pro half of tongue twisters.

    The same genre row and the same routes as any owned genre, with one
    column saying which round it runs - and its passages in a table of
    their own, because a prompt is a line with a style and a passage is a
    paragraph with a level, and the caps are not the same number either.
    """

    def make_read(self, client, name="My twisters"):
        return client.post(MINE, {"name": name, "icon": "mic", "mode": "read"}, content_type=JSON)

    def add(self, client, text, slug="my-twisters"):
        return client.post(f"{MINE}/{slug}/topics", {"text": text}, content_type=JSON)

    def test_a_warm_up_says_which_round_it_runs_and_holds_fewer_rows(self, pro):
        body = self.make_read(pro).json()
        assert body["mode"] == "read"
        assert body["max_topics"] == owned.MAX_PASSAGES < owned.MAX_TOPICS

    def test_a_paste_splits_on_blank_lines_not_on_newlines(self, pro):
        """The bug this parser exists to stop. Split per line, a passage
        becomes one row per sentence, and every one of those is then
        refused for being too short to scroll."""
        self.make_read(pro)
        body = self.add(pro, PASSAGE + "\n\n" + SECOND + "\n").json()
        assert body["topic_count"] == 2
        assert [t["text"] for t in body["topics"]] == [PASSAGE, SECOND]

    def test_a_line_too_short_to_scroll_is_refused_with_the_reason(self, pro):
        self.make_read(pro)
        answer = self.add(pro, "She sells seashells")
        assert answer.status_code == 400
        assert "at least" in answer.json()["detail"]

    def test_a_passage_lands_in_its_own_table_and_never_among_the_prompts(self, pro):
        """The split itself, from the editor's end. A warm-up holds no
        `Topic` rows at all, so nothing that means "prompts" has to
        remember to exclude them."""
        self.make_read(pro)
        self.add(pro, PASSAGE)
        genre = Genre.objects.get(slug="my-twisters")
        assert genre.tongue_twisters.count() == 1
        assert not genre.topics.exists()
        assert genre.tongue_twisters.first().text == PASSAGE

    def test_a_passage_keeps_its_whole_length_where_a_prompt_would_be_cut(self, pro):
        """A prompt is capped at 200 characters, in the column now as well
        as in the code. Sharing that ceiling would have cut every passage
        mid-sentence and saved the fragment without a word."""
        self.make_read(pro)
        self.add(pro, PASSAGE)
        held = Genre.objects.get(slug="my-twisters").tongue_twisters.first()
        assert len(PASSAGE) > bank.MAX_TEXT
        assert held.text == PASSAGE

    def test_a_passage_carries_a_level_and_never_a_coined_style(self, pro):
        """Two fields on the wire, each absent on the other kind, rather
        than one field meaning a style here and a difficulty there."""
        self.make_read(pro)
        row = self.add(pro, PASSAGE).json()["topics"][0]
        assert row["level"] == owned.DEFAULT_LEVEL
        assert row["style"] == "" and row["style_label"] == ""
        assert row["words"] == len(PASSAGE.split())
        edited = pro.patch(
            f"{MINE}/my-twisters/topics/{row['id']}",
            {"text": PASSAGE, "level": "easy"},
            content_type=JSON,
        ).json()
        assert edited["topics"][0]["level"] == "easy"
        # Anything outside the two falls back rather than coining itself:
        # the words are what the owner came to change, not the label.
        coined = pro.patch(
            f"{MINE}/my-twisters/topics/{row['id']}",
            {"text": PASSAGE, "level": "IELTS style"},
            content_type=JSON,
        ).json()
        assert coined["topics"][0]["level"] == owned.DEFAULT_LEVEL

    def test_a_passage_carries_its_own_name_so_the_page_can_tell_two_apart(self, pro):
        """The slug the row was given when it landed. Left off the wire,
        every passage somebody owned arrived as the empty string, and an
        empty string is not an absent value: the warm-up page looks its
        opening passage up by slug and "" matched the first of them, which
        is how a page with no link in its URL opened somebody's own row and
        then drew nothing at all. The best speed per passage is keyed on it
        too, so one name for all of them is one score for all of them."""
        self.make_read(pro)
        row = self.add(pro, PASSAGE).json()["topics"][0]
        held = Genre.objects.get(slug="my-twisters").tongue_twisters.first()
        assert row["slug"] == held.slug
        assert row["slug"]

    def test_an_edited_passage_is_held_to_the_passage_bounds(self, pro):
        """The edit route reads the genre's mode to pick its rule, so a
        passage cut down to a sentence is refused where the same words
        would be a perfectly good prompt in a genre of prompts."""
        self.make_read(pro)
        row = self.add(pro, PASSAGE).json()["topics"][0]
        answer = pro.patch(
            f"{MINE}/my-twisters/topics/{row['id']}",
            {"text": "Too short to scroll", "level": "easy"},
            content_type=JSON,
        )
        assert answer.status_code == 400
        assert "at least" in answer.json()["detail"]

    def test_a_warm_up_is_capped_at_fifty_passages_and_the_paste_is_refused_whole(self, pro):
        """Fifty, not two hundred: a passage is a hundred words, and the
        page it is practised on server-renders its own bank. Over the line
        the whole paste is refused, because somebody cannot see which of
        their ninety would have been kept."""
        self.make_read(pro)
        genre = Genre.objects.get(slug="my-twisters")
        factories.TongueTwisterFactory.create_batch(owned.MAX_PASSAGES, genre=genre)
        answer = self.add(pro, PASSAGE)
        assert answer.status_code == 400
        assert str(owned.MAX_PASSAGES) in answer.json()["detail"]
        assert genre.tongue_twisters.count() == owned.MAX_PASSAGES

    def test_deleting_a_passage_removes_it_and_leaves_the_genre(self, pro):
        self.make_read(pro)
        row = self.add(pro, PASSAGE).json()["topics"][0]
        body = pro.delete(f"{MINE}/my-twisters/topics/{row['id']}").json()
        assert body["topic_count"] == 0
        assert not TongueTwister.objects.filter(pk=row["id"]).exists()
        assert Genre.objects.filter(slug="my-twisters").exists()

    def test_deleting_the_genre_takes_its_passages_with_it(self, pro):
        self.make_read(pro)
        self.add(pro, PASSAGE)
        pro.delete(f"{MINE}/my-twisters")
        assert not Genre.objects.filter(slug="my-twisters").exists()
        assert not TongueTwister.objects.exists()

    def test_the_same_passage_pasted_twice_lands_once(self, pro):
        """The duplicate is dropped rather than refusing the paste, which
        is what the prompts already do: a repeat is the one thing somebody
        can see for themselves."""
        self.make_read(pro)
        self.add(pro, PASSAGE)
        body = self.add(pro, PASSAGE + "\n\n" + SECOND).json()
        assert body["topic_count"] == 2

    def test_the_two_caps_are_counted_off_the_right_table(self, pro):
        """A genre of prompts and a warm-up beside it. Each is measured
        against its own rows and its own ceiling, and the ten-genre cap
        counts both, because ten genres is ten whatever they hold."""
        make(pro, name="Prompts")
        self.make_read(pro)
        paste(pro, "prompts", "A prompt line")
        self.add(pro, PASSAGE)
        body = pro.get(MINE).json()
        held = {g["slug"]: g for g in body["genres"]}
        assert held["prompts"]["topic_count"] == 1
        assert held["prompts"]["max_topics"] == owned.MAX_TOPICS
        assert held["my-twisters"]["topic_count"] == 1
        assert held["my-twisters"]["max_topics"] == owned.MAX_PASSAGES
        assert body["max_genres"] == owned.MAX_GENRES

    def test_a_shared_warm_up_hands_a_stranger_its_passages(self, pro, client):
        """Sharing is the genre's, not the row kind's: a link to a set of
        passages has to work the same way a link to a set of prompts does,
        and viewing stays free."""
        self.make_read(pro)
        self.add(pro, PASSAGE)
        token = pro.post(f"{MINE}/my-twisters/share").json()["token"]
        body = client.get(f"/api/v1/topics/shared/{token}").json()
        assert [t["text"] for t in body["topics"]] == [PASSAGE]
        assert body["topics"][0]["level"] == owned.DEFAULT_LEVEL

    def test_a_mode_nobody_offers_makes_an_ordinary_genre(self, pro):
        body = pro.post(MINE, {"name": "Sideways", "icon": "mic", "mode": "<script>"}, content_type=JSON).json()
        assert body["mode"] is None
        assert Genre.objects.get(slug="sideways").mode == "speak"

    def test_writing_one_is_still_pro_only(self, client, user):
        client.force_login(user)
        assert self.make_read(client).status_code == 403
