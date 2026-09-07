from django.contrib import admin
from django.contrib.admin.views.decorators import staff_member_required
from django.urls import path
from ninja import NinjaAPI

from apps.administration.apis import api as administration_api
from apps.affiliates.apis import api as affiliates_api
from apps.authentication.apis import api as auth_api
from apps.common import ratelimit
from apps.common.apis import api as common_api
from apps.payments.apis import api as payments_api
from apps.runs.apis import api as runs_api
from apps.topics.apis import api as topics_api

api = NinjaAPI(title="impromptu", docs_decorator=staff_member_required)

api.add_router("v1/common", common_api)
api.add_router("v1/auth", auth_api)
api.add_router("v1/topics", topics_api)
api.add_router("v1/runs", runs_api)
api.add_router("v1/payments", payments_api)
api.add_router("v1/affiliates", affiliates_api)
api.add_router("v1/administration", administration_api)


@api.exception_handler(ratelimit.RateLimited)
def rate_limited(request, exc):
    response = api.create_response(
        request, {"detail": "Too many attempts. Wait a few minutes and try again."}, status=429
    )
    response["Retry-After"] = str(ratelimit.retry_after(exc))
    return response


# The console names itself, so a tab open beside a neighbouring stack's
# admin is not a coin toss.
admin.site.site_header = "impromptu"
admin.site.site_title = "impromptu"
admin.site.index_title = "Tables"

urlpatterns = [
    # `/admin/`, the name Django uses and the name anybody looks for
    # (owner's call, 2026-09-07). The frontend's operator console is
    # `/administration`, a different path segment, so the two cannot
    # collide even where one proxy fronts both origins.
    path("admin/", admin.site.urls),
    path("api/", api.urls),
]
