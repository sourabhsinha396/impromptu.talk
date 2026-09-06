from ninja import Router

api = Router(tags=["common"])


@api.get("/health")
def health(request):
    return {"status": "ok"}
