Deployment Guide
================

### Build a distribution

```bash
$ ubik dev distro
```

This will deposit `lactoserv-<version>.tgz` in the `out` directory. This
contains all of the code and is architecture-neutral (no native code).

### Install and run

The distro tarball can be unpacked pretty much anywhere.

The distribution includes a script `bin/run`, which runs the main system
application (passing through arguments and options). The top-level system
command is self-documenting (`bin/run --help`). That said, the main option to
use is `--config=<path>` to tell it where to read its configuration from.

The system is happy to be run either in the foreground or as a daemon(-like)
system service. When running in the foreground, you will probably want to
pass the option `--log-to-stdout`, to produce logs on `stdout` (in addition to
whatever logging you may have configured).

#### Signals

As with many POSIX-ish services, Lactoserv can be controlled in part by sending
it signals. It responds to the following:

* `SIGINT` or `SIGTERM` &mdash; Cleanly shut down the system and exit. Shutting
  down _can_ take a long time if remote connections aren't behaving well. As
  such, after a timeout period the system will exit itself more forcefully. In
  addition, sending four of the signal in sequence &mdash; for example, typing
  `ctrl-c` four times at a terminal to which the system is attached &mdash; will
  cause the system to give up and just exit.
* `SIGHUP` &mdash; Make the system reload its configuration and then use it.
  The system will keep using the old configuration if there was a problem
  loading the new one. Note, however, since configuration files are just code,
  it is possible for a failed configuration load to affect the system, depending
  on its details.
* `SIGUSR2` &mdash; Make the system perform a heap dump. If the `CWD` the
  system is running in is writable, the dump file will be written there. If not,
  it will use the `HOME` directory, the `TMPDIR`, or simply `/tmp`.

### Using `systemd`

The system can be run under `systemd`. Here is an example `systemd` service
configuration file, based on one used in production (as of 2023). This file was
written for an installation where all the system files live in the home
directory of a user named `lactoserv-user`. It uses the `run-under-systemd`
helper script which is included in the distribution.

```
[Unit]
Description=Lactoserv

[Install]
WantedBy=multi-user.target

[Service]

# Execution mechanics.
Type=simple
WorkingDirectory=~
ExecSearchPath=/usr/local/bin:/usr/bin:/usr/local/sbin:/usr/sbin:/home/lactoserv-user/bin
ExecStart=run-under-systemd --service-name='%N' start --config=lactoserv/config.mjs
ExecReload=run-under-systemd --service-name='%N' reload
ExecStop=run-under-systemd --service-name='%N' stop

# That is, try to keep the process alive.
Restart=always

# Identity and privileges.
User=lactoserv-user
Group=lactoserv-user
# Prevent `sudo` etc.
NoNewPrivileges=true

# Logging.
StandardOutput=journal
SyslogIdentifier=lactoserv
```

#### Socket FDs

If you use `systemd` to do the server socket listening, the `run-under-systemd`
script converts the file descriptors passed into the process into a form that
is easily parsed in your configuration file, especially if you give the sockets
distinct names. In particular, the script will define a new environment variable
`$LACTOSERV_FDS` which contains a JSON-encoded object which binds socket names
to `/dev/fd/<fd-num>` strings. For example,

```
# http-sock.socket
...
[Socket]
FileDescriptorName=http
ListenStream=80
...

# https-sock.socket
...
[Socket]
FileDescriptorName=https
ListenStream=443
...

# lactoserv-config.js
...
const fds = JSON.parse(process.env.LACTOSERV_FDS);
// will be equal to something like:
// { http: '/dev/fd/3', https: '/dev/fd/4' }
...
```

### Tactics for running without privileges

If you want to run the system as an unprivileged user while still accepting
traffic from the usual low-numbered ports, there are two tactics that can
achieve that without too much trouble.

* Use the OS's networking system to redirect the ports to the unprivileged
  range. For example, using `nftables` which ships with many Linux
  distributions, the following table will do the trick:

  ```
  table inet nat {
      chain prerouting {
          type nat hook prerouting priority dstnat
          policy accept
          meta l4proto tcp th dport 80 redirect to :8080
          meta l4proto tcp th dport 443 redirect to :8443
      }
  }
  ```

  Then configure Lactoserv to listen on `*:8080` and `*:8443`.

* Use `systemd` to do the listening, and have it pass the open server sockets to
  Lactoserv. For example, define a `lactoserv.socket` service file along these
  lines:

  ```
  [Unit]
  Description=Lactoserv Sockets

  [Install]
  WantedBy=multi-user.target

  [Socket]
  ListenStream=80
  ListenStream=443
  ```

### Tactics for running multiple instances on a single machine

If you want to run multiple server instances of the server on a single machine,
with the aim of sharing the traffic load, there are a couple of ways to achieve
that. In either case, you can take advantage of the code-based configuration, so
that you share a single (set of) configuration file(s). In particular, you can
use environment variables which are then accessed as `process.env.<name>` to
drive whatever differences are necessary.

* Use a separate set of ports for each instance, and use a reverse proxy (either
  on the same machine or a different one) to route traffic to all the instances.
  In the same-machine case, `nftables` can be used as in effect a "lightweight
  reverse proxy" using a `nat` chain, similar to what is described above in the
  section "Tactics for running without privileges." In addition to what is
  shown there, you will need to use a `map` as part of the routing expression,
  along the lines of: `meta l4proto tcp th dport 80 redirect to :numgen inc mod
  2 map { 0: 8080, 1: 9080 }`.

  The downside of this tactic is that if one of the instances crashes, the proxy
  layer might still end up routing traffic to it before it gets restarted.

* Use cross-process port sharing, and have each instance listen on the same
  interface(s) and port(s). At the low level, this involves setting the
  `SO_REUSEPORT` option on the server sockets (which is widely available on
  POSIX-ish operating systems these days). Unfortunately, as of this writing,
  Node has no facility to set this option on sockets directly, but it is
  possible to pass in a file descriptor to a server socket that is already
  appropriately configured, and use that. If you are using `systemd`, then it
  directly supports this via the `ReusePort` directive, which can be added to
  the `[Socket]` section of a `.socket` file. For example:

  ```
  [Socket]
  ListenStream=80
  ListenStream=443
  ReusePort=true
  ```

  In the absence of `systemd`, it is possible to write a small wrapper (e.g. in
  C) which achieves the same effect.

- - - - - - - - - -
```
Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
SPDX-License-Identifier: Apache-2.0
```
