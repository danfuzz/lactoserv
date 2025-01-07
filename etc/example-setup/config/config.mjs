// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'node:fs/promises';

import { AccessLogToFile, AccessLogToSyslog, ConnectionRateLimiter,
  DataRateLimiter, EventFan, HostRouter, MemoryMonitor, PathRouter,
  ProcessIdFile, ProcessInfoFile, Redirector, RequestDelay, RequestFilter,
  RequestRateLimiter, SerialRouter, SimpleResponse, StaticFiles, SuffixRouter,
  SyslogToFile }
  from '@lactoserv/webapp-builtins';


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
    name:        'memory',
    class:       MemoryMonitor,
    checkPeriod: '10 min',
    gracePeriod: '1 min',
    maxHeap:     '100 MiB',
    maxRss:      '150 MiB'
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
    name:         'syslog',
    class:        SyslogToFile,
    path:         `${LOG_DIR}/system-log.txt`,
    format:       'human',
    bufferPeriod: '0.25 sec',
    rotate: {
      atSize:      '1 MiB',
      onStart:     true,
      maxOldSize: '10 MiB',
      checkPeriod: '1 min'
    }
  },
  {
    name:         'syslogJson',
    class:        SyslogToFile,
    path:         `${LOG_DIR}/system-log.json`,
    format:       'json',
    bufferPeriod: '0.25 sec',
    rotate: {
      atSize:      '2 MiB',
      onStart:     true,
      onStop:      true,
      maxOldSize:  '10 MiB',
      maxOldCount: 10,
      checkPeriod: '1 min'
    }
  },
  {
    name:         'accessFile',
    class:        AccessLogToFile,
    path:         `${LOG_DIR}/access-log.txt`,
    bufferPeriod: '0.25 sec',
    maxUrlLength: 120,
    rotate: {
      atSize:       '10000 B',
      maxOldCount:  10,
      checkPeriod:  '1 min'
    }
  },
  {
    name:  'accessSyslog',
    class: AccessLogToSyslog
  },
  {
    name:     'accessLog',
    class:    EventFan,
    services: ['accessFile', 'accessSyslog'],
  },
  {
    name:            'dataRateLimiter',
    class:           DataRateLimiter,
    dispatchLogging: true,
    initialBurst:    '100 KiB',
    maxBurst:        '1 MiB',
    flowRate:        '100 KiB / sec',
    maxQueueGrant:   '50 KiB',
    maxQueue:        '2 MiB',
    verboseLogging:  true
  },
  {
    name:     'connectionRateLimiter',
    class:    ConnectionRateLimiter,
    maxBurst: '10 conn',
    flowRate: '3 conn per sec',
    maxQueue: '25 conn'
  }
];

// Application definitions.
const applications = [
  // Top-level dispatch bits.

  {
    name:  'myRedirector',
    class: SerialRouter,
    applications: [
      'requestRate',
      'actuallyRedirect'
    ]
  },
  {
    name:         'actuallyRedirect',
    class:        Redirector,
    statusCode:   308,
    target:       'https://localhost:8443/resp/',
    cacheControl: { public: true, maxAge: '5 min' }
  },

  {
    name:            'mySite',
    class:           SerialRouter,
    dispatchLogging: true,
    applications: [
      'requestRate',
      'myHosts'
    ]
  },
  {
    name:       'myHosts',
    class:      HostRouter,
    ignoreCase: true,
    hosts: {
      '*':         'myPaths',
      '127.0.0.1': 'mySeries',
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
      '/resp/two':          'responseTwo',
      '/resp/*':            null
    }
  },
  {
    name:     'requestRate',
    class:    RequestRateLimiter,
    maxBurst: '20 req',
    flowRate: '600 req per min',
    maxQueue: '100 req'
  },
  {
    name:           'myFilter',
    class:          RequestFilter,
    maxQueryLength: 0
  },
  {
    name: 'slowPoke',
    class: RequestDelay,
    minDelay: '0.5 sec',
    maxDelay: '1 sec'
  },
  {
    name: 'bonkers',
    class: SuffixRouter,
    suffixes: {
      '*.bonk': 'slowPoke'
    }
  },
  {
    name:  'mySeries',
    class: SerialRouter,
    applications: [
      'bonkers',
      'myFilter',
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
    etag:           { dataOnly: true, hashLength: 20 }
  },
  {
    name:          'myStaticFunNo404',
    class:         StaticFiles,
    siteDirectory: filePath('../site'),
    cacheControl:  { public: true, maxAge: '5 min' },
    etag:          { dataOnly: true, hashLength: 20 }
  },
  {
    name:         'responseEmptyBody',
    class:        SimpleResponse,
    filePath:     filePath('../site-extra/empty-file.txt'),
    cacheControl: 'public, immutable, max-age=600'
  },
  {
    name:        'responseNotFound',
    class:       SimpleResponse,
    body :       'Sorry! Not found!\n',
    contentType: 'text/plain',
    statusCode:  404
  },
  {
    name:         'responseNoBody',
    class:        SimpleResponse,
    cacheControl: { public: true, immutable: true, maxAge: '11 min' },
    etag:         true
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
    name:               'insecure',
    protocol:           'http',
    interface:          '*:8080',
    application:        'myRedirector',
    dispatchLogging:    true,
    maxRequestBodySize: '0 byte',
    services: {
      accessLog:             'accessLog',
      dataRateLimiter:       'dataRateLimiter',
      connectionRateLimiter: 'connectionRateLimiter'
    }
  },
  {
    name:               'secure',
    protocol:           'http2',
    hostnames:          ['*'],
    interface:          '*:8443',
    application:        'mySite',
    dispatchLogging:    true,
    maxRequestBodySize: '32 byte',
    services: {
      accessLog:             'accessLog',
      dataRateLimiter:       'dataRateLimiter',
      connectionRateLimiter: 'connectionRateLimiter'
    }
  },
  {
    name:               'alsoSecure',
    protocol:           'https',
    hostnames:          ['*'],
    interface:          '*:8444',
    application:        'mySeries',
    maxRequestBodySize: '32 byte',
    services: {
      accessLog: 'accessLog'
    }
  }
];

const config = {
  applications,
  endpoints,
  hosts,
  services,
  logging: {
    '/application/*': false,
    '/application/mySeries/*': true,
    '/application/mySite/*': true,
    '/application/myRedirector/*': true
  }
};

export default config;
