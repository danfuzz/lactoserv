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
* general:
  * Allow node version 23.
* `loggy-intf` / `loggy`:
  * Made several improvements to "human" (non-JSON) log rendering.
* `structy`:
  * Started allowing any object (plain or not) to be used as the argument to the
    `BaseStruct` constructor.
  * Added the option to allow undeclared properties to be allowed and
    dynamically vetted, via two additional `_impl*` methods.
* `valvis`:
  * `BaseValueVisitor`:
    * Simplified detection of reference cycles.
    * Added argument `isCycleHead` to `_impl_shouldRef()`, so client code can
      choose to be more cycle-aware.
* `webapp-builtins`:
  * Simplified naming scheme for preserved log files: Names now always include
    a `-<num>` suffix after the date.

### v0.8.3 -- 2024-11-07

Breaking changes:
* `sexp` (was `decon`):
  * Renamed module to `sexp`. The old name arguably had the wrong emphasis.
  * Added `forLogging` argument to `IntfDeconstructable.deconstruct()`.
* `quant`:
  * Changed concrete classes to only add human-oriented bits to deconstructed
    results when passed `forLogging === true` (see above).
  * Reworked the `toString()` options of `Moment`.
* `valvis`:
  * `BaseValueVisitor`:
    * Renamed some methods, for clarity and consistency.
    * New method `visitWrap()`, which has the same "synchronous if possible but
      async if not" behavior that is used internally.
    * Reworked (the renamed) `_prot_visitWrap()` to have more consistent
      behavior.
    * New method `_prot_visitSync()` to parallel the analogous public method
      `visitSync()`.
  * Reworked `VisitDef` and `VisitRef` to not assume an associated visitor
    instance. This makes them usable in more situations.
* `loggy-intf` / `loggy`:
  * Changed "human" (non-JSON) logs to just emit a "seconds-only" timestamp on
    each logged event, while adding a full timestamp as a header of sorts no
    more than once per minute. This makes for more available console width for
    the logged payloads, aiding log readability.
  * Started passing `forLogging` as `true` when calling
    `IntfDeconstructable.deconstruct()` (see above).
* `structy`:
  * Changed the default property-checker method prefix from `_struct_` to
    `_prop_`.
* `webapp-builtins`:
  * Added `ignoreCase` option to `HostRouter`, which defaults to `true`. (This
    is a breaking change because it never used to ignore case, which was
    surprising in terms of usual webserver expectations.)

Other notable changes:
* `loggy-intf` / `loggy`:
  * Improved "human" (non-JSON) rendering of arrays, symbols, bigints,
    `undefined`, and `null`.

### v0.8.2 -- 2024-10-25

Breaking changes:
* `valvis`, `decon`, `util`, and `codec`:
  * New module `valvis` ("VALue VISitor"), derived from `codec`:
    * New class `BaseValueVisitor`, along with a couple helper classes. This is
      an implementation of the "visitor" pattern to iterate over arbitrary
      JavaScript object graphs. It was extracted from the `codec` encoding code,
      and made more general.
    * Merged in the contents of `util` (one class).
    * Tweaked `StackTrace`, to make it not rely on the `codec` interfaces / base
      classes.
  * New module `decon`, derived from `codec`:
    * New class `IntfDeconstructable` which replaces `codec.BaseCodec.ENCODE`.
    * Pulled in `Sexp` from `codec`, with tweakage.
  * Deleted the remainder of `codec`. Farewell!
* `loggy-intf` / `loggy`:
  * Removed `IntfLoggingEnviroment.logPayload()`.
  * New class `LoggedValueEncoder`, which replaces the log-related stuff in
    `codec`.
  * Made the system logs written to stdout be a bit more colorful and a _lot_
    more readable.
* `texty`: Renamed this module from `text`.

Other notable changes:
* `texty`:
  * Added a bunch of new classes to help with structured text rendering (such as
    for logs).
* `webapp-util`:
  * Fixed `Rotator` and `Saver` to not bother "preserving" empty files.

### v0.8.1 -- 2024-09-26

Breaking changes:
* `data-values`: This module was effectively several different modules in a
  trench coat. It has now been retired, with its former contents now in four new
  modules:
  * `codec`: value encoding / decoding.
  * `quant`: unit quantity classes, plus wall-time representation.
  * `structy`: struct-like class definition.
  * `util`: miscellaneous utilities (with just one class, `ErrorUtil`, at least
    for now).

Other notable changes:
* `async`: Minor fixes of problems discovered while addressing a couple of unit
  test coverage oversights.
* `net-util`: New class `Base64Url`.
* Pulled in new version of sibling project Bashy-lib.
  * Made various fixes that became evident with the new version of
  * `node-project lint`.

### v0.8.0 -- 2024-08-08

Breaking changes:
* `net-util`:
  * `IncomingRequest.fromNodeRequest()` is now an `async` method, and its final
    argument is now a catch-all `options`. ("If a function has more than two
    arguments, you haven't yet discovered all of them." --Unknown)

Other notable changes:
* `net-util`:
  * `IncomingRequest`:
    * Added `body` constructor option.
    * Made it start rejecting requests whose request method (e.g. `GET`) isn't
      defined to take a request body but where the request actually does have a
      body.
    * Fixed `getHeaderOrNull()`, which had been broken for a while.
    * `fromNodeRequest()` now reads the request body when present, and returns
      it in the constructed instance.
  * Defined a base class, `BaseResponse` for the two concrete response classes.
  * Added a handful of static getters to `StatusResponse`.
  * Various other tweaks and fixes, motivated by a downstream project.
* `webapp-builtins`:
  * Make `StaticFiles` and `SimpleResponse` only respond successfully to `GET`
    and `HEAD` requests.
* `webapp-core` / config:
  * Added `NetworkEndpoint` configuration `maxRequestBodySize`.

### v0.7.8 -- 2024-07-30 -- stable release

Breaking changes:
* None.

Other notable changes:
* Updated npm-origined dependencies for the unit test framework, motivated by a
  vulnerability report.
* `StaticFiles`: Notice when the `notFoundPath` file gets changed, instead of
  only ever setting up the not-found response during system startup.

### v0.7.7 -- 2024-06-24 -- stable release

Breaking changes:
* None.

Other notable changes:
* configuration:
  * For all rate-limiter components, exposed the pre-existing underlying token
    bucket option `initialBurst`.

### v0.7.6 -- 2024-06-04 -- stable release

Summer stability! This is the first stable release of the v0.7.* series. The
current plan is to let v0.7.* be the main release series for the next several
months, letting downstream projects use it more or less as-is for a while... and
offer feedback, if they are so inspired, to help drive the next major round of
development.

Breaking changes:
* None.

Other notable changes:
* `net-util`:
  * Minor fixes to hostname / IP address parsing.
* `webapp-core`:
  * Exported `NetworkHost`, which was supposed to have been public since day
    one.
* testing:
  * Added more unit tests.
  * Fixed a handful of bugs that cropped up from the effort (all minor).

### v0.7.5 -- 2024-05-30

Is it stable? Assuming no major problems in the next week or so, the next
release will be a nearly-no-changes one and will be declared the first stable
release of the v0.7.* series.

Breaking changes:
* framework development:
  * Moved testing-related module exports into submodules named `<name>/testing`.

Other notable changes:
* testing:
  * Added more unit tests.
  * Fixed a handful of bugs that cropped up from the effort (all minor).

### v0.7.4 -- 2024-05-22

Breaking changes:
* None.

Other notable changes:
* `net-util`:
  * Found a major problem with the `pem` module (one of our few direct
    dependencies). Replaced it with `selfsigned`, which -- bonus! -- unlike
    `pem` does not rely on an OS-installed OpenSSL, thereby simplifying our
    installation requirements.
* testing: Added more unit tests.

### v0.7.3 -- 2024-05-16

Breaking changes:
* `data-values`:
  * Made it so that all instances of `BaseStruct` are frozen. This had been
    intended all along, but was overlooked in the implementation until now.
* `metacomp`:
  * Distilled all the static `make*Proxy()` methods on `BaseProxyHandler` down
    to just a single options-taking `makeProxy()`.

Other notable changes:
* Stopped complaining if run with Node v22.
* configuration / `webapp-builtins`:
  * Added `dispatchLogging` configuration to `endpoint` entries (class
    `NetworkEndpoint`).
  * `DataRateLimiter`: Added `verboseLogging` option, off by default, to make it
    possible to log the major stuff without getting a lot of `writing(1234)`
    type messages.
  * `PathRouter`: Made it possible to cut off fallback search by explicitly
     binding a path to `null`.
* `compy`:
  * New method `BaseComponent._prot_addAll()`, for multiple children.
  * Made it possible for a component to add children before it is initialized.
* `data-values`:
  * Add to `Converter` the ability to configure how to encode proxies.
* testing:
  * With apologies to Goodhart's Law... Wrote a bunch of unit tests to cover
    notable gaps, based on the coverage report.

### v0.7.2 -- 2024-05-08

This release contains most (if not all) of the breaking changes when using the
system as a framework (i.e., building an app and not just running a static web
server) that are currently anticipated for the v0.7.* release series. The hope
is that v0.7.* will reach stability relatively soon.

Breaking changes:
* configuration / `webapp-builtins`:
  * Changed `MemoryMonitor` to use `ByteCount`s for the limit configuration.
  * Changed the file rotation / preservation configurations that had been plain
    numbers to instead be `ByteCount`s.
* `compy`:
  * Reworked how component classes define their configuration properties, to
    be way more ergonomic, avoiding a lot of formerly-required boilerplate and
    adding a modicum of error checking that all components get "for free."
    **Note:** While this is a breaking change for how components are built, it
    doesn't affect how components are instantiated. For example, this doesn't
    make you change your standalone config files.
  * Similarly, reworked the component lifecycle methods to all be "must call
    `super`" instead of the former "must _not_ call `super`" style. The latter
    stopped making sense with the introduction of the template mixin classes.
  * New base class `BaseRootComponent` to be the superclass for root components.
  * Switched a few classes from _base_ classes to _template_ classes:
    * `BaseThreadComponent` -> `TemplThreadComponent`.
    * `BaseAggregateComponent` -> `TemplAggregateComponent`.
    * `BaseWrappedHierarchy` -> `TemplWrappedHierarchy`.
  * New exported classes to help with testing: `MockComponent` and
    `MockRootComponent`.
* `data-values`:
  * Renamed `Struct` -> `Sexp`, because it's really this project's version of
    the "sexp" concept. And for similar reasons, renamed the `type` field of it
    to `functor`. This rename also makes room for the new `Struct`-y thing.
  * Moved `BaseConfig` here from `compy`.
  * New class `BaseStruct`, extracted from `BaseConfig`, because _most_ of what
    `BaseConfig` did was not particularly specific to configuration, per se.

Other notable changes:
* configuration:
  * New top-level (`WebappRoot`) configuration `logging`, to do fine-grained
    control over which components produce system logs.
  * New per-application and per-service configuration `dispatchLogging` to
    specifically enable/disable dispatch-related logging. These logs can be
    very chatty, and only rarely useful (though not totally useless).
* `compy`:
  * Fixed bug in `BaseComponent.CONFIG_CLASS` which caused it to sometimes
    call base classes' `_impl_configClass()` multiple times (which isn't
    supposed to happen, ever).
* `webapp-builtins`:
  * Took advantage of `TemplThreadComponent` in a few classes that could use it,
    now that it's a template (and not a direct subclass of `BaseComponent`).

### v0.7.1 -- 2024-05-01

This release contains most (if not all) of the breaking changes to standalone
configuration that are currently anticipated for the v0.7.* release series.

**Note:** v0.7.0 wasn't announced widely, because it was mostly just a clone
of v0.6.16.

Breaking changes:
* configuration / `webapp-builtins`:
  * Totally reworked rate limiting. There is now a separate class per thing that
    can be rate-limited -- `ConnectionRateLimiter`, `DataRateLimiter`, and
    `RequestRateLimiter` -- and configuration uses unit quantity classes for all
    the token bucket stuff.
* `async` / `webapp-util`:
  * Moved `TokenBucket` from `async` to `webapp-util`. It _was_ the only
    not-particularly-simple class in `async`, and its placement in that module
    had become the source of a module dependency cycle.
  * Renamed `IntfThreadlike` to `IntfThread`.
  * Made `EventSink` implement `IntfThread`.
* `clocky` / `clocks`:
  * Renamed module to `clocky`, to harmonize with the other `*y` modules.
* `collections`:
  * Renamed classes to be more sensible: `TreePathMap` -> `TreeMap`, and
    `TreePathKey` -> `PathKey`.
* `data-values`:
  * Filled out the comparison methods in `Moment`, and made them match the ones
    added to `UnitQuantity` (see below).
  * Reworked `UnitQuantity.parse()`, with much more straightforward
    functionality, including the addition of optional unit conversions.
* `loggy-intf`:
  * Removed `FormatUtils.byteStringFrom()` in favor of
    `ByteCount.stringFromByteCount()` (see below).

Other notable changes:
* `clocky`:
  * Added `waitFor()` to the interface `IntfTimeSource`.
  * Extracted `MockTimeSource` from `TokenBucket.test.js`, for use throughout
    the system.
* `compy`:
  * New classes `BaseWrappedHierarchy` and `BaseThreadComponent`.
* `data-values`:
  * Added comparison methods to `UnitQuantity`.
  * New classes `ByteCount` and `ByteRate`, both unit quantities.
* `webapp-builtins`:
  * New applications `RequestDelay` and `SuffixRouter`.

### v0.7.0 -- 2024-04-22

This is the same source tree as v0.6.16, other than the version strings and the
CHANGELOG file.

Breaking changes:
* None.

Other notable changes:
* None.

### v0.6.16 -- 2024-04-22 -- stable release

First stable release of the v0.6.* series.

Breaking changes:
* None.

Other notable changes:
* `compy`: Tiny bit of cleanup in `BaseComponent`.

### v0.6.15 -- 2024-04-17

Are we there yet?: This release will _probably_ be declared stable, unless
something surprising (and unfortunate) happens within a couple days of its
release.

Breaking changes:
* `compy` / `compote`:
  * Renamed module `compote` to `compy`, to harmonize with `loggy` and `typey`.
  * Combined all the config base classes into the base-base class `BaseConfig`.
    The other classes weren't really serving much of a purpose, and to the
    extent that they were, it didn't help that they were separate from the main
    base class.
  * The component hierarchy is now tracked as a unified `TreePathMap`, and
    `getComponent()` now takes absolute paths instead of simple names.
  * Got rid of the `isReload` argument to all the `init()` and `start()` (and
    related) methods.
  * Got rid of `IntfComponent` (merged its docs back into `BaseComponent`), as
    it only ever existed to break a circular dependency, but that was better
    achieved by using a forward-declaration `@typedef`.
* `host` / `webapp-util`:
  * Moved `BaseSystem` from `webapp-util` to `host`.
  * Reworked the `BaseSystem` subclass-implementation API to be a lot simpler.
    This was made possible by the recent work on the `compy` module.
  * Reworked `BaseSystem` to be a root component (not just some-random-object).

Other notable changes:
* `compy`:
  * New method `BaseComponent._prot_addChild()`, to simplify adding children.
  * New method `BaseComponent.whenStopped()`.
  * New abstract class `BaseAggregateComponent`, for components that _publicly_
    allow children to be added.
* `webapp-core`:
  * Used `BaseAggregateComponent` to simplify the classes that are in fact
    aggregate components.

### v0.6.14 -- 2024-04-11

Nearing stability: This _might_ (but will not necessarily) be the last unstable
release in the v0.6 series, before declaring v0.6 stable.

Breaking changes:
* `async`:
  * Reworked the `Threadlet` class to not expose its innards quite so much. As
    a result, the argument it passes to the thread "start" and "main" functions
    is now an object which has a handful of "just for the runners" methods, with
    said methods removed from the public API of `Threadlet` itself.
* `net-util`:
  * Renamed `OutgoingResponse` to `FullResponse`, to allow "semantic space" for
    `StatusResponse`.
* `webapp-*`:
  * Renamed the modules specifically concerned with webapp (web application)
    implementation to have the prefix `webapp-`:
    * `built-ins` -> `webapp-builtins`
    * `sys-framework` -> `webapp-core`
    * `sys-util` -> `webapp-util`
  * Renamed class `Warehouse` -- a name that @danfuzz never really liked -- to
    now be `WebappRoot`, which reflects both its high level role and the fact
    that it is the root component in its component hierarchy.
  * Removed the "filtering for free" behavior on `BaseApplication`. (See below.)

Other notable changes:
* `fs-util`:
  * New class `FileAppender`, which does a modicum of buffering. This is used to
    moderate filesystem calls when logging.
* `net-util`:
  * New class `StatusResponse`, to allow applications to indicate a response of
    _just_ a status code, letting the main protocol implementation fill it out
    as necessary.
  * New typedef `TypeOutgoingResponse`, which covers all valid response types.
* `webapp-builtins`:
  * Loosened restrictions on path component syntax in `PathRouter`.
  * Added `bufferPeriod` configuration option to `AccessLogToFile` and
    `SyslogToFile`.
  * New class `RequestFilter` to take over the duties of the former "filtering
    for free" behavior of `BaseApplication`.

### v0.6.13 -- 2024-04-03

Nearing stability: Though probably not _the_ last unstable release in the v0.6
series, this is probably _one of_ the last before declaring v0.6 stable.

Breaking changes:
* `compote` / `sys-config` / `sys-framework`:
  * Extracted the lower layer of classes from `sys-config` and `sys-framework`
    into new module `compote`. Renamed the classes for better harmony, extracted
    a new interface `IntfComponent`, and generally improved the ergonomics of
    the exported API.
  * Moved the higher layer of classes from `sys-config` to be inner classes of
    the things-they-are-configuring.
  * (Per the previous two items) Removed the now-empty module `sys-config`.
  * Added `_impl_implementedInterfaces()` as an overridable instance method on
    `BaseComponent`, to allow for runtime declaration and validation of
    component interfaces.
  * Reworked `static` property `CONFIG_CLASS` to be `_impl_configClass()`, to
    match how the project usually does overridable members.
* `net-util`:
  * Made `getLogInfo()` an instance (not `static`) method, and fixed its
    reporting of `contentLength`.
* `built-ins`:
  * Renamed network access log services to use the class name `AccessLogTo*`,
    instead of `RequestLogger` (or similar). This is to avoid confusion with the
    objects used to emit system logging messages, which more or less have a lock
    on the term name `*loggger` in this project.
  * Renamed `SystemLogger` to `SyslogToFile`, to match the analogous access log
    class name.
* Configuration:
  * As with `built-ins`, renamed the service role name for access logging from
    `requestLogger` to `accessLog`.

Other notable changes:
* `sys-framework`:
  * Made it possible to pass application and service _instances_ into the
    `Warehouse` constructor, instead of having to pass plain objects in. This
    makes for much nicer ergonomics when using the system as a framework.
  * Did a major rework of how hosts and endpoints are managed, simplifying the
    code a lot in the process.
  * Added general event-reporting and service-calling methods to `BaseService`,
    as a way to eventually enable metaprogramming with services.
* `built-ins`:
  * New service `EventFan`, to do parallel fan-out of events. Notably, this is
    useful for sending network request logs to multiple loggers.

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
