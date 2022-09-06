// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { Methods } from '@this/typey';

import * as util from 'node:util';

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
 */
export class JsonExpander {
  /**
   * @type {Map<string, function(new:Directive)>} Directives recognized by this
   * instance.
   */
  #directives = new Map();

  /**
   * Constructs a new instance.
   *
   * @param {boolean} [builtInDirectives = true] Should the built-in directives
   *   be recognized by this instance?
   */
  constructor(builtInDirectives = true) {
    if (builtInDirectives) {
      this.addDirective(DefsDirective);
      this.addDirective(RefDirective);
    }
  }

  /**
   * Adds a directive.
   *
   * @param {function(new:Directive)} directive The directive to add.
   */
  addDirective(directive) {
    const key = directive.KEY;

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
    const workspace = new Workspace(value);

    for (const [name, cls] of this.#directives) {
      workspace.addDirective(name, new cls(workspace));
    }

    return workspace.process();
  }
}

/**
 * Workspace for running an expansion.
 */
class Workspace {
  /** @type {Map<string, Directive>} Directives recognized by this instance. */
  #directives = new Map();

  /** @type {*} Original value being worked on. */
  #originalValue;

  /**
   * Constructs an instance.
   *
   * @param {*} value Value to be worked on.
   */
  constructor(value) {
    this.#originalValue = value;
  }

  /**
   * Adds a directive _instance_.
   *
   * @param {string} name The name of the directive.
   * @param {Directive} directive The directive instance.
   */
  addDirective(name, directive) {
    this.#directives.set(name, directive);
  }

  /**
   * Gets an existing directive _instance_.
   *
   * @param {string} name The name of the directive.
   * @returns {Directive} The directive instance.
   * @throws {Error} Thrown if there is no directive with the given name.
   */
  getDirective(name) {
    const result = this.#directives.get(name);

    if (!result) {
      throw new Error(`No such directive: ${name}`);
    }

    return result;
  }

  /**
   * Performs the expansion.
   *
   * @returns {*} The result of expansion.
   * @throws {Error} Thrown if there was any trouble during expansion.
   */
  process() {
    const pass1Value = this.#process0(1, [], this.#originalValue);
    const pass2Value = this.#process0(2, [], pass1Value);

    return pass2Value;
  }

  /**
   * Performs the main work of expansion.
   *
   * @param {number} pass Which pass is this?
   * @param {(string|number)[]} path Path within the value being worked on.
   * @param {*} value Sub-value at `path`.
   * @returns {*} Replacement for `value`, or with a `$replaceOuter` form the
   *   replacement for the object that `value` is in, or `undefined` to delete
   *   the property which originally held `value`.
   */
  #process0(pass, path, value) {
    outer: for (;;) {
      if (typeof value !== 'object') {
        return value;
      } else if (value instanceof Array) {
        const newValue = [];
        for (let i = 0; i < value.length; i++) {
          const v = this.#process0(pass, [...path, i], value[i]);
          if (v !== undefined) {
            newValue.push(v);
          }
        }
        return newValue;
      }

      const newValue = {};

      for (const key of Object.keys(value).sort()) {
        const directive = this.#directives.get(key);
        const subPath   = [...path, key];
        let   subValue  = value[key];

        if (directive) {
          subValue = directive.process(pass, subPath, subValue);
          if (subValue?.$replaceOuter) {
            value = subValue.$replaceOuter;
            continue outer;
          }
        }

        subValue = this.#process0(pass, subPath, subValue);
        if (subValue !== undefined) {
          newValue[key] = subValue;
        }
      }

      return newValue;
    }
  }
}

/**
 * Base class for directives.
 */
class Directive {
  /**
   * Process the given directive value.
   *
   * @abstract
   * @param {number} pass Which pass is this?
   * @param {(string|number)[]} path Path within the value being worked on.
   * @param {*} value Sub-value at `path`.
   * @returns {*} Result, as per {@link Workspace.process}.
   */
  process(pass, path, value) {
    Methods.abstract(pass, path, value);
  }
}

/**
 * Directive `$defs`, for defining a dictionary of replacements.
 */
class DefsDirective extends Directive {
  /** {Map<string, *>} Map of replacements. */
  #defs = null;

  // Note: The default constructor is fine here.

  /**
   * Gets the replacement for the given named definition.
   *
   * @param {string} name Definition name.
   * @returns {*} The replacement.
   * @throws {Error} Thrown if there is no such definition.
   */
  getDef(name) {
    const defs = this.#defs;
    const def  = defs ? defs.get(name) : null;

    if (!def) {
      throw new Error(`No definition for: ${name}`);
    }

    return def;
  }

  /** @override */
  process(pass, path, value) {
    if (pass !== 1) {
      return value;
    }

    if (path.length === 1) {
      this.#defs = new Map(Object.entries(value));
      return undefined;
    } else {
      throw new Error('`$defs` only allowed at top level.');
    }
  }


  //
  // Static members
  //

  /** @type {string} Key to identify this directive. */
  static get KEY() {
    return '$defs';
  }
}

/**
 * Directive `$ref`, for looking up something from the `$defs`.
 */
class RefDirective extends Directive {
  /** {Workspace} Associated workspace. */
  #workspace;

  /** {?DefsDirective} The `$defs` directive, if known. */
  #defs = null;

  /**
   * Constructs an instance.
   *
   * @param {Workspace} workspace The associated workspace.
   */
  constructor(workspace) {
    super();
    this.#workspace = workspace;
  }

  /** @override */
  process(pass, path, value) {
    if (pass !== 2) {
      if (typeof value !== 'string') {
        throw new Error(`Bad value for reference at ${util.format('%o', path)}`);
      } else if (!value.startsWith('#/$defs/')) {
        throw new Error(`Bad syntax for reference: ${value}`);
      }
      return value;
    }

    const { name } = value.match(/^#[/][$]defs[/](?<name>.*)$/).groups;

    if (!this.#defs) {
      this.#defs = this.#workspace.getDirective('$defs');
    }

    return { $replaceOuter: this.#defs.getDef(name) };
  }


  //
  // Static members
  //

  /** @type {string} Key to identify this directive. */
  static get KEY() {
    return '$ref';
  }
}
