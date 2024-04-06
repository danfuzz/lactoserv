import { StaticFiles } from '@this/webapp-builtins';


const SITE_DIR = new URL('../website', import.meta.url).pathname;

const config = {
  hosts: [{ hostnames: ['localhost'], selfSigned: true }],
  applications: [
    new StaticFiles({
      name:          'mySite',
      siteDirectory: SITE_DIR,
      etag:          true
    })
  ],
  endpoints: [
    {
      name:        'insecure',
      protocol:    'http',
      interface:   '*:8080',
      application: 'mySite'
    },
    {
      name:        'secure',
      protocol:    'http2',
      interface:   '*:8443',
      application: 'mySite'
    }
  ]
};

export default config;
