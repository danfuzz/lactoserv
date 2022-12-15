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

The distribution includes a script `bin/run`, which runs the main server
application (passing through arguments and options). The server is
self-documenting (`bin/run --help`). That said, the main option to use is
`--config=<path>` to tell it where to read its configuration from.

The server is happy to be run either in the foreground or as a daemon(-like)
system service. When running in the foreground, you will probably want to
pass the option `--log-to-stdout`, to produce logs on `stdout` (in addition to
whatever logging you may have configured).

The server has been tested using `systemd`. Here is an example `systemd` service
configuration file, based on one used in production (as of 2022). This file was
written for an installation where all the server files live in the home
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
ExecSearchPath=/usr/local/bin:/usr/bin:/usr/local/sbin:/usr/sbin:/home/lactoserv-user/bin
ExecStart=run-under-systemd --service-name='%N' start
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
