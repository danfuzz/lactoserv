List of Releases
================

This is a list of stable releases of Lactoserv.

### Series lifecycle

A release series starts as a "development" series. _Some_ release series then
become "active" then "maintenance" and finally "retired."

Development release series are considered "unstable," in that no guarantees
are made with regards to forward or backward compatibility of such releases
within the series or between series. (That is, semantic versioning does not
apply to unstable releases.)

At some point, a development release series _might_ get a stable release. With
this stable release, the series becomes active, and semantic versioning applies
to it with regards to other _stable_ releases within and between series. And,
once a series becomes active, no further unstable releases are made to it.
(Should the stability guarantee turn out to be inadvertently violated, the
release in question will be withdrawn.)

Later, a new development release series may become active, at which point the
current active release series becomes a maintenance series. Maintenance series
only receive urgent new releases (e.g. to address security problems) and on a
best-effort basis at that. As an exception, the project developers are able to
make fixes to maintenance release series on a paid contract basis. (Send email
to inquire.)

Approximately a year after an maintenance release series's first stable release,
it transitions to retired. Retired series are not further developed (again, with
the possible exception of paid work).


## Active release series

* v0.8:
  * 2026-01-06: Scheduled for retirement
  * 2025-01-06: First stable release, v0.8.6
    * https://github.com/danfuzz/lactoserv/releases/tag/v0.8.6

## Maintenance release series

* v0.7:
  * 2025-06-04: Scheduled for retirement
  * 2025-01-06: Moved to maintenance
  * 2024-07-30: Released v0.7.8
  * 2024-06-04: First stable release, v0.7.6

* v0.6:
  * 2025-04-22: Scheduled for retirement
  * 2024-06-04: Moved to maintenance
  * 2024-04-22: First stable release, v0.6.16

## Retired release series

* v0.5:
  * 2024-12-15: Retired
  * 2024-04-22: Moved to maintenance
  * 2023-12-15: First stable release, v0.5.20
