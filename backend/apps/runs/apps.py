from django.apps import AppConfig
from django.contrib.auth.signals import user_logged_in


class RunsConfig(AppConfig):
    name = "apps.runs"

    def ready(self):
        from apps.runs.services import claim_on_login

        # Every door (the form, Google, a test's force_login) ends in
        # Django's login(), which fires this. One rule in the one place
        # every sign-in passes through, so no door can forget the claim.
        user_logged_in.connect(claim_on_login, dispatch_uid="runs.claim_on_login")
