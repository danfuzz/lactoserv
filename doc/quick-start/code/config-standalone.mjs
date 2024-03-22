import { StaticFiles } from '@lactoserv/built-ins';


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
      name:        'insecure',
      protocol:    'http',
      hostnames:   ['*'],
      interface:   '*:8080',
      application: 'mySite'
    },
    {
      name:        'secure',
      protocol:    'http2',
      hostnames:   ['*'],
      interface:   '*:8443',
      application: 'mySite'
    }
  ]
};

export default config;
