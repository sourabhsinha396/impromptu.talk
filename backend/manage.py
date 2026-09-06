#!/usr/bin/env python
import os
import sys
from pathlib import Path

from dotenv import load_dotenv


def main():
    load_dotenv(Path(__file__).resolve().parent / ".env")
    # Production is the default on purpose: a host that forgot its .env
    # gets the settings that refuse to boot misconfigured, not DEBUG.
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "impromptu.settings.production")
    from django.core.management import execute_from_command_line

    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
