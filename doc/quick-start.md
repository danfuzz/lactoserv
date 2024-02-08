Quick Start Guide
=================

Lactoserv is meant to be usable both as a standalone webserver application and
as a framework for building higher-level applications that use web protocols for
communication. This guide has a short "starter" example for each style. For more
complete directions, please see the [Configuration Guide](./configuration.md)
and the [Deployment Guide](./deployment.md).

## Standalone

These instructions are meant to get you up and running quickly. In a real
deployment, you'll probably want to move the built application somewhere else
(you can also make a tarball distro to unpack wherever is appropriate).

This example, in a slightly modified form, is available by running the script
`./etc/doc/quick-start/run`, which will even build the system for you if you
haven't done that yet.

Build the system:

```bash
$ git clone git@github.com:danfuzz/lactoserv
...
$ cd lactoserv
$ ./scripts/ubik build
...
```

Make a config file. In this case, we're serving a directory of static files
located in the directory `/usr/share/website`, and responding to
`http://localhost:8080` and `https://localhost:8443`, the latter using a
self-signed certificate.

```bash
$ cat >my-config.mjs <<EOF
const config = {
  hosts: [{ hostnames: ['localhost'], selfSigned: true }],
  applications: [
    {
      name:          'mySite',
      class:         'StaticFiles',
      siteDirectory: filePath('/usr/share/website'),
      etag:          true
    }
  ],
  endpoints: [
    {
      name:      'insecure',
      protocol:  'http',
      hostnames: ['*'],
      interface: '*:8080',
      mounts: [{ application: 'mySite', at: '//*/' }]
    },
    {
      name:      'secure',
      protocol:  'http2',
      hostnames: ['*'],
      interface: '*:8443',
      mounts: [{ application: 'mySite', at: '//*/' }]
    }
  ]
};

export default config;
EOF
```

Run the server. (If you don't want to see the debugging infodump, omit
`--log-to-stdout`.)

```bash
$ ./out/lactoserv/bin/run --config=my-config.mjs --log-to-stdout
```

Browse! Use your web browser or `curl` to visit `http://localhost:8080` or
`https://localhost:8443`.


## Framework

TODO!

- - - - - - - - - -
```
Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
SPDX-License-Identifier: Apache-2.0
```
