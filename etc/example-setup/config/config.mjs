// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'node:fs/promises';

const fileUrl  = (path) => new URL(path, import.meta.url);
const filePath = (path) => fileUrl(path).pathname;
const readFile = async (path) => {
  return fs.readFile(fileUrl(path));
}

const VAR_DIR = filePath('../../../out/var');
const LOG_DIR = `${VAR_DIR}/log`;
const RUN_DIR = `${VAR_DIR}/run`;

// Host / certificate bindings.
const hosts = [
  {
    hostnames:   ['localhost', '*.localhost'],
    certificate: await readFile('localhost-cert.pem'),
    privateKey:  await readFile('localhost-key.pem')
  },
  {
    hostnames:   ['*', '127.0.0.1', '::1'],
    selfSigned:  true
  }
];

// Service definitions.
const services = [
  {
    name:            'memory',
    class:           'MemoryMonitor',
    checkSecs:       10 * 60,
    gracePeriodSecs: 60,
    maxHeapBytes:    100 * 1024 * 1024,
    maxRssBytes:     150 * 1024 * 1024
  },
  {
    name:       'process',
    class:      'ProcessInfoFile',
    path:       `${RUN_DIR}/process.json`,
    updateSecs:  5 * 60,
    save: {
      onStart:     true,
      onStop:      true,
      maxOldCount: 10
    }
  },
  {
    name:         'process-id',
    class:        'ProcessIdFile',
    path:         `${RUN_DIR}/process.txt`,
    multiprocess: true,
    updateSecs:   5 * 60
  },
  {
    name:   'syslog',
    class:  'SystemLogger',
    path:   `${LOG_DIR}/system-log.txt`,
    format: 'human',
    rotate: {
      atSize:      1024 * 1024,
      onStart:     true,
      maxOldBytes: 10 * 1024 * 1024,
      checkSecs:   60
    }
  },
  {
    name:   'syslog-json',
    class:  'SystemLogger',
    path:   `${LOG_DIR}/system-log.json`,
    format: 'json',
    rotate: {
      atSize:      2 * 1024 * 1024,
      onStart:     true,
      onReload:    true,
      onStop:      true,
      maxOldBytes: 10 * 1024 * 1024,
      maxOldCount: 10,
      checkSecs:   60
    }
  },
  {
    name:  'requests',
    class: 'RequestLogger',
    path:  `${LOG_DIR}/request-log.txt`,
    rotate: {
      atSize:      10000,
      maxOldCount: 10,
      checkSecs:   60
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
  },
  {
    name:     'responseEmpty',
    class:    'SimpleResponse',
    filePath: filePath('../site-extra/empty-file.txt')
  },
  {
    name:        'responseNoContent',
    class:       'SimpleResponse'
  },
  {
    name:        'responseOne',
    class:       'SimpleResponse',
    contentType: 'text/plain',
    body:        'One!\n'
  }
];

// Endpoint defintions, including mount points for applications.
const endpoints = [
  {
    name:      'insecure',
    protocol:  'http',
    hostnames: ['*'],
    interface: '*:8080',
    services: {
      rateLimiter:   'limiter',
      requestLogger: 'requests'
    },
    mounts: [
      {
        application: 'myWackyRedirector',
        at:          '//*/'
      }
    ]
  },
  {
    name:      'secure',
    protocol:  'http2',
    hostnames: ['*'],
    interface: '*:8443',
    services: {
      rateLimiter:   'limiter',
      requestLogger: 'requests'
    },
    mounts: [
      {
        application: 'myStaticFun',
        at:          ['//*/', '//*/bonk/']
      },
      {
        application: 'myStaticFunNo404',
        at:          ['//*/florp/']
      },
      {
        application: 'responseEmpty',
        at:          ['//*/resp/empty/']
      },
      {
        application: 'responseNoContent',
        at:          ['//*/resp/no-content/']
      },
      {
        application: 'responseOne',
        at:          ['//*/resp/one/']
      }
    ]
  },
  {
    name: 'alsoSecure',
    protocol:  'https',
    hostnames: ['*'],
    interface: '*:8444',
    services: {
      requestLogger: 'requests'
    },
    mounts: [
      {
        application: 'myStaticFun',
        at:          '//*/'
      }
    ]
  }
];

const config = {
  applications,
  endpoints,
  hosts,
  services
};

export default config;
