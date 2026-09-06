from django.contrib import admin
from django.contrib.admin.views.decorators import staff_member_required
from django.urls import path
from ninja import NinjaAPI

from apps.common.apis import api as common_api

api = NinjaAPI(title="impromptu", docs_decorator=staff_member_required)

api.add_router("v1/common", common_api)

urlpatterns = [
    # `re-admin`, not `admin`: /administration is the superusers' tool console
    # on the frontend, and a bare `admin` prefix would sit under it.
    path("re-admin/", admin.site.urls),
    path("api/", api.urls),
]
