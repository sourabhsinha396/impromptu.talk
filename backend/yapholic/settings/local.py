from .base import *  # noqa: F403

ENVIRONMENT = "local"
DEBUG = True
ALLOWED_HOSTS = ["localhost", "127.0.0.1"]

# Static files are served off disk here whatever the .env holds. base.py
# switches to the CDN on STORAGE_BUCKET alone, and a developer's .env
# carries the real bucket so the deploy host's values live in one file, so
# local was rendering the admin's CSS as https://cdn.yapholic.com/... :
# runserver's staticfiles handler only ever intercepts a relative
# STATIC_URL, so with an absolute one on another host it never sees the
# request, and the admin came back unstyled with nothing in the log. That
# is the "django admin is not having css" failure again, on the other
# side. Serving off disk with no collecting is the whole point of DEBUG;
# the CDN path is exercised by running the production settings.
STATIC_URL = "static/"

# Uploads go the other way, and for the mirror-image reason. A static
# file has a local server (runserver's staticfiles handler) and needs a
# relative URL to reach it. An uploaded picture has no local server at
# all: it is drawn by an `img` tag on the frontend's origin, and nothing
# here serves MEDIA_URL, so on disk it is a 404 every time. With a bucket
# configured it goes to the bucket in development too, which is also the
# only way the upload path is exercised before it is deployed.
STORAGES = {
    "default": (
        {"BACKEND": "storages.backends.s3.S3Storage"}
        if STORAGE_BUCKET  # noqa: F405 - from base
        else {"BACKEND": "django.core.files.storage.FileSystemStorage"}
    ),
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}
