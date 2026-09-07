"""Who the pitch has gone to.

The distribution plan is creators filming the tool, and step one is a
message typed into Instagram one person at a time. The two ways that goes
wrong are a name pasted over the wrong message and the same person written
to twice, so the console does the addressing and this row is the memory.

Nothing sends anything. The row is written when the message is asked for,
which is the moment an operator is about to paste it.
"""

from django.db import models


class Outreach(models.Model):
    name = models.CharField(max_length=120)
    #: Where they were found. Optional, and never fetched by anything here.
    url = models.URLField(max_length=300, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "outreach"
        ordering = ("-created_at", "-id")

    def __str__(self) -> str:
        return self.name
