import { StaticFiles } from '@this/built-ins';


const SITE_DIR = new URL('../website', import.meta.url).pathname;

const config = {
  hosts: [{ hostnames: ['localhost'], selfSigned: true }],
  applications: [
    {
      name:          'mySite',
      class:         StaticFiles,
      siteDirectory: SITE_DIR,
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
