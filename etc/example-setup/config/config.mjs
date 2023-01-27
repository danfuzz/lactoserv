import * as fs from 'node:fs/promises';

const fileUrl  = (path) => new URL(path, import.meta.url);
const filePath = (path) => fileUrl(path).pathname;
const readFile = async (path) => fs.readFile(fileUrl(path));

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
    type:       'process-info-file',
    directory:  filePath('../../../out/var'),
    baseName:   'process.json',
    updateSecs: 5 * 60
  },
  {
    name:         'process-id',
    type:         'process-id-file',
    directory:    filePath('../../../out/var'),
    baseName:     'process.txt',
    multiprocess: true,
    updateSecs:   5 * 60
  },
  {
    name:      'syslog',
    type:      'system-logger',
    directory: filePath('../../../out/var'),
    baseName:  'system-log.txt',
    format:    'human'
  },
  {
    name:      'syslog-json',
    type:      'system-logger',
    directory: filePath('../../../out/var'),
    baseName:  'system-log.json',
    format:    'json'
  },
  {
    name:      'requests',
    type:      'request-logger',
    directory: filePath('../../../out/var'),
    baseName:  'request-log.txt'
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
    assetsPath: filePath('../site'),
    notFound:   filePath('../assets/not-found.html')
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
    services: {
      rateLimiter:   'limiter',
      requestLogger: 'requests'
    }
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
        at:          ['//*/', '//*/florp/']
      }
    ],
    services: {
      rateLimiter:   'limiter',
      requestLogger: 'requests'
    }
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
