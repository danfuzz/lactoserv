// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ExpanderWorkspace } from '#p/ExpanderWorkspace';
import { JsonDirective } from '#x/JsonDirective';

import * as util from 'node:util';

/**
 * Directive `$baseDir`. See the package README for more details.
 */
export class AwaitDirective extends JsonDirective {
  /**
   * @type {{then: function(function(*), function(*))}} Promise (or `then`able)
   * which resolves to the ultimate replacement for this instance.
   */
  #promise = null;

  /** @override */
  constructor(workspace, path, dirArg, dirValue) {
    super(workspace, path, dirArg, dirValue);

    if (Object.entries(dirValue).length !== 0) {
      throw new Error(`\`${AwaitDirective.NAME}\` does not accept additional object values.`);
    }

    if (typeof dirArg === 'function') {
      this.#promise = (async () => dirArg())();
    } else if (typeof dirArg?.then === 'function') {
      this.#promise = dirArg;
    } else {
      throw new Error(`Bad value for \`${AwaitDirective.NAME}\` at ${util.format('%o', path)}.`);
    }
  }

  /** @override */
  process() {
    return {
      action: 'resolve',
      value:  this.#promise,
      await:  true
    };
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
