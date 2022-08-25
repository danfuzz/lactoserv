// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ActualServer } from '#p/ActualServer';
import { BaseApplication } from '#p/BaseApplication';
import { PROTECTED_ACCESS } from '#p/PROTECTED_ACCESS';
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
export class RedirectServer extends BaseApplication {
  /**
   * Constructs an instance.
   *
   * @param {Warehouse} warehouse Warehouse of configured pieces.
   */
  constructor(warehouse) {
    super(warehouse);

    const config = warehouse.config;
    RedirectServer.#validateConfig(config);

    this.#addRoutes(config.redirects);
  }

  /**
   * Adds routes to the application instance.
   *
   * @param {object[]} redirects List of redirections.
   */
  #addRoutes(redirects) {
    const actual = this.getActual(PROTECTED_ACCESS);
    const app = actual.app;

    // Convert a literal string into a regex that matches that string,
    // "escaping" special regex characters. We do this because the user-supplied
    // `fromPath`s might inadvertently use characters from Express's "path
    // pattern" syntax. We aren't trying to expose this Express facility, so the
    // easiest thing to do is always give Express regexes for the paths.
    function regexFromPath(p) {
      p = p.replaceAll(/[\\\[\].?*+^$(){}|]/g, '\\$&');
      return new RegExp(p);
    }

    for (const r of redirects) {
      // Drop the final `/` from `toUri`, so we don't end up with double-slashes
      // in the redirect responses.
      const toUri = r.toUri.replace(/[/]$/, '');
      const redirector = (req, res) => {
        res.redirect(`${toUri}${req.path}`);
      };

      app.all(regexFromPath(r.fromPath), redirector);
    }
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
      required: ['what', 'redirects'],
      properties: {
        what: {
          const: 'redirect-server'
        },
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
