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
    class:      'ProcessInfoFileService',
    directory:  filePath('../../../out/var'),
    baseName:   'process.json',
    updateSecs: 5 * 60
  },
  {
    name:         'process-id',
    class:        'ProcessIdFileService',
    directory:    filePath('../../../out/var'),
    baseName:     'process.txt',
    multiprocess: true,
    updateSecs:   5 * 60
  },
  {
    name:      'syslog',
    class:     'SystemLoggerService',
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
    class:     'SystemLoggerService',
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
    class:     'RequestLoggerService',
    directory: filePath('../../../out/var'),
    baseName:  'request-log.txt',
    rotate: {
      atSize:      100000,
      maxOldBytes: 1024 * 1024
    }
  },
  {
    name:        'limiter',
    class:       'RateLimiterService',
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
    name:       'my-wacky-redirector',
    class:      'RedirectApplication',
    statusCode: 308,
    target:     'https://milk.com/boop/'
  },
  {
    name:          'my-static-fun',
    class:         'StaticApplication',
    siteDirectory: filePath('../site'),
    notFoundPath:  filePath('../site-extra/not-found.html')
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
