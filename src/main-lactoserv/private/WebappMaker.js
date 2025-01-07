// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as child_process from 'node:child_process';

import { Condition } from '@this/async';
import { IntfLogger } from '@this/loggy-intf';
import { LimitedLoader } from '@this/metacomp';
import { MustBe } from '@this/typey';
import { WebappRoot } from '@this/webapp-core';

import { ThisModule } from '#p/ThisModule';


/**
 * Maker of {@link WebappRoot} instances. It is configured with a permanent URL
 * to the config file, and can then create or re-(re-...)create webapp instances
 * from it.
 */
export class WebappMaker {
  /**
   * Configuration URL.
   *
   * @type {?URL}
   */
  #configUrl = null;

  /**
   * Logger for this instance, or `null` not to do any logging.
   *
   * @type {?IntfLogger}
   */
  #logger = ThisModule.logger?.system ?? null;

  /**
   * Constructs an instance.
   *
   * @param {URL} configUrl Where to find the config file.
   */
  constructor(configUrl) {
    this.#configUrl = MustBe.instanceOf(configUrl, URL);
  }

  /**
   * Makes a webapp based on the `configUrl` passed in on construction, or
   * reports the error trying to do same.
   *
   * @returns {WebappRoot} The constructed webapp.
   * @throws {Error} Thrown if there's any trouble.
   */
  async make() {
    let config;

    try {
      this.#logger?.readingConfiguration();
      config = await this.#loadConfig();
      this.#logger?.readConfiguration();
    } catch (e) {
      this.#logger?.configFileError(e);
      throw e;
    }

    try {
      this.#logger?.constructingWebapp();
      const result = new WebappRoot(config);
      this.#logger?.constructedWebapp();
      return result;
    } catch (e) {
      this.#logger?.webappConstructionError(e);
      throw e;
    }
  }

  /**
   * Loads the configuration file.
   *
   * @returns {object} The result of loading.
   */
  async #loadConfig() {
    const loader    = new LimitedLoader(null, this.#logger);
    const configUrl = this.#configUrl;

    let module;

    try {
      module = await loader.load(configUrl);
    } catch (e) {
      if (e.name === 'SyntaxError') {
        // There was a syntax error somewhere in the config. Try to make it
        // easy to spot.
        const errorText = await this.#forkAndRelayError();
        this.#logger?.configFileSyntaxError(errorText);
        throw new SyntaxError(errorText);
      }

      throw e;
    }

    return module.namespace.default;
  }

  /**
   * Helper for {@link #loadConfig}, which handles the case of a syntax error in
   * the config file (or something it in turn loads). This uses `fork()` to try
   * loading the configuration in a subprocess and then captures stdout and
   * stderr to replay to the main process (for the presumed user reading the
   * logs or what-have-you). This all is done because -- as of this writing --
   * Node doesn't provide line/column information about where a syntax error
   * occurs in a file which is loaded via dynamic `import(...)`, that being
   * exactly what we (most sensibly / sanely) have to do to load a configuration
   * file.
   *
   * See related Node bug: <https://github.com/nodejs/node/issues/45862>
   *
   * @returns {string} The error reported by the subprocess.
   */
  async #forkAndRelayError() {
    const configUrl = this.#configUrl;
    const done      = new Condition();
    const result    = [];

    const proc = child_process.fork(configUrl,
      {
        stdio: 'pipe',
        timeout: 1000
      });

    proc.stdout.on('data', (data) => result.push(data.toString()));
    proc.stderr.on('data', (data) => result.push(data.toString()));
    proc.on('close', () => { done.value = true; });

    await done.whenTrue();

    // If -- as expected -- the result has a line that starts `SyntaxError`,
    // then everything beyond it is ignorable noise, so we just delete it.
    const match = result.join('')
      .match(/^(?<message>.*\nSyntaxError:[^\n]+\n)?(?<rest>.*)$/s);

    if ((match?.groups.message ?? '') !== '') {
      return match.groups.message;
    } else {
      return match.groups.rest;
    }
  }
}
