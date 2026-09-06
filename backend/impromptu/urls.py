from django.contrib import admin
from django.contrib.admin.views.decorators import staff_member_required
from django.urls import path
from ninja import NinjaAPI

from apps.common import ratelimit
from apps.common.apis import api as common_api

api = NinjaAPI(title="impromptu", docs_decorator=staff_member_required)

api.add_router("v1/common", common_api)


@api.exception_handler(ratelimit.RateLimited)
def rate_limited(request, exc):
    response = api.create_response(
        request, {"detail": "Too many attempts. Wait a few minutes and try again."}, status=429
    )
    response["Retry-After"] = str(ratelimit.retry_after(exc))
    return response


urlpatterns = [
    # `re-admin`, not `admin`: /administration is the superusers' tool console
    # on the frontend, and a bare `admin` prefix would sit under it.
    path("re-admin/", admin.site.urls),
    path("api/", api.urls),
]
