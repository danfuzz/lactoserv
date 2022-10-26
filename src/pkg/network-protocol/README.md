@this/network-protocol
======================

This module handles the "protocol level" of the system. In this case, this means
handling connections accepted from server sockets, passing through high-level
protocol handlers (such as, notably, `http.Server`), and finally handing off to
a "highest-level" application instance (such as, notably `express.Application`)
for further disposition.

The "line of demarcation" at the top is that this instance _creates_ application
instances, but it does no _configuration_ of these instances. It merely emits
events on them to get them to handle requests.
