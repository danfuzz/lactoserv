// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { BuiltInDirectives } from '#p/BuiltInDirectives';
import { ExpanderWorkspace } from '#p/ExpanderWorkspace';
import { JsonDirective } from '#x/JsonDirective';

import { MustBe } from '@this/typey';

import * as Path from 'node:path';

/**
 * Processor for JSON objects, which knows how to expand it by following
 * embedded directives. Directives are in the form of objects with distinctive
 * keys.
 *
 * **Note:** See the package README for a list of built-in directives.
 */
export class JsonExpander {
  /**
   * @type {Map<string, function(new:JsonDirective)>} Map from names to
   * corresponding directive-handler classes, for all directives recognized by
   * this instance.
   */
  #directives = new Map();

  /** @type {?string} Base directory for filesystem-using directives. */
  #baseDir;

  /**
   * Constructs a new instance. By default, it includes all built-in directives.
   *
   * @param {?string} [baseDir = null] Base directory to use when expanding
   *   filesystem-based directives, or `null` if none is to be used (in which
   *   case all specified paths must be absolute _or_ all expanded values must
   *   include an explicit `$baseDir`). If non-`null`:
   *   * The value is resolved into an absolute path (based in the current
   *     directory if relative) during the constructor call.
   *   * The instance is expected to define the directives `$baseDir` and
   *     `$value`.
   * @param {boolean} [builtInDirectives = true] Should all the built-in
   *   directives be recognized by this instance?
   */
  constructor(baseDir = null, builtInDirectives = true) {
    if (baseDir !== null) {
      MustBe.string(baseDir);
      baseDir = Path.resolve(baseDir);
    }

    this.#baseDir = baseDir;

    if (builtInDirectives) {
      BuiltInDirectives.addAllDirectivesTo(this.#directives);
    }
  }

  /**
   * Adds a directive, specifically a handler class for a directive. One only
   * needs to call this method to use non-built-in directives.
   *
   * @param {function(new:JsonDirective)} directive The directive to add.
   */
  addDirective(directive) {
    const key = directive.NAME;

    if (!key.startsWith('$')) {
      throw new Error('Directive keys must start with `$`.');
    }

    this.#directives.set(key, directive);
  }

  /**
   * Expands the given JSON value, synchronously. This will report an error if
   * expansion comes to a moment where it has to `await` to make progress.
   *
   * @param {*} value The original value.
   * @returns {*} The expanded version of `value`.
   * @throws {Error} Thrown if there is any trouble with the expansion.
   */
  expand(value) {
    return this.#expand0(value, false);
  }

  /**
   * Expands the given JSON value asynchronously, that is with promises allowed
   * as intermediate results.
   *
   * @param {*} value The original value.
   * @returns {*} The expanded version of `value`.
   * @throws {Error} Thrown if there is any trouble with the expansion.
   */
  async expandAsync(value) {
    return this.#expand0(value, true);
  }

  /**
   * Common code between {@link #expand} and {@link #expandAsync}.
   *
   * @param {*} value The original value.
   * @param {boolean} doAsync Run asynchronously?
   * @returns {*} The expanded version of `value`, or a promise thereto.
   */
  #expand0(value, doAsync) {
    const directives = new Map(this.#directives);
    const workspace  = new ExpanderWorkspace(directives, this.#baseDir, value);

    return doAsync
      ? workspace.expandAsync()
      : workspace.expandSync();
  }
}
