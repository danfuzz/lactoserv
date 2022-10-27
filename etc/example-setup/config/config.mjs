import * as fs from 'node:fs/promises';

const fileUrl  = (path) => new URL(path, import.meta.url);
const filePath = (path) => fileUrl(path).pathname;
const readFile = async (path) => fs.readFile(fileUrl(path));

// Application definitions.
const applications = [
  {
    name:   'my-wacky-redirector',
    type:   'redirect-server',
    target: 'https://milk.com/boop/'
  },
  {
    name:       'my-static-fun',
    type:       'static-server',
    assetsPath: filePath('../assets')
  }
];

// Service definitions.
const services = [
  {
    name:      'syslog',
    type:      'system-logger',
    directory: filePath('../../../log'),
    baseName:  'system'
  },
  {
    name:      'requests',
    type:      'request-logger',
    directory: filePath('../../../log'),
    baseName:  'requests'
  },
  {
    name:        'limiter',
    type:        'rate-limiter',
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

// Host / certificate bindings.
const hosts = [
  {
    hostnames:   ['localhost', '*'],
    certificate: await readFile('localhost-cert.pem'),
    privateKey:  await readFile('localhost-key.pem')
  }
];

// Server defintions, including mount points for applications.
const servers = [
  {
    name:          'insecure',
    endpoint: {
      hostnames:     ['*'],
      interface:     '*',
      port:          8080,
      protocol:      'http'
    },
    mounts: [
      {
        application: 'my-wacky-redirector',
        at:          '//*/'
      }
    ],
    rateLimiter:   'limiter',
    requestLogger: 'requests'
  },
  {
    name:          'secure',
    endpoint: {
      hostnames:     ['*'],
      interface:     '*',
      port:          8443,
      protocol:      'http2',
    },
    mounts: [
      {
        application: 'my-static-fun',
        at:          '//*/'
      },
      {
        application: 'my-static-fun',
        at:          '//*/florp/'
      }
    ],
    rateLimiter:   'limiter',
    requestLogger: 'requests'
  },
  {
    name:          'also-secure',
    endpoint: {
      hostnames:     ['*'],
      interface:     '*',
      port:          8444,
      protocol:      'https'
    },
    mounts: [
      {
        application: 'my-static-fun',
        at:          '//*/'
      }
    ],
    requestLogger: 'requests'
  }
];

const config = {
  applications,
  hosts,
  servers,
  services
};

export default config;
