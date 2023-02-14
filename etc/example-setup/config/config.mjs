// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'node:fs/promises';

const fileUrl  = (path) => new URL(path, import.meta.url);
const filePath = (path) => fileUrl(path).pathname;
const readFile = async (path) => {
  return fs.readFile(fileUrl(path));
}

// Host / certificate bindings.
const hosts = [
  {
    hostnames:   ['localhost', '*'],
    certificate: await readFile('localhost-cert.pem'),
    privateKey:  await readFile('localhost-key.pem')
  }
];

// Service definitions.
const services = [
  {
    name:       'process',
    class:      'ProcessInfoFile',
    directory:  filePath('../../../out/var'),
    baseName:   'process.json',
    updateSecs: 5 * 60
  },
  {
    name:         'process-id',
    class:        'ProcessIdFile',
    directory:    filePath('../../../out/var'),
    baseName:     'process.txt',
    multiprocess: true,
    updateSecs:   5 * 60
  },
  {
    name:      'syslog',
    class:     'SystemLogger',
    directory: filePath('../../../out/var'),
    baseName:  'system-log.txt',
    format:    'human',
    rotate: {
      atSize:      1024 * 1024,
      atStart:     true,
      maxOldBytes: 10 * 1024 * 1024
    }
  },
  {
    name:      'syslog-json',
    class:     'SystemLogger',
    directory: filePath('../../../out/var'),
    baseName:  'system-log.json',
    format:    'json',
    rotate: {
      atSize:      2 * 1024 * 1024,
      atStart:     true,
      atReload:    true,
      atStop:      true,
      maxOldCount: 10
    }
  },
  {
    name:      'requests',
    class:     'RequestLogger',
    directory: filePath('../../../out/var'),
    baseName:  'request-log.txt',
    rotate: {
      atSize:      100000,
      maxOldBytes: 1024 * 1024
    }
  },
  {
    name:        'limiter',
    class:       'RateLimiter',
    connections: {
      maxBurstSize: 5,
      flowRate:     1,
      timeUnit:     'second',
      maxQueueSize: 15
    },
    requests: {
      maxBurstSize: 20,
      flowRate:     5,
      timeUnit:     'second',
      maxQueueSize: 100
    },
    data: {
      maxBurstSize:      500000,
      flowRate:          10000,
      timeUnit:          'second',
      maxQueueGrantSize: 10000,
      maxQueueSize:      1000000
    }
  }
];

// Application definitions.
const applications = [
  {
    name:       'myWackyRedirector',
    class:      'Redirector',
    statusCode: 308,
    target:     'https://milk.com/boop/'
  },
  {
    name:          'myStaticFun',
    class:         'StaticFiles',
    siteDirectory: filePath('../site'),
    notFoundPath:  filePath('../site-extra/not-found.html')
  },
  {
    name:          'myStaticFunNo404',
    class:         'StaticFiles',
    siteDirectory: filePath('../site'),
  }
];

// Server defintions, including mount points for applications.
const servers = [
  {
    name: 'insecure',
    endpoint: {
      hostnames: ['*'],
      interface: '*',
      port:      8080,
      protocol:  'http'
    },
    mounts: [
      {
        application: 'myWackyRedirector',
        at:          '//*/'
      }
    ],
    services: {
      rateLimiter:   'limiter',
      requestLogger: 'requests'
    }
  },
  {
    name: 'secure',
    endpoint: {
      hostnames: ['*'],
      interface: '*',
      port:      8443,
      protocol:  'http2',
    },
    mounts: [
      {
        application: 'myStaticFun',
        at:          ['//*/', '//*/bonk/']
      },
      {
        application: 'myStaticFunNo404',
        at:          ['//*/florp/']
      }
    ],
    services: {
      rateLimiter:   'limiter',
      requestLogger: 'requests'
    }
  },
  {
    name: 'alsoSecure',
    endpoint: {
      hostnames: ['*'],
      interface: '*',
      port:      8444,
      protocol:  'https'
    },
    mounts: [
      {
        application: 'myStaticFun',
        at:          '//*/'
      }
    ],
    services: {
      requestLogger: 'requests'
    }
  }
];

const config = {
  applications,
  hosts,
  servers,
  services
};

export default config;
