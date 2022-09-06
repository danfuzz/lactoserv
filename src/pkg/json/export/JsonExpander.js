// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { BuiltInDirectives } from '#p/BuiltInDirectives';
import { ExpanderWorkspace } from '#p/ExpanderWorkspace';
import { JsonDirective } from '#x/JsonDirective';

/**
 * Processor for JSON objects, which knows how to expand it by following
 * embedded directives. Directives are in the form of objects with distinctive
 * keys. The built-in directives are:
 *
 * * `{ $defs: { <key>: <value>, ... } }` -- At the top level, recognized as a
 *   set of definitions which can be referenced. Is omitted from the result of
 *   expansion. Not allowed anywhere other than the top level.
 * * `{ $ref: "#/$defs/<key>" }` -- Expanded into the value defined under
 *   `$defs`. The path is intentionally more restrictive than what one gets with
 *   JSON Schema and really has to begin `#/$defs/`. This will be loosened up if
 *   and when there is an actual need.
 * * `{ $replaceOuter: <value> }` -- Indicates that the object in which this
 *   appears should be replaced entirely by the listed `value`.
 */
export class JsonExpander {
  /**
   * @type {Map<string, function(new:JsonDirective)>} Map from names to
   * corresponding directive-handler classes, for all directives recognized by
   * this instance.
   */
  #directives = new Map();

  /**
   * Constructs a new instance. By default, it includes all built-in directives.
   *
   * @param {boolean} [builtInDirectives = true] Should the built-in directives
   *   be recognized by this instance?
   */
  constructor(builtInDirectives = true) {
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
   * Expands the given JSON value.
   *
   * @param {*} value The original value.
   * @returns {*} The expanded version of `value`.
   */
  expand(value) {
    const workspace = new ExpanderWorkspace(value);

    for (const [name, cls] of this.#directives) {
      workspace.addDirective(name, new cls(workspace));
    }

    return workspace.process();
  }
}
