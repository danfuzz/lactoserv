// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { AskIf, MustBe } from '@this/typey';


/**
 * Base class for type-checked "structures." Each concrete subclass is expected
 * to pass an object in its `super()` constructor call (or pass nothing or
 * `null` for an all-default construction) which is suitable for parsing by this
 * (base) class. This class defines the mechanism by which an object gets mapped
 * into properties on the constructed instance, including running validation on
 * each property and a final overall validation.
 *
 * Instances of this class are always frozen.
 */
export class BaseStruct {
  /**
   * Constructs an instance. The argument, if non-`null`, is taken to be a
   * "plain-like" object, in that its "own" enumerable string-keyed properties
   * are what matter. Instances of (concrete subclasses of) this class can be
   * used as arguments.
   *
   * @param {?object} [rawObject] Raw object to parse, or `null` to have all
   *   default values. Passing `null` is equivalent to passing `{}` (an empty
   *   plain object).
   */
  constructor(rawObject = null) {
    rawObject = (rawObject === null) ? {} : MustBe.object(rawObject);

    this.#fillInObject(rawObject);
    Object.freeze(this);
  }

  /**
   * Checks to see if a property name is allowed. This is called by the base
   * class for any encountered property which doesn't have a corresponding
   * `_prop_*()` method and which doesn't already exist in the class (shadowing
   * a pre-existing property isn't allowed). If it returns `true`, then the
   * property-value pair is passed to {@link #_impl_extraProperty} for further
   * processing. The default (base class) implementation always returns `false`.
   *
   * @param {string} name Property name.
   * @returns {boolean} `true` if `name` is allowed on the instance, or `false`
   *   if not.
   */
  _impl_allowExtraProperty(name) { // eslint-disable-line no-unused-vars
    return false;
  }

  /**
   * Like a `_prop_*()` (etc.) method, but called for any property whose name
   * does not have a corresponding `_prop_*()` method and for which
   * {@link #allowExtraProperty} returned `true`. It gets passed both the
   * property name _and_ the value. The default (base class) implementation
   * always returns the given value.
   *
   * @param {string} name Property name.
   * @param {*} value Proposed property value.
   * @returns {*} Accepted property value.
   */
  _impl_extraProperty(name, value) { // eslint-disable-line no-unused-vars
    return value;
  }

  /**
   * Gets the prefix used on instance members of the class which are to be
   * treated as property-checker methods. This is `prop` by default. Subclasses
   * should override this as appropriate for their context.
   *
   * @returns {string} The property-checker prefix, as a plain word (not
   *   surrounded by underscores).
   */
  _impl_propertyPrefix() {
    return 'prop';
  }

  /**
   * Validates a processed struct object, optionally changing properties, prior
   * to actually setting its properties on this instance. Subclasses should
   * override this if they need to do any final validation or tweakage. The base
   * class implementation of this method returns its argument (that is, it does
   * nothing), but concrete subclasses should check their own immediate
   * superclasses for requirements about calling `super()`.
   *
   * @param {object} lessRawObject Processed object (which started as a
   *   `rawObject`).
   * @returns {object} Final object to use for setting properties on `this`.
   */
  _impl_validate(lessRawObject) {
    return lessRawObject;
  }

  /**
   * Fills in a property on `this` for each property that is covered by a
   * property-checker method (prefix `_prop_` by default) defined by the actual
   * (concrete) class of `this`. If the given `rawObject` doesn't have a
   * property for any given checker method, that method is called with no
   * argument, to give it a chance to use a default value or simply reject it
   * for not being filled in. After making all such calls, this method then
   * calls {@link #_impl_validate} to allow the concrete subclass to do any
   * final validation and tweakage.
   *
   * **Note:** This method treats `undefined` in raw objects like `null` and
   * will only pass `null` per se into a checker method. And it throws an error
   * if a checker returns `undefined`, on the assumption that it is missing an
   * explicit `return`.
   *
   * **Note:** For the sake of determinism, this method calls checker methods in
   * Unicode sort order.
   *
   * @param {object} rawObject Raw object.
   */
  #fillInObject(rawObject) {
    const checkers    = this.#findPropertyCheckers();
    const sortedNames = [...checkers.keys()].sort();
    const props       = {};
    const leftovers   = new Set(Object.keys(rawObject));

    for (const name of sortedNames) {
      const checker = checkers.get(name);
      const hasName = leftovers.has(name);

      try {
        const value = hasName
          ? this[checker](rawObject[name])
          : this[checker]();

        if (value === undefined) {
          throw new Error(`Property checker \`${checker}()\` did not return a value. Maybe missing a \`return\`?`);
        }

        props[name] = value;

        if (hasName) {
          leftovers.delete(name);
        }
      } catch (e) {
        if (!hasName) {
          // This could also be due to a bug in the concrete struct class.
          throw new Error(`Missing required property: \`${name}\``);
        }
        throw e;
      }
    }

    if (leftovers.size !== 0) {
      const disallowed = [];

      for (const name of leftovers) {
        if (Reflect.has(this, name)) {
          throw new Error(`Extra property would shadow pre-existing property: ${name}`);
        } else if (this._impl_allowExtraProperty(name)) {
          const value = this._impl_extraProperty(name, rawObject[name]);
          if (value === undefined) {
            throw new Error(`Extra property checker \`_impl_extraProperty()\` did not return a value. Maybe missing a \`return\`?`);
          }
          props[name] = value;
        } else {
          disallowed.push(name);
        }
      }

      if (disallowed.length !== 0) {
        const names = disallowed.join(', ');
        const word  = (disallowed.length === 1) ? 'property' : 'properties';
        throw new Error(`Extra ${word}: \`${names}\``);
      }
    }

    const finalProps = this._impl_validate(props);

    if (finalProps === undefined) {
      throw new Error(`\`_impl_validate()\` did not return a value. Maybe missing a \`return\`?`);
    }

    for (const [key, value] of Object.entries(finalProps)) {
      Reflect.defineProperty(this, key, {
        configurable: false,
        enumerable:   true,
        writable:     false,
        value
      });
    }
  }

  /**
   * Finds all the property-checker methods on `this`, returning a map from the
   * plain property name to the check method name.
   *
   * @returns {Map<string, string>} The map from property names to corresponding
   *   checker method names.
   */
  #findPropertyCheckers() {
    const result = new Map();
    const prefix = `_${this._impl_propertyPrefix()}_`;
    let   target = this;


    for (;;) {
      const keys = Reflect.ownKeys(target);

      for (const k of keys) {
        if (!((typeof k === 'string') && k.startsWith(prefix))) {
          continue;
        }

        const name = k.slice(prefix.length);

        if (!result.has(name)) {
          const pd = Reflect.getOwnPropertyDescriptor(target, k);
          if (typeof pd.value === 'function') {
            result.set(name, k);
          }
        }
      }

      target = Reflect.getPrototypeOf(target);

      if (!target || (target.constructor === Object)) {
        break;
      }
    }

    return result;
  }


  //
  // Static members
  //

  /**
   * "Evaluate" a raw object to produce an instance of this class. This is meant
   * as a way to help classes accept "duck-type compatible" objects and convert
   * them to actual struct instances, while also transparently just accepting
   * actual instances.
   *
   * This method is expected to be called on a concrete subclass of this (base)
   * class, and the actual called class is used to drive the salient portion of
   * the error checking and other processing.
   *
   * @param {?object} rawObject Raw object, including allowing `null` to be
   *   equivalent to `{}`, and accepting an instance of this class.
   * @param {object} options Evaluation options.
   * @param {object} [options.defaults] Default values when evaluating a plain
   *   object. Defaults to `{}`.
   * @returns {BaseStruct} Instance of the concrete class that this method was
   *   called on.
   */
  static eval(rawObject, { defaults = {} } = {}) {
    rawObject ??= {};

    if (rawObject instanceof this) {
      return rawObject;
    } else if (rawObject instanceof BaseStruct) {
      // It's the wrong concrete class.
      const gotName = rawObject.constructor.name;
      throw new Error(`Incompatible struct class: expected ${this.name}, got ${gotName}`);
    } else if (!AskIf.plainObject(rawObject)) {
      if (typeof rawObject === 'object') {
        const gotName = rawObject.constructor.name;
        throw new Error(`Cannot convert non-struct object: expected ${this.name}, got ${gotName}`);
      } else {
        const gotType = typeof rawObject;
        throw new Error(`Cannot evaluate non-object as struct: expected ${this.name}, got ${gotType}`);
      }
    }

    // It's a plain object.

    let finalObj = rawObject; // Might get replaced by a modified copy.

    const defaultProp = (k, v) => {
      if (!Reflect.has(finalObj, k)) {
        if (finalObj === rawObject) {
          finalObj = { ...rawObject };
        }
        finalObj[k] = v;
      }
    };

    for (const [k, v] of Object.entries(defaults)) {
      defaultProp(k, v);
    }

    return new this(finalObj);
  }
}
