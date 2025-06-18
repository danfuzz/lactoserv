Changelog: Recent Changes
=========================

See also:
* [Old Changelogs](./doc/old-changelogs)
* [Stable Releases](./RELEASES.md)

**Note:** Version numbers for _stable_ (so marked) releases follow semantic
versioning principles. Unstable releases do not.

### [Unreleased]

Breaking changes:
* None.

Other notable changes:
* None.

### v0.9.3 -- 2025-06-18

Breaking changes:
* None.

Other notable changes:
* New class `net-util.JsonUtil`, with just one method... so far.
* Got CI set up to build and test with multiple versions of Node. As currently
  configured, it uses Node v20, v22, and v24.

### v0.9.2 -- 2025-05-08 -- stable release

Breaking changes:
* None.

Other notable changes:
* Updated allowed Node versions.

### v0.9.1 -- 2025-03-26

Breaking changes:
* `net-util`:
  * Made hostname canonicalization always include both lowercasing of DNS names
    and removal of brackets around IPv6 addresses.
  * `HostInfo`:
    * As a result of the change to canonicalization (above), removed the method
      `toLowerCase()`.
* `webapp-builtins`:
  * Removed `ignoreCase` option from `HostRouter`, because per RFC one is never
    supposed to treat hostname case as significant.

Other notable changes:
* `net-util`:
  * Expanded the functionality of `HostInfo`.
* `valvis`:
  * `BaseValueVisitor`:
    * New `static` convenience methods to cover a common use pattern.
    * Extracted the `inspect`-ish helper methods into their own class,
      `Inspecty`.

### v0.9.0 -- 2025-02-04

Breaking changes:
* framework API (general):
  * Defined a new `*ElseNull()` method naming convention, to use instead of
    `*OrNull*()`, clarifying the contexts in which each is appropriate.
  * Reworked method naming convention for type/value-checking methods to be
    `mustBe*()`, instead of using either `expect*()` or `check*()`.
  * As a result of the above, renamed a bunch of methods throughout the system.

Other notable changes:
* `net-util`:
  * Now recognize `EC PRIVATE KEY` as a label in PEM files for private keys.
* `webapp-builtins`:
  * `StaticFiles`: Added `indexFile` configuration option.
* `webapp-util`:
  * New class `StaticFileResponder`, extracted from
    `webapp-builtins.StaticFiles`.

### v0.8.6 -- 2025-01-06 -- stable release

Breaking changes:
* `compy`:
  * `BaseComponent`: Renamed `CONFIG_CLASS` to `configClass`.

Other notable changes:
* `loggy-intf`:
  * `LoggyIntf`: New static methods `expectInstance()` and
    `expectInstanceOrNull()`, to avoid more ad-hoc checks.
