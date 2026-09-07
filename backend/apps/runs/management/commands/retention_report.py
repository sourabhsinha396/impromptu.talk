from django.core.management.base import BaseCommand

from apps.runs.retention import report


class Command(BaseCommand):
    help = "Day-2 and day-7 return, read off the runs table. The gate the roadmap waits on."

    def handle(self, *args, **options):
        self.stdout.write(report())
