// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { TreePathKey } from '@this/collections';
import { IntfLogger } from '@this/loggy-intf';
import { MustBe } from '@this/typey';

import { IntfComponent } from '#x/IntfComponent';
import { Names } from '#x/Names';
import { ThisModule } from '#p/ThisModule';


/**
 * Forward declaration of this subclass, because `import`ing it would cause a
 * circular dependency while loading.
 *
 * @typedef RootControlContext
 * @type {ControlContext}
 */

/**
 * "Context" in which a {@link IntfComponent} is situated. Instances of this
 * class are handed to controllables via {@link IntfComponent#init}, which gets
 * called when they become hooked into a hierarchy of instances.
 */
export class ControlContext {
  /**
   * Logger to use, `null` to not do any logging, or `false` if not yet set up.
   *
   * @type {?IntfLogger}
   */
  #logger = false;

  /**
   * Current component state.
   *
   * @type {string}
   */
  #state = 'stopped';

  /**
   * Associated controllable instance. Is only ever `null` for the context of
   * the root instance itself, and only briefly while it gets bootstrapped.
   *
   * @type {?IntfComponent}
   */
  #associate;

  /**
   * Key which indicates where this instance is in the component hierarchy.
   *
   * @type {TreePathKey}
   */
  #pathKey;

  /**
   * Instance which represents the parent (container) of this instance's
   * associated controllable, or `null` if this instance has no parent (that is,
   * is the root of the containership hierarchy).
   *
   * @type {?ControlContext}
   */
  #parent;

  /**
   * Instance which represents the root of the containership hierarchy.
   *
   * @type {RootControlContext}
   */
  #root;

  /**
   * Constructs an instance.
   *
   * @param {IntfComponent|string} associate Associated component instance, or
   *   the string `root` if this instance is to represent the root instance.
   * @param {?IntfComponent} parent Parent of `associate`, or `null` if this
   *   instance is to represent the root instance.
   * @param {?IntfLogger} [loggerObsolete] Old unused logger argument. Throws an
   *   error if used.
   */
  constructor(associate, parent, loggerObsolete = null) {
    if (loggerObsolete !== null) {
      // TODO: Remove this check once client code is believed to be fixed.
      throw new Error('Stop passing a non-`null` logger.');
    }

    if (associate === 'root') {
      this.#associate = null; // Gets set in `linkRoot()`.
      this.#parent    = null; // This will remain `null` forever.
      this.#root      = this;
      this.#pathKey   = TreePathKey.EMPTY;
      // Note: We can't used `#root.contextTree` here, because we're still in
      // the middle of constructing `#root`. That gets fixed in `linkRoot()`,
      // which gets called soon after this instance is constructed.
    } else {
      // TODO: We should figure out how to type-check interfaces.
      this.#associate = associate;
      this.#parent    = MustBe.instanceOf(parent.context, ControlContext);
      this.#root      = MustBe.instanceOf(this.#parent.#root, /*Root*/ControlContext);
      this.#pathKey   = parent.context.#pathKeyForChild(associate);

      this.#root[ThisModule.SYM_contextTree].add(this.#pathKey, this);
    }
  }

  /** @returns {IntfComponent} Associated controllable instance. */
  get associate() {
    return this.#associate;
  }

  /** @returns {?IntfLogger} Logger to use, or `null` to not do any logging. */
  get logger() {
    if (this.#logger === false) {
      let logger = this.#root.rootLogger ?? null;
      if (logger) {
        for (const k of this.#pathKey.path) {
          logger = logger[k];
        }
      }
      this.#logger = logger;
    }

    return this.#logger;
  }

  /**
   * @returns {?ControlContext} Instance which represents the parent of this
   * instance's {@link #associate}, or `null` if this instance represents the
   * root of the containership hierarchy.
   */
  get parent() {
    return this.#parent;
  }

  /**
   * @returns {ControlContext} Instance which represents the root of the
   * containership hierarchy.
   */
  get root() {
    if (this.#root === null) {
      throw new Error('Root setup was incomplete.');
    }

    return this.#root;
  }

  /**
   * @returns {string} Current component state. One of:
   *
   * * `stopped` -- Initialized but not running.
   * * `running` -- Currently running.
   */
  get state() {
    return this.#state;
  }

  /**
   * Gets a the compoenent at the given path from the root of this instance,
   * which optionally must be of a specific class (including a base class).
   *
   * @param {Array<string>|TreePathKey|string} path Absolute path to the
   *   component. If a string, must be parseable as a path by {@link
   *   Names#parsePath}.
   * @param {...function(new:IntfComponent)} [classes] List of classes and/or
   *   interfaces which the result must be an instance of or implement
   *   (respectively).
   * @returns {IntfComponent} Found instance.
   * @throws {Error} Thrown if a suitable instance was not found.
   */
  getComponent(path, ...classes) {
    const result = this.#root.getComponentOrNull(path, ...classes);

    if (result === null) {
      path = Names.parsePathOrNull(path);
      if (path === null) {
        throw new Error('Non-`null` component path is required.');
      } else {
        throw new Error(`No such component: ${Names.pathStringFrom(path)}`);
      }
    }

    return result;
  }

  /**
   * Like {@link #getComponent}, but returns `null` if there is no component
   * with the indicated path or if `path` was passed as `null` or `undefined`.
   * If there _is_ a component at the path but its class doesn't match, that's
   * still an error.
   *
   * @param {?Array<string>|TreePathKey|string} path Absolute path to the
   *   component, or `null`-ish to always not-find an instance. If a string,
   *   must be parseable as a path by {@link Names#parsePath}.
   * @param {...function(new:IntfComponent)} [classes] List of classes and/or
   *   interfaces which the result must be an instance of or implement
   *   (respectively).
   * @returns {?IntfComponent} Found instance, or `null` if there was none.
   * @throws {Error} Thrown if a suitable instance was not found.
   */
  getComponentOrNull(path, ...classes) {
    return this.#root.getComponentOrNull(path, ...classes);
  }

  /**
   * Underlying implementation of the method `BaseComponent.linkRoot()`. This is
   * a module-private method, so that it can only be called when appropriate
   * (and thus avoid inconsistent state).
   *
   * @param {IntfComponent} root The actual "root" instance.
   */
  [ThisModule.SYM_linkRoot](root) {
    // TODO: We should figure out how to type-check interfaces.
    // MustBe.instanceOf(root, IntfComponent);

    if (this.#root !== this) {
      throw new Error('Not a root instance.');
    } else if (root.context !== this) {
      throw new Error('Context mismatch.');
    } else if (this.#associate !== null) {
      throw new Error('Already linked.');
    }

    this.#associate = root;
    this.#root[ThisModule.SYM_contextTree].add(this.#pathKey, this);
  }

  /**
   * Changes the {@link #state}. This is a module-private method, so that it can
   * only be called by the `BaseComponent` lifecycle methods.
   *
   * @param {string} state The new state.
   */
  [ThisModule.SYM_setState](state) {
    this.#state = state;
  }

  /**
   * Gets the path key to use for the given component, which is to be a child
   * of this one. If the component doesn't already have a name, this will
   * synthesize one based on its class.
   *
   * @param {IntfComponent} component The will-be child component.
   * @returns {TreePathKey} The key to use for it.
   */
  #pathKeyForChild(component) {
    const { name } = component;
    const thisKey  = this.#pathKey;

    if (name) {
      return thisKey.concat(name);
    }

    // The hard case: Find a unique name of the form `<lowerCamelClass><count>`.
    // TODO: Perhaps this can be made more efficient, especially in that we're
    // iterating down into tree levels that don't matter for the calculation.

    const prefix   = ControlContext.#namePrefixFrom(component);
    const matches  = new Set();
    const matchKey = thisKey.withWildcard(true);
    const ctxTree  = this.#root[ThisModule.SYM_contextTree];

    for (const [key] of ctxTree.findSubtree(matchKey)) {
      const lastComponent = key.path[key.path.length - 1];
      if (lastComponent.startsWith(prefix)) {
        matches.add(lastComponent.slice(prefix.length));
      }
    }

    let count;
    for (count = 1; /*empty*/; count++) {
      if (!matches.has(`${count}`)) {
        break;
      }
    }

    return thisKey.concat(`${prefix}${count}`);
  }

  //
  // Static members
  //

  /**
   * Gets a component name prefix based on the name of the class of the given
   * component.
   *
   * @param {IntfComponent} component The component in question.
   * @returns {string} A reasonable prefix to use for its name.
   */
  static #namePrefixFrom(component) {
    const className = component.constructor?.name;

    if (!className) {
      // Shouldn't happen, but this is better than crashing.
      return 'strangeComponent';
    }

    return `${className[0].toLowerCase()}${className.slice(1)}`;
  }
}
