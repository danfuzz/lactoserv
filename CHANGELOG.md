Changelog
=========

**Note:** Version numbers for _stable_ (so marked) releases follow semantic
versioning principles. Unstable releases do not.

### [Unreleased]

Breaking changes:
* `compote` / `sys-config` / `sys-framework`:
  * Extracted the lower layer of classes from `sys-config` and `sys-framework`
    into new module `compote`. Renamed the classes for better harmony, extracted
    a new interface `IntfComponent`, and generally improved the ergonomics of
    the exported API.

Other notable changes:
* `sys-framework`:
  * Made it possible to pass application and service _instances_ into the
   `Warehouse` constructor, instead of having to pass plain objects in. This
   makes for much nicer ergonomics when using the system as a framework.

### v0.6.12 -- 2024-03-28

Breaking changes:
* `collections`:
  * Removed net-related `TreePathKey` methods (rendering as URI paths and
    hostname strings).
  * Made `TreePathKey.toString()` less "net-centric" by default.
  * Added new method `TreePathMap.findWithFallback()` to replace `find()` with
    `wantNextChain == true`. Removed the second argument from `find()`.
* `net-util`:
  * Major rework of `IncomingRequest`, so it no longer has to be constructed
    from a low-level Node request object.
  * Split `Uris` into two classes, `UriUtil` and `HostUtil`.
  * Pulled `uriPathStringFrom()` from `TreePathKey` into `UriUtil`, renaming it
    to `pathStringFrom()` and tweaking its contract.
  * Pulled `hostnameStringFrom()` from `TreePathKey` into `HostUtil`.
  * Replaced `DispatchInfo.{base,extra}String` properties with a single combined
    property `infoForLog`, which avoids an "attractive nuisance" with the old
    scheme (which in fact caused a bug).
  * In harmony, renamed method `IncomingRequest.getLoggableRequestInfo()` to
    property `infoForLog`.
  * Likewise, renamed `OutgoingResponse.getLoggableResponseInfo()` to
    `getInfoForLog()` (still a method because it needs arguments).
* `sys-framework`:
  * Renamed filter config `maxPathLength` to `maxPathDepth`, and made a new
    `maxPathLength` which filters based on the octet count of a path.

Other notable changes:
* Documentation comments:
  * Cleaned up a bunch of JSDoc syntax problems. Notably, the type definitions
    of non-method class properties was very wrong.
  * Did a comment reflow pass over all the code, using a newly-written utility.
    Tidy code is happy code!

### v0.6.11 -- 2024-03-22

Breaking changes:
* `built-ins`:
  * Merged all the built-in applications and services into a unified module
    called `built-ins`.
  * Changed default `acceptMethods` in `Redirector` to be more sensible.
* Configuration:
  * Stopped using a component registry to find applications and services.
    Instead, just let the (Node / JavaScript) module system be that. Simplifies
    a lot of stuff! (Doing this had become possible once the configuration file
    loader was expanded to allow access to framework classes.)
  * Dropped application mounting / routing setup from the endpoint
    configuration. Instead of `mounts`, the endpoint configuration just takes a
    single application name, for the application which is to handle all
    requests. If routing is needed, routing applications are now available; but
    if not, there's no longer a performance penalty to do what amount to no-op
    lookups.
* `sys-framework`:
  * Reworked `BaseApplication` configuration `acceptQueries` to instead be
    `maxQueryLength` (and all that the name change implies).
  * Added new class `ControlContext`, which gets associated with each concrete
    instance of `BaseControllable` (the superclass of all app and service
    classes, among other things). This is now where an instance's `logger` is
    found, and it also keeps track of the parent/child relationships between
    instances. This will _eventually_ be the key mechanism for treating a set of
    components holistically in a reasonably general way. (Right now there's a
    lot of ad-hoc arrangement.)
  * Added related new class `RootControlContext`, a subclass of `ControlContext`
    which specifically represents the root of a hierarchy.
  * Added new lifecycle method `init()` (and abstract implementation method
    `_impl_init()`) to `BaseControllable`, which is where the above contexts get
    hooked up.

Other notable changes:
* Got rid of `lodash` as a dependency.
* Logging:
  * Dropped `framework` as the top-level logging tag from "cohorts" of items,
    such as "applications" and "services."
  * Added ANSI coloring / styling to the "human" (non-JSON) logs that go to
    `stdout`, when it's a TTY.
  * Fixed request logging so that it gets a more accurate (earlier) start time
    for requests.
* `built-ins`:
  * New class `SerialRouter`, which does "classic" linear-order routing to
    a list of applications.
  * New class `HostRouter` which does what you probably expect from the name.
  * Likewise, new class `PathRouter`. This and its buddies are the replacements
    for the routing implementation that used to be baked into `EndpointManager`.
  * Added `statusCode` configuration to `SimpleResponse`. Notably, it can now be
    used to define simple `404` responses.

### v0.6.10 -- 2024-03-15

It's Fast(ish) Follow Friday!

Breaking changes:
* Request logging: Stopped quoting URLs, as there was no need. (They won't have
  spaces or non-ASCII in them, as they are logged in url-encoded form.)

Other notable changes:
* Development:
  * `build` script renamed to `dev`, and merged `run` into it.
  * Testing:
    * Simplified how the unit tests get set up and run.
    * Got coverage reporting to work.
  * Linting:
    * Added `lint` target to `dev` (see above), and removed the separate `lint`
      script.
    * Switched to the modern ESLint "flat" configuration format. (It was a pain
      in the butt.)
    * Enabled some rules that weren't on before, and tweaked a couple others.
      Fixed a couple dozen or so errors that got reported as a result.
* Logging:
  * Squelched some of the less interesting error spew (e.g., don't bother
    printing stack traces when the HTTP parser encounters invalid network
    input).

### v0.6.9 -- 2024-03-12

Breaking changes:
* `clocks`:
  * New module!
  * Moved time-related classes to here from `metacomp`.
  * New class `WallClock`, extracted from `StdLoggingEnvironment`, so that other
    stuff can get sub-msec wall times.
* `loggy`, `loggy-intf`:
  * Split out the more "interfacey" bits of `loggy` into a new module.
  * Extracted `IntfLoggingEnvironment` as the interface for
    `BaseLoggingEnvironment`.

Other notable changes:
* `builtin-services`:
  * `RequestLogger` now logs sub-msec request durations.
* `net-util`, `builtin-services`:
  * `OutgoingResponse`:
    * Changed `getLoggableResponseInfo()` to report errors (if any) on all the
      stream-like things it can get ahold of.
    * Fixed `#whenResponseDone()` to promptly return once the response is
      actually done.
    * In `#whenResponseDone()` added detail when it would otherwise try to
      double-resolve its "when-completed" promise. This seems to be happening
      in production, specifically when an `error` event is getting emitted by a
      socket _after_ it has already emitted `close`.
  * Added a bit of logic to `RateLimitedStream` to try to hew more closely to
    the Node Streams API, specifically _not_ attempting to do anything that
    would cause an `error` event to be emitted after a `close` event. The Node
    core library arguably _should_ be preventing this from happening, but
    _maybe_ it isn't.
* Spring cleaning: Perhaps inspired by the semi-annual DST switch, did a
  consistency pass around timing-related functionality.
* Configuration:
  * Add support to `import` project modules from configuration files via module
    names of the form `@lactoserv/<name>`.
  * Stop loading configuration files in separate VM contexts. Doing this _would_
    be a decent idea if inter-context "communication" were seamless, but it's
    not.

### v0.6.8 -- 2024-03-05

This is the first release where Express is _not_ a project dependency. This
release also changes our framework to no longer have a "callback-style" model,
which has several benefits, including making the system much easier to test; no
mocking required! Relatedly, it makes the system easier to reason about (and
hence to debug). And it opens up some great possibilities for defining new
request flows, including a pattern where a request handler can be "wrapped" by
another one which gets a chance to replace (including effectively modify) the
response before bubbling it up further.

Breaking changes:
* `net-protocol` / `net-util`:
  * Moved `DispatchInfo`, `IntfRequestHandler`, and `Request` into `net-util`.
  * Renamed `Request` to `IncomingRequest`, for ease of search and to avoid a
    conflict with the Fetch API global `Request`.
  * Renamed `HttpResponse` to `OutgoingResponse` to harmonize with
    `IncomingRequest`.
  * `IncomingRequest`:
    * Changed the constructor of to take a `RequestContext` instead of a
      `WranglerContext` (the latter which is a private class in `net-protocol`).
    * Removed all the functionality related to responding.
  * Changed the `IntfRequestHandler` API so that the return value is the
    response to send, instead of expecting the handler to do the sending. That
    is, it no longer uses callbacks to send responses.

Other notable changes:
* `net-protocol`: Stopped using Express as a layer between the Node `http*`
    libraries and our application framework.
* `net-util`:
  * Removed the small amount of remaining Express-specific code.
  * New class `RequestContext`.
* `sys-framework` / `builtin-applications`: Added optional configuration of
  `BaseApplication` to filter out (not respond to) or redirect requests based on
  the incoming URI. Added this configuration to all of the built-in apps.

### v0.6.7 -- 2024-02-29

Breaking changes:
* Configuration:
  * Configurations that used to accept plain numbers as durations in seconds now
    instead take either duration strings that include a unit name (e.g.,
    `5 min`) _or_ instances of the class `data-values.Duration`.
  * Likewise, the `flowRate` for `RateLimiter` is now expected to be either a
    frequency string (e.g., `100 per hr` or `12/minute`) _or_ an instance of the
    class `data-values.Frequency`.
* `net-util`:
  * `MimeTypes` methods that return MIME type strings now have the option
    `charSet: 'utf-8'` by default, which is about the most sensible choice these
    days.
* `data-values`: Removed `Duration.parseSec()`, in the ongoing effort to use
  typed objects in preference to plain numbers.

Other notable changes:
* `data-values`:
  * New class `UnitQuantity`, which generalizes over things like `Duration`.
  * Reworked `Duration` to be a subclass of `UnitQuantity`.
  * New class `Frequency`, a subclass of `UnitQuantity`.
* Testing:
  * Moved to the latest version of Jest.
  * Confirmed that Jest's default test runner does in fact support modern ES
    modules, and so switched over to that from `jest-light-runner`. Notably,
    this means it should be much easier to get test coverage reports working.

### v0.6.6 -- 2024-02-18

This release represents a major step towards (a) switching away from a
callback-based control flow for the request/response cycle, and (b) dropping
Express as a dependency.

Breaking changes:
* Tweaked the contract of `contentType` bindings in configurations, to help
  avoid ambiguity and confusion. Specifically, file extensions now need to start
  with a dot.
* Significant rework of the API of `net-protocol.Request`.

Other notable changes:
* New integration test setup, along with a decent handful of tests.
* Module `net-util`:
  * Expanded `MimeTypes` to handle character set stuff.
  * Extracted new class `HttpConditional` from `net-protocol.Request`, and
    reworked it to no longer use the npm module `fresh`. It handles conditional
    request stuff, including for conditional ranges.
  * Extracted new class `HttpRange` from `net-protocol.Request`, for range
    request handling.
  * New class `HttpResponse` to encapsulate data required to make an HTTP(ish)
    response and to handle much of the mechanics of actually producing a
    response. Notably, it does _not_ use Express-specific functionality.
* Changed all the built-in applications to construct `HttpResponse` objects
  instead of using higher-level response methods on `Request`.
* Removed all of the response methods from `Request`, except for `respond()`
  which just takes an `HttpResponse`. Even that may go away at some point.

### v0.6.5 -- 2024-02-09

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
