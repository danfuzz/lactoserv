Changelog
=========

**Note:** Version numbers for _stable_ (so marked) releases follow semantic
versioning principles. Unstable releases do not.

### [Unreleased]

Breaking changes:
* Tweaked the contract of `contentType` bindings in configurations, to help
  avoid ambiguity and confusion. Specifically, file extensions now need to start
  with a dot.

Other notable changes:
* Expanded `MimeTypes` to handle character set stuff.

###  v0.6.5 -- 2024-02-09

Breaking changes:
* None.

Other notable changes:
* Added a new "quick start" guide, with runnable example code. Find it here:
  <https://github.com/danfuzz/lactoserv/blob/main/doc/quick-start.md>
* `StaticFiles`: Fixed a bug which made all not-found requests end up throwing
  an error (which would get caught and turned into a default not-found
  response). Oopsie!

### v0.6.4 -- 2024-02-08

Breaking changes:
* Renamed `app-*` modules to `sys-*`, to avoid name confusion (because the
  overall _system_ already has bits inside it called _applications_).
* Renamed module `network-protocol` to `net-protocol`, to harmonize with
  `net-util` (and `node:net`).
* Expanded and reworked `fs-util`, including moving the utility class
  `sys-config.Files` to `fs-util.Paths`.
* Time stuff, which affects both APIs and configuration:
  * Settled on `sec` (not `secs`) when identifying numbers of seconds.
  * Changed almost all time-related variables and parameters to be instances of
   `Moment` or `Duration` instead of dimensionless `number`s.
* Removed automatic ETag generation as part of the `Request` API. Removed all
  uses of the old (and mildly problematic) `etag` npm package.

Other notable changes:
* New class `EtagGenerator`, for generating ETags. Added configuration options
  to `StaticFiles` and `SimpleResponse` to (optionally) use it.

### v0.6.3 -- 2024-02-02

Breaking changes:
* We now require at least Node v20. This is so we can use the new-ish regex flag
  `/v` ("Unicode Sets").
* `Request` class:
  * Split off `sendNoBodyResponse()` from `sendContent()`, and made the latter
    take separate `body` and `contentType` arguments instead of those being
    part of the `options`.
  * Reworked `sendError()` into `sendMetaResponse()`, giving it both a
    somewhat-wider purview along with the ability to control response headers.
    Relatedly, tweaked the other non-content response methods to accept an
    options object.
  * Changed `.protocolName` to actually be the protocol name (and not just a
    guess based on the port number).
* Changed `HostInfo` to do its port-defaulting based on a port number (instead
  of a "protocol").
* Revised the plaintext request log format.

Other notable changes:
* Added support for sending and receiving cookies.
* Fixed `Range` request edge cases.
* Expanded the `net-util` package with a bunch of HTTP-related stuff.
* Notice promptly when clients drop connections, instead of letting them time
  out (and end up getting a write-after-close error).
* Cleaned up the request logging code, including details of what lands in the
  system log.

### v0.6.2 -- 2024-01-22

Breaking changes:
* Renamed most `url`-named properties on `Request` to instead use the term
  `target`. This represents a divergence from Node, which confusingly uses the
  property name `url` to refer to an HTTP(ish) request target, even though it
  isn't actually ever a URL per se except when the server is being called as a
  proxy (and not just a regular webserver).

Other notable changes:
* Fixed handling of non-`origin` request targets. Before v0.6.1, these were
  treated as if they were `origin` requests (that is, the usual kind that
  specify a resource path), and in v0.6.1 they started causing crashes. Now,
  they're properly classified and (by and large) rejected with an error reported
  to clients.

### v0.6.1 -- 2024-01-19

Breaking changes:
* Changed interface of `BaseApplication` to use `Request` and `DispatchInfo`
  (see below). This breaks downstream clients of this codebase.

Other notable changes:
* Added new application `SimpleResponse`, which is kind of like a one-file
  `StaticFiles`.
* Introduced a `Request` class specific to this project, instead of just
  "absorbing" Express's `Request` and `Response` objects. Our `Request` holds
  both the underlying request and response (and other related goodies). For now,
  the underlying Express bits are exposed to clients, but the intention is for
  them to get hidden and for this project's API to be sufficient.
* Relatedly, introduced new class `DispatchInfo`, to hold information about a
  request dispatch-in-progress (i.e., routing information, more or less). In
  Express, the equivalent state is represented by mutating the request object,
  but we're an immutable-forward shop here.
* Got rid of direct uses of Express's `Request` and `Response` classes, other
  than within _our_ `Request`. Most notably, the request logging code got a
  major rewrite.
* Reworked _most_ of the code in our `Request` class that does
  actually-Express-specific stuff, to instead do approximately what Express
  does, or just not do it at all. Notably, we no longer try to deal with reverse
  proxies; support will probably be added for them eventually (assuming demand).
* Reworked `StaticFiles` to use our `Request` instead of wrapping
  `express.static()`.

### v0.6.0 -- 2023-12-29

Breaking changes:
* None.

Other notable changes:
* Now willing to run in Node v21, though not yet heavily tested with it.

### v0.5.20 -- 2023-12-15 -- stable release

Breaking changes:
* None.

Other notable changes:
* Extracted base class `BaseSystem` from `UsualSystem`, to help avoid code
  duplication in downstream projects.
* Added ability to make hostnames use automatically-generated self-signed
  certificates.
* A bunch of cleanup / rationalization around the configuration code, especially
  with hostname and IP address parsing.
* Pulled in improved `bashy-lib`, and adjusted accordingly.

### v0.5.19 -- 2023-12-04

Breaking changes:
* None. This is a build-only change. The built artifacts should remain the same.

Other notable changes:
* Pulled in improved `bashy-lib`, and adjusted accordingly.

### v0.5.18 -- 2023-11-02

Breaking changes:
* None. Though there have been no intentionally-meaningful code changes, please
  note that the ESLint update (see below) _did_ require some code tweakage.

Other notable changes:
* Lint:
  * Updated to latest ESLint. Adjusted comments and code accordingly.
  * Un-janked how the linter gets built. It's now built using the same mechanism
    as the main application build.
* Testing: As with the linter, un-janked how it gets built.

### v0.5.17 -- 2023-10-30

Breaking changes:
* None. This is a build-only change. The built artifacts should remain the same.

Other notable changes:
* Updated automated build to use Node 20.
* Pulled in improved `bashy-lib`, and adjusted accordingly.

### v0.5.16 -- 2023-09-26

This is a build-only change. The built artifacts should remain the same.

Notable changes:
* Pulled in improved `bashy-lib`, and adjusted accordingly.

### v0.5.15 -- 2023-08-23

Notable changes:
* Pulled in improved `bashy-lib`, and adjusted accordingly. This is a build-only
  change. The built artifacts should remain the same.

### v0.5.14 -- 2023-06-01

Notable changes:
* Pulled in improved `bashy-lib`, and adjusted accordingly.

### v0.5.13 -- 2023-05-09

Notable changes:

* Somewhat better error checking on startup.
* Build infrastructure update:
  * Introduced use of `package-lock.json`.
  * Pulled in improved `bashy-lib`.

### v0.5.12 -- 2023-05-02

Notable changes:

* Officially support Node v20.
* Major build infrastructure update (new `bashy-lib`, new ESLint version).

### v0.5.11 -- 2023-04-18

Notable changes:

* Fixed a promise-related leak introduced in the fix for the FD-socket-reload
  issue.

### v0.5.10 -- 2023-04-17

Notable changes:

* Fixed heap snapshotting, which hadn't gotten adjusted to track event system
  changes that had been made in v0.5.9.

### v0.5.9 -- 2023-04-05

Notable changes:

* During reload (e.g. `kill -HUP`), endpoint sockets (server sockets) are no
  longer immediately closed. Instead, they're held open for several seconds, and
  the reloaded configuration is given an opportunity to take them over. This
  makes it possible for endpoints that use incoming FDs to actually be reloaded.
* New service `MemoryMonitor`, to induce graceful shutdown if memory usage goes
  beyond defined limits, with an optional grace period to ignore transient
  spikes.

### v0.5.8 -- 2023-03-29

Notable changes:

* Address a memory leak in the new "safe `race()`" (which was slightly less safe
  than expected).
* Work around a V8 memory leak that shows up when you attach a debugger.

### v0.5.7 -- 2023-03-23

Notable changes:

* Address a memory leak by replacing V8's buggy (specifically, leaky)
  `Promise.race()` implementation.
* Rework how process info files get handled. They now operate more like how
  log files do. Also, fixed a few bugs in the related code.

### v0.5.6 -- 2023-03-21

Notable changes:

* A more holistic attempt at doing socket timeouts.

### v0.5.5 -- 2023-03-20

Notable changes:

* Tweaked timeouts for HTTP2 connections, in the hopes of working around an
  apparent HTTP2-related memory leak in the Node core library. This is
  [issue #42710](https://github.com/nodejs/node/issues/42710) in the Node repo.

### v0.5.4 -- 2023-03-10

Notable changes:

* Nothing really; just minor fixes.

### v0.5.3 -- 2023-03-07

Notable changes:

* Fixed logging of network interfaces specified via the `/dev/fd/N` syntax.
* Added a bunch of stuff, mostly `systemd`-related, to the deployment guide.

### v0.5.2 -- 2023-03-03

Notable changes:

* Change endpoint interface/port config form, to make it a little more
  convenient in general and to add a way to specify FDs.

### v0.5.1 -- 2023-03-02

Notable changes:

* Fix crash when presented with an invalid name during SNI.
* Fix a bunch of IP address and DNS name parsing deficiencies.

### v0.5.0 -- 2023-03-01

Notable changes:

* Stabilize the config file format (_mostly_ at least).
* Document the config file format, including builtin apps and services.

### v0.4.3 -- 2023-02-27

Notable changes:

* Add date/time classes to the `data-values` module, and clean things up a bit
  in it, in support of nicer system logging.
* Clean up system log record generation.
* Update license in anticipation of public release.

### v0.4.2 -- 2023-02-14

Notable changes:

* Cleaned up / DRYed out a bunch of framework code.
* Implemented the long-intended path-specificity application dispatch logic.

### v0.4.1 -- 2023-02-13

Notable changes:

* Framework rework, in support of (eventual) non-built-in apps and services.

### v0.4.0 -- 2023-02-12

* First explicitly-planned (pre-)release!
