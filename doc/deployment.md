Deployment Guide
================

### Build a distribution

```bash
$ ./scripts/build --make-distro
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

### Tactics for running without privileges

If you want to run the system as an unprivileged user while still accepting
traffic from the usual low-numbered ports, there are two tactics that can do
that without too much trouble.

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
  ReusePort=true
  ```

  Note the use of `ReusePort` here, which _should_ make it possible to run
  multiple instances of Lactoserv which all bind to the same port.
  (Unfortunately, as of this writing it isn't possible to get Node to do port
  sharing when directly listening on a network interface. It's great that it's
  possible using `systemd` but unfortunate that something like this arrangement
  is _required_ to do so.)

- - - - - - - - - -
```
Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
SPDX-License-Identifier: Apache-2.0
```
