// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ActualServer } from '#p/ActualServer';
import { BaseApplication } from '#p/BaseApplication';
import { Warehouse } from '#x/Warehouse';

import express from 'express';
import { Validator } from 'jsonschema';

import { URL } from 'node:url';

/**
 * Server that redirects requests to different servers, protocols, paths, etc.
 *
 * Configuration object details:
 *
 * * `{array} redirects` -- List of redirections to perform. Each element is
 *   an object with mappings for:
 *   * `{string} fromPath` -- Absolute URI path to trigger off of (no protocol,
 *     host, or port; just path components). Must end with a slash. Can be just
 *     a single slash to redirect all paths.
 *   * `{string} toUri` -- Absolute URI (including protocol, host, and port[*])
 *     of the prefix to redirect to. Must end with a slash. Protocol must be
 *     either `http` or `https`.
 *
 * [*] unless implied by the protocol.
 */
export class RedirectApplication extends BaseApplication {
  /** {express:Router} Router with all the redirects. */
  #router;

  /** {string} Application type as used in configuration objects. */
  static get TYPE() {
    return 'redirect-server';
  }

  /**
   * Constructs an instance.
   *
   * @param {object} config Application-specific configuration object.
   */
  constructor(config) {
    super();

    RedirectApplication.#validateConfig(config);
    this.#router = RedirectApplication.#makeRouter(config);
  }

  /** Per superclass requirement. */
  handleRequest(req, res, next) {
    this.#router(req, res, next);
  }

  /**
   * Makes a request router for an instance of this class.
   *
   * @param {object} config Configuration object.
   * @returns {function} The middleware function.
   */
  static #makeRouter(config) {
    const router = express.Router();
    const redirects = config.redirects;

    // Returns a literal-string matching regex suitable for use with an Express
    // router. We do this because the user-supplied `fromPath`s might
    // inadvertently use characters from Express's "path pattern" syntax, and we
    // aren't trying to expose this Express facility. Rather than _just_ detect
    // if Express might be confused, we simply _always_ convert the path to
    // a regex. This doesn't cost anything at runtime, because Express itself
    // always converts paths to regexes anyway. That said and FWIW, see
    // <https://github.com/pillarjs/path-to-regexp> for details on the path
    // syntax used by Express.
    function literalPath(p) {
      p = p.replaceAll(/[.?*+^$(){}\[\]\\|]/g, '\\$&');
      return new RegExp(p);
    }

    for (const r of redirects) {
      // Drop the final `/` from `toUri`, so we don't end up with double-slashes
      // in the redirect responses.
      const toUri = r.toUri.replace(/[/]$/, '');
      const redirector = (req, res) => {
        res.redirect(`${toUri}${req.path}`);
      };

      router.all(literalPath(r.fromPath), redirector);
    }

    return router;
  }

  /**
   * Validates the given configuration object.
   *
   * @param {object} config Configuration object.
   */
  static #validateConfig(config) {
    const v = new Validator();

    // Validator for `fromPath`, mostly done by treating it as the path part of
    // a URL.
    v.customFormats.fromPath = (input) => {
      // Must start with a slash.
      if (! /^[/]/.test(input)) {
        return false;
      }

      try {
        const url = new URL(`http://x${input}`);
        return (url.pathname === input)
          && (! /[/]{2}/.test(url.pathname)) // No empty components.
          && (/[/]$/.test(url.pathname));    // Path ends with a slash.
      } catch {
        return false;
      }
    }

    // Additional restrictions on `toUri`, beyond basic URI syntax.
    v.customFormats.toUri = (input) => {
      try {
        const url = new URL(input);
        return (/^https?:$/.test(url.protocol))
          && (url.username === '')
          && (url.password === '')
          && (input.endsWith(url.pathname))
          && (! /[/]{2}/.test(url.pathname)) // No empty components.
          && (/[/]$/.test(url.pathname));    // Path ends with a slash.
      } catch {
        return false;
      }
    };

    const schema = {
      title: 'redirect-server',
      type: 'object',
      required: ['redirects'],
      properties: {
        redirects: {
          type: 'array',
          minItems: 1,
          uniqueItems: true,
          items: {
            type: 'object',
            required: ['fromPath', 'toUri'],
            properties: {
              fromPath: {
                type: 'string',
                format: 'fromPath'
              },
              toUri: {
                allOf: [
                  {
                    type: 'string',
                    format: 'uri'
                  },
                  {
                    type: 'string',
                    format: 'toUri'
                  }
                ]
              }
            }
          }
        }
      }
    };

    const result = v.validate(config, schema);
    const errors = result.errors;

    if (errors.length != 0) {
      console.log('Configuration error%s:', (errors.length == 1) ? '' : 's');
      for (const e of errors) {
        console.log('  %s', e.stack);
      }

      throw new Error('Invalid configuration.');
    }
  }
}
