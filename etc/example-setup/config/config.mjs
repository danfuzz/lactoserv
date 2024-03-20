// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'node:fs/promises';

import { Redirector, SimpleResponse, StaticFiles }
  from '@lactoserv/builtin-applications';
import { MemoryMonitor, ProcessIdFile, ProcessInfoFile, RateLimiter,
  RequestLogger, SystemLogger } from '@lactoserv/built-ins';


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
    name:         'memory',
    class:        MemoryMonitor,
    checkPeriod:  '10 min',
    gracePeriod:  '1 min',
    maxHeapBytes: 100 * 1024 * 1024,
    maxRssBytes:  150 * 1024 * 1024
  },
  {
    name:         'process',
    class:        ProcessInfoFile,
    path:         `${RUN_DIR}/process.json`,
    updatePeriod: '5 min',
    save: {
      onStart:     true,
      onStop:      true,
      maxOldCount: 10
    }
  },
  {
    name:         'processId',
    class:        ProcessIdFile,
    path:         `${RUN_DIR}/process.txt`,
    multiprocess: true,
    updatePeriod: '5 min'
  },
  {
    name:   'syslog',
    class:  SystemLogger,
    path:   `${LOG_DIR}/system-log.txt`,
    format: 'human',
    rotate: {
      atSize:      1024 * 1024,
      onStart:     true,
      maxOldBytes: 10 * 1024 * 1024,
      checkPeriod: '1 min'
    }
  },
  {
    name:   'syslogJson',
    class:  SystemLogger,
    path:   `${LOG_DIR}/system-log.json`,
    format: 'json',
    rotate: {
      atSize:      2 * 1024 * 1024,
      onStart:     true,
      onReload:    true,
      onStop:      true,
      maxOldBytes: 10 * 1024 * 1024,
      maxOldCount: 10,
      checkPeriod: '1 min'
    }
  },
  {
    name:  'requests',
    class: RequestLogger,
    path:  `${LOG_DIR}/request-log.txt`,
    rotate: {
      atSize:      10000,
      maxOldCount: 10,
      checkPeriod: '1 min'
    },
    sendToSystemLog: true
  },
  {
    name:        'limiter',
    class:       RateLimiter,
    connections: {
      maxBurstSize: 10,
      flowRate:     '3 per sec',
      maxQueueSize: 25
    },
    requests: {
      maxBurstSize: 20,
      flowRate:     '600 per min',
      maxQueueSize: 100
    },
    data: {
      maxBurstSize:      1024 * 1024,           // 1MB.
      flowRate:          `${100 * 1024} / sec`, // 100kB.
      maxQueueGrantSize: 50 * 1024,             // 50kB.
      maxQueueSize:      2 * 1024 * 1024        // 2MB.
    }
  }
];

// Application definitions.
const applications = [
  {
    name:         'myWackyRedirector',
    class:        Redirector,
    statusCode:   308,
    target:       'https://localhost:8443/resp/',
    cacheControl: { public: true, maxAge: '5 min' }
  },
  {
    name:          'myStaticFun',
    class:         StaticFiles,
    siteDirectory: filePath('../site'),
    notFoundPath:  filePath('../site-extra/not-found.html'),
    cacheControl:  { public: true, maxAge: '5 min' },
    etag:          { dataOnly: true, hashLength: 20 }
  },
  {
    name:          'myStaticFunNo404',
    class:         StaticFiles,
    siteDirectory: filePath('../site'),
    cacheControl:  { public: true, maxAge: '5 min' }
  },
  {
    name:         'responseEmptyBody',
    class:        SimpleResponse,
    filePath:     filePath('../site-extra/empty-file.txt'),
    cacheControl: 'public, immutable, max-age=600'
  },
  {
    name:         'responseNoBody',
    class:        SimpleResponse,
    cacheControl: { public: true, immutable: true, maxAge: '11 min' },
    etag:         true
  },
  {
    name:         'responseOne',
    class:        SimpleResponse,
    contentType:  'text/plain',
    body:         'One!\n',
    cacheControl: { public: true, immutable: true, maxAge: '12 min'  },
    etag: {
      hashAlgorithm: 'sha1',
      hashLength:    12,
      tagForm:       'weak'
    },
    maxPathLength:       0,
    redirectDirectories: true
  },
  {
    name:                'responseTwo',
    class:               SimpleResponse,
    contentType:         'text/html',
    body:                '<html><body><h1>Two!</h1></body></html>\n',
    cacheControl:        { public: true, immutable: true, maxAge: '13 min'  },
    etag:                true,
    maxPathLength:       0,
    redirectDirectories: true
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
        application: 'responseEmptyBody',
        at:          ['//*/resp/empty-body/']
      },
      {
        application: 'responseNoBody',
        at:          ['//*/resp/no-body/']
      },
      {
        application: 'responseOne',
        at:          ['//*/resp/one/']
      },
      {
        application: 'responseTwo',
        at:          ['//*/resp/two/']
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
