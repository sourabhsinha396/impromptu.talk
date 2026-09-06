from django.core.management.base import BaseCommand

from apps.topics.services import seed_topics


class Command(BaseCommand):
    help = (
        "Write the built-in bank into the database. Idempotent. Run once by hand, "
        "and again after editing a file under data/topics or the genre list; never on boot."
    )

    def handle(self, *args, **options):
        genres, topics = seed_topics()
        self.stdout.write(f"seeded {genres} genres, {topics} topics")
