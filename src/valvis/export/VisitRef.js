// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Sexp } from '@this/sexp';
import { MustBe } from '@this/typey';

import { BaseDefRef } from '#x/BaseDefRef';
import { VisitDef } from '#x/VisitDef';


/**
 * Representative of the result of a visit of a value that had been visited
 * elsewhere during a visit.
 *
 * Along with just having a record of the shared nature of the structure,
 * instances of this class are also instrucmental in "breaking" circular
 * references during visits, making it possible to fully visit values that have
 * such circular references.
 */
export class VisitRef extends BaseDefRef {
  /**
   * This instance's corresponding def.
   *
   * @type {VisitDef}
   */
  #def;

  /**
   * Constructs an instance.
   *
   * @param {VisitDef} def The corresponding def.
   */
  constructor(def) {
    MustBe.instanceOf(def, VisitDef);

    const valueArg = def.isFinished() ? [def.value] : [];
    super(def.index, ...valueArg);

    this.#def = def;
  }

  /** @override */
  get def() {
    return this.#def;
  }

  /** @override */
  get ref() {
    return this;
  }

  /** @override */
  get value() {
    return this.#def.value;
  }

  /** @override */
  deconstruct(forLogging_unused) {
    return new Sexp(this.constructor, this.#def);
  }

  /** @override */
  isFinished() {
    return this.#def.isFinished();
  }

  /**
   * Implementation of the standard `JSON.stringify()` replacement interface.
   *
   * **Note:** This is not intended for high-fidelity data encoding, in that the
   * result is ambiguous with plain objects that happen to have the same shape
   * as this method's results. The main use for this is that this is what Jest
   * uses when printing out equality errors in test cases.
   *
   * @param {?string} key_unused The property name / stringified index where the
   *   instance was fetched from.
   * @returns {*} The replacement form to encode.
   */
  toJSON(key_unused) {
    return { '@ref': [this.index] };
  }
}
