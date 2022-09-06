// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { JsonDirective } from '#x/JsonDirective';

import * as util from 'node:util';

/**
 * Directive `$await`, for deferring an arbitrary computation. This is used
 * internally to implement other asynchronous directives. The bound value is
 * expected to be either a promise or a function which returns something which
 * is to be `await`ed.
 */
export class AwaitDirective extends JsonDirective {
  /** @type {ExpanderWorkspace} Associated workspace. */
  #workspace;

  /**
   * @type {{then: function(function(*), function(*))}} Promise (or `then`able)
   * which resolves to the ultimate replacement for this instance.
   */
  #promise = null;

  /** @type {*} Resolved value, if known. */
  #resolvedValue = null;

  /** @type {boolean} Has this been resolved? */
  #isResolved = false;

  /**
   * Constructs an instance.
   *
   * @param {ExpanderWorkspace} workspace The associated workspace.
   */
  constructor(workspace) {
    super();
    this.#workspace = workspace;
  }

  /**
   * Gets the resolved value.
   *
   * @return

  /** @override */
  process(pass, path, value) {
    switch (pass) {
      case 1:  return this.#pass1(path, value);
      case 2:  return this.#pass2(path, value);
      default: throw new Error(`Bad pass: ${pass}`);
    }
  }

  /**
   * Runs pass 1.
   *
   * @param {(string|number)[]} path_unused Path within the value being worked
   *   on.
   * @param {*} value Sub-value at `path`.
   * @returns {object} Replacement for `value`, per the documentation of
   *   {@link JsonDirective.process}.
   */
  #pass1(path, value) {
    if (typeof value === 'function') {
      this.#promise = value();
    } else if (typeof value?.then === 'function') {
      this.#promise = value;
    } else {
      throw new Error(`Bad value for \`${AwaitDirective.NAME}\` at ${util.format('%o', path)}.`);
    }

    return { same: true };

    /*
    this.#workspace.addPromise(
      (async () => {
        this.#resolvedValue = await this.#promise;
        this.#isResolved = true;
      })());
    */
  }

  /**
   * Runs pass 2.
   *
   * @param {(string|number)[]} path Path within the value being worked on.
   * @param {*} value Sub-value at `path`.
   * @returns {object} Replacement for `value`, per the documentation of
   *   {@link JsonDirective.process}.
   */
  #pass2(path, value) {
    return {
      replace: this.#promise,
      await:   true,
      outer:   true
    };

    /*
    if (!this.#isResolved) {
      throw new Error(`Unresolved value at `${util.format('%o', path)}.`);
    }

    return this.#resolvedValue;
    */
  }


  //
  // Static members
  //

  /** @override */
  static get NAME() {
    return '$await';
  }

  /** @override */
  static get REQUIRES() {
    return Object.freeze([]);
  }
}
