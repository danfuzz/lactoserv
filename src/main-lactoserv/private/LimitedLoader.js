// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'node:fs/promises';
import * as timers from 'node:timers/promises';
import { Module, SourceTextModule, SyntheticModule, default as vm } from 'node:vm';

import { IntfLogger } from '@this/loggy';
import { MustBe } from '@this/typey';


/**
 * "Limited loader" which enables the loading of files as modules in a loader
 * context that limits what's available in terms of further `import` and which
 * maintains its own independent cache of what's been loaded. This is used to
 * load configuration files without exposing implementation details of the
 * system, and (by instantiating different instances of this class) to enable
 * re-loading of the same config file (e.g. because the user indicates it has
 * been changed).
 *
 * About "contexts:" See the Node and V8 documentation about details, but TLDR:
 * If you want to run in a non-default context but have the system behave at
 * least mostly-normal, set up your context as an object which has the default
 * `global` as its prototype, like this: `Object.assign(Object.create(global))`
 * Be aware, though, that the "primordial" types -- such as `Object` and `Array`
 * -- in a non-default context are not `===` to the ones in the default context.
 *
 * **Note:** There are lots of _incidental_ limitations in terms of what can be
 * loaded via this class. The intention is to expand the capabilities of this
 * class as needed in practice.
 */
export class LimitedLoader {
  /**
   * @type {?object} "Contextified" object which is bound as `global` in loaded
   * modules.
   */
  #context;

  /** @type {?IntfLogger} Logger to use, or `null` not to do any logging. */
  #logger;

  /**
   * @type {Map<string, Module>} Map from each specifier that has been loaded to
   * the resulting module instance.
   */
  #cache = new Map();

  /**
   * @type {function(string, Module, object)} Linker function, passed to
   * `module.link()`.
   */
  #linker = (specifier, refModule_unused, extra) => {
    return this.#importModule(specifier, extra);
  };

  /**
   * Constructs an instance.
   *
   * @param {?object} [context = null] Context to use. This is the object which
   *   becomes the `global` of any loaded code. If `null`, this uses the same
   *   context that this class is run in.
   * @param {?IntfLogger} [logger = null] Logger to use, or `null` not to do any
   *   logging.
   */
  constructor(context = null, logger = null) {
    this.#context = context;
    this.#logger  = (logger === null)
      ? null
      : MustBe.instanceOf(logger, IntfLogger);

    if (context && !vm.isContext(context)) {
      vm.createContext(context);
    }
  }

  /**
   * Loads the module indicated by the given specifier. Specifiers are the same
   * sorts of things as those used by the `import ...` or `import(...)` syntax.
   * This returns the loaded (and evaluated) module upon successful evaluation
   * or throws whatever error was caused during the procedure.
   *
   * @param {string} specifier Specifier for the module to import.
   * @returns {Module} The module resulting from loading the code at
   *   `specifier`.
   */
  async load(specifier) {
    if (specifier instanceof URL) {
      specifier = specifier.href;
    }

    const result = await this.#importModule(specifier, {});
    await this.#evaluate(result);
    return result;
  }

  /**
   * Loads and runs the given script (source text). This returns the `Module`
   * that was created for the script upon successful evaluation, or throws
   * whatever error was caused during the procedure.
   *
   * @param {string} script Script (source text) to run.
   * @returns {Module} The module resulting from `script`'s evaluation.
   */
  async runScript(script) {
    const result = new SourceTextModule(script, this.#defaultOptions());
    await this.#evaluate(result);
    return result;
  }

  /**
   * Gets the default module constructor options to use with this instance.
   *
   * @returns {object} The options.
   */
  #defaultOptions() {
    return this.#context
      ? { context: this.#context }
      : {};
  }

  /**
   * Completes the linking and evaluation of the given module. This returns
   * `undefined` upon successful evaluation or throws whatever error was caused
   * during the procedure.
   *
   * @param {Module} module The module to link and evaluate.
   */
  async #evaluate(module) {
    for (;;) {
      switch (module.status) {
        case 'unlinked': {
          this.#logger?.linking(module.identifier);
          await module.link(this.#linker);
          this.#logger?.linked(module.identifier);
          break;
        }

        case 'linked': {
          this.#logger?.evaluating(module.identifier);
          const result = module.evaluate();

          (async () => {
            try {
              await result;
              this.#logger?.evaluated(module.identifier);
            } catch (e) {
              this.#logger?.evaluationError(module.identifier, e);
            }
          })();

          return result;
        }

        case 'evaluating':
        case 'linking': {
          // TODO: Wait in a better way.
          await timers.setTimeout(10);
          break;
        }

        default: {
          return module.evaluate();
        }
      }
    }
  }

  /**
   * Constructs and returns a module whose contents should be loaded from the
   * given specifier. If the specifier has already been constructed, this
   * returns the previously-constructed instance.
   *
   * @param {string} specifier The module specifier.
   * @param {object} [extra = null] Extra options that came with the import
   *   request, or `null` if there were none.
   * @returns {Module} The (nascently) imported module
   */
  async #importModule(specifier, extra = null) {
    const { assert } = extra ?? {};
    if (assert && Object.getOwnPropertyNames(assert).length !== 0) {
      // TODO: Perhaps don't ignore `assert`.
      this.#logger?.ignoringImportAssert(specifier, assert);
    }

    const found = this.#cache.get(specifier);

    if (found) {
      this.#logger?.importedFromCache(specifier);
      return found;
    }

    this.#logger?.importing(specifier);

    let result;

    if (specifier.startsWith('node:')) {
      const orig = await import(specifier);
      const keys = Reflect.ownKeys(orig).filter((k) => typeof k === 'string');
      result = new SyntheticModule(keys, () => {
        for (const k of keys) {
          result.setExport(k, orig[k]);
        }
      }, this.#defaultOptions());
    } else if (specifier.startsWith('file:///')) {
      const text = await fs.readFile(new URL(specifier), 'utf8');
      result = new SourceTextModule(text, {
        ...this.#defaultOptions(),
        identifier: specifier,
        initializeImportMeta: (meta, module_unused) => {
          meta.url = specifier;
        }
      });
    } else {
      // This very well may be a legit case! If you find yourself looking at
      // this message, then please consider adding code to reasonably handle the
      // `import` specifier in question.
      this.#logger?.unhandledLoaderCase(specifier);
      throw new Error(`Unhandled import specifier: ${specifier}`);
    }

    this.#logger?.imported(specifier);

    this.#cache.set(specifier, result);
    return result;
  }
}
