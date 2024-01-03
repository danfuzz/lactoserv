@this/network-protocol
======================

This module handles the "protocol level" of the system. In this case, this means
handling connections accepted from server sockets, passing through high-level
protocol handlers (such as, notably, `http.Server`), hooking into a
"highest-level" Express(-ish) `Application` instance, and then finally
dispatching to one or more applications as defined by _this_ system. This is all
accompanied by optional logging and rate limiting.

From the point of view of a client of this module, the client gets to configure
the network endpoint, the system support services (logging, etc.), and the
"mount map" from hosts and (partial) URI paths to applications. In turn, the
client sees calls into the applications. The client never has to deal directly
with network connections, `http` or `tls` `Server` instances (and the like), or
`express.Application` instances (and the like).

The use of Express at all is a tactic to avoid re&iuml;mplementing all sorts of
nit-picky details of request handling, that is to say, to avoid having to
write a bunch of stuff which is prime territory for security bugs. Should this
project last long enough, it may make sense to swap it out for a more "native"
implementation.

- - - - - - - - - -
```
Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
SPDX-License-Identifier: Apache-2.0
```
