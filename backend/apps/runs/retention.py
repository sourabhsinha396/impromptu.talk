"""Return rate, derived from the runs table.

This is the gate: day-2 and day-7 return are the numbers the roadmap
waits on. Analytics report this too, and will be easier to look at. This
exists anyway, for two reasons. It is what analytics get checked against;
a number nobody has reconciled against the database is a number nobody
should bet a roadmap on. And it keeps working when the browser does not:
an ad blocker or a failed script silently removes people from analytics,
and every one of them is still a row here.

Days are UTC. Streaks use the visitor's own local day, but a cohort is a
population rather than a person, and mixing offsets into one would make
the denominator depend on where people happened to be standing.
"""

import datetime as dt
from dataclasses import dataclass

from apps.runs.models import Run


@dataclass(frozen=True)
class Cohort:
    """One measurement over every cohort old enough to count. `label` is
    carried rather than derived because the two measurements are not the
    same shape, one an exact day and the other a window."""

    label: str
    devices: int
    returned: int

    @property
    def rate(self) -> float:
        return self.returned / self.devices if self.devices else 0.0

    def __str__(self) -> str:
        if not self.devices:
            return f"{self.label}: no cohort old enough yet"
        return f"{self.label}: {self.rate:.1%} ({self.returned}/{self.devices} devices)"


def days_by_device() -> dict[str, set[dt.date]]:
    """Every device and the UTC dates it ran on."""
    out: dict[str, set[dt.date]] = {}
    for did, created in Run.objects.values_list("device_id", "created_at"):
        out.setdefault(did, set()).add(created.astimezone(dt.UTC).date())
    return out


def cohort_return(day_offset: int, *, today: dt.date | None = None) -> Cohort:
    """Devices that came back exactly `day_offset` days after their first
    run; 1 is day-2 return in the usual sense. Only cohorts whose window
    has fully elapsed count: someone who arrived this morning has not
    failed to return tomorrow, they have not been asked yet, and letting
    them into the denominator is the standard way to make a retention
    number look worse than it is."""
    today = today or dt.datetime.now(dt.UTC).date()
    devices = returned = 0
    for days in days_by_device().values():
        target = min(days) + dt.timedelta(days=day_offset)
        if target > today:
            continue
        devices += 1
        if target in days:
            returned += 1
    return Cohort(label=f"day-{day_offset + 1} return", devices=devices, returned=returned)


def returned_within(days: int, *, today: dt.date | None = None) -> Cohort:
    """Devices that came back at all in the `days` after their first run.
    Kinder than the exact day and worth watching beside it: Monday and
    Thursday is a returning person by any reasonable reading."""
    today = today or dt.datetime.now(dt.UTC).date()
    devices = returned = 0
    for day_set in days_by_device().values():
        first = min(day_set)
        if first + dt.timedelta(days=days) > today:
            continue
        devices += 1
        if day_set & {first + dt.timedelta(days=n) for n in range(1, days + 1)}:
            returned += 1
    return Cohort(label=f"within {days} days", devices=devices, returned=returned)


def report() -> str:
    """The gate, in four lines."""
    by_device = days_by_device()
    return "\n".join(
        [
            f"devices: {len(by_device)}   runs: {Run.objects.count()}",
            str(cohort_return(1)),
            str(cohort_return(6)),
            str(returned_within(7)),
        ]
    )
