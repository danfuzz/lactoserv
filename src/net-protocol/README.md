@this/net-protocol
==================

This module handles the "protocol level" of the system. In this case, this means
handling connections accepted from server sockets, passing through high-level
protocol handlers (such as, notably, `http.Server`), and ultimately dispatching
to one or more applications as defined by _this_ system. This is all accompanied
by optional logging and rate limiting.

From the point of view of a client of this module, the client gets to configure
the network endpoint, the system support services (logging, etc.), and the
"mount map" from hosts and (partial) URI paths to applications. In turn, the
client sees calls into the applications. The client never has to deal directly
with network connections, nor with `http` or `tls` `Server` instances (and the
like).

- - - - - - - - - -
```
Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
SPDX-License-Identifier: Apache-2.0
```
