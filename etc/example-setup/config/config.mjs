// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'node:fs/promises';

import { AccessLogToFile, AccessLogToSyslog, EventFan, HostRouter,
  MemoryMonitor, PathRouter, ProcessIdFile, ProcessInfoFile, RateLimiter,
  Redirector, SerialRouter, SimpleResponse, StaticFiles, SystemLogger }
  from '@lactoserv/built-ins';


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
    name:  'accessFile',
    class: AccessLogToFile,
    path:  `${LOG_DIR}/access-log.txt`,
    rotate: {
      atSize:      10000,
      maxOldCount: 10,
      checkPeriod: '1 min'
    }
  },
  {
    name:  'accessSyslog',
    class: AccessLogToSyslog
  },
  {
    name:     'accessLog',
    class:    EventFan,
    services: ['accessFile', 'accessSyslog']
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
  // Main apps.

  {
    name:         'myWackyRedirector',
    class:        Redirector,
    statusCode:   308,
    target:       'https://localhost:8443/resp/',
    cacheControl: { public: true, maxAge: '5 min' }
  },

  {
    name:  'mySite',
    class: HostRouter,
    hosts: {
      '*':         'myPaths',
      '127.0.0.1': 'mySeries'
    }
  },
  {
    name:  'myPaths',
    class: PathRouter,
    paths: {
      '/*':                 'myStaticFun',
      '/bonk/*':            'myStaticFun',
      '/florp/*':           'myStaticFunNo404',
      '/resp/empty-body/*': 'responseEmptyBody',
      '/resp/no-body/*':    'responseNoBody',
      '/resp/dir-only/':    'responseDirOnly',
      '/resp/one':          'responseOne',
      '/resp/two':          'responseTwo'
    }
  },
  {
    name:  'mySeries',
    class: SerialRouter,
    applications: [
      'myStaticFunNo404',
      'responseNotFound'
    ]
  },

  // Component apps used by the above.

  {
    name:           'myStaticFun',
    class:          StaticFiles,
    siteDirectory:  filePath('../site'),
    notFoundPath:   filePath('../site-extra/not-found.html'),
    cacheControl:   { public: true, maxAge: '5 min' },
    etag:           { dataOnly: true, hashLength: 20 },
    maxQueryLength: 20
  },
  {
    name:          'myStaticFunNo404',
    class:         StaticFiles,
    siteDirectory: filePath('../site'),
    cacheControl:  { public: true, maxAge: '5 min' },
    etag:          { dataOnly: true, hashLength: 20 }
  },
  {
    name:                'responseEmptyBody',
    class:               SimpleResponse,
    filePath:            filePath('../site-extra/empty-file.txt'),
    cacheControl:        'public, immutable, max-age=600',
    maxPathLength:       2,
    redirectDirectories: true
  },
  {
    name:        'responseNotFound',
    class:       SimpleResponse,
    etag:        false,
    body :       'Sorry! Not found!\n',
    contentType: 'text/plain',
    statusCode:  404
  },
  {
    name:          'responseNoBody',
    class:         SimpleResponse,
    cacheControl:  { public: true, immutable: true, maxAge: '11 min' },
    etag:          true,
    maxPathLength: 2,
  },
  {
    name:         'responseDirOnly',
    class:        SimpleResponse,
    contentType:  'text/plain',
    body:         'I am a directory!\n',
    cacheControl: { public: true, immutable: true, maxAge: '12 min'  },
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
    }
  },
  {
    name:                'responseTwo',
    class:               SimpleResponse,
    contentType:         'text/html',
    body:                '<html><body><h1>Two!</h1></body></html>\n',
    cacheControl:        { public: true, immutable: true, maxAge: '13 min'  },
    etag:                true
  }
];

// Endpoint defintions, including mount points for applications.
const endpoints = [
  {
    name:      'insecure',
    protocol:  'http',
    interface: '*:8080',
    services: {
      accessLog:   'accessLog',
      rateLimiter: 'limiter'
    },
    application: 'myWackyRedirector'
  },
  {
    name:      'secure',
    protocol:  'http2',
    hostnames: ['*'],
    interface: '*:8443',
    services: {
      accessLog:   'accessLog',
      rateLimiter: 'limiter'
    },
    application: 'mySite'
  },
  {
    name: 'alsoSecure',
    protocol:  'https',
    hostnames: ['*'],
    interface: '*:8444',
    services: {
      accessLog: 'accessLog'
    },
    application: 'mySeries'
  }
];

const config = {
  applications,
  endpoints,
  hosts,
  services
};

export default config;
