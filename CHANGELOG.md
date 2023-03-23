Changelog
=========

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
