// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ExpanderWorkspace } from '#p/ExpanderWorkspace';

import { Methods, MustBe } from '@this/typey';

/**
 * Base class for directives used by {@link JsonExpander}.
 */
export class JsonDirective {
  /**
   * Constructs an instance. This base class constructor merely validates the
   * arguments. It's up to subclasses to do something useful with them.
   *
   * @param {ExpanderWorkspace} workspace Associated workspace.
   * @param {string} path Path within the result where this directive resides.
   * @param {*} dirArg Directive argument. This is the `arg` in `{ $directive:
   *   arg }`.
   * @param {object} dirValue The object in which the directive appeared, minus
   *   the directive binding.
   */
  // eslint-disable-next-line no-unused-vars
  constructor(workspace, path, dirArg, dirValue) {
    MustBe.object(workspace, ExpanderWorkspace);
    MustBe.arrayOfIndex(path);
    MustBe.object(dirValue);
  }

  /**
   * Process the directive defined by this instance.
   *
   * @abstract
   * @returns {{action: string}} Action to take, indicated as an object with one
   *   of these `action` values:
   *   * `again` with optional `{ enqueue: object[], value: * }` -- Queue up
   *     more processing. With no additional bindings, the same directive is
   *     requeued as-is. Other bindings:
   *     * `{ value: * }` -- Instead of the original directive, queue up the
   *       given value for expansion. The directive is considered complete.
   *     * `{ enqueue: object[] }` -- _Also_ queue up more values for expansion.
   *       Each item of the `enqueue` array must be an object of the form
   *       `{ path: *(number|string)[], value: *, complete: function }`. In this
   *       case, `path` is the _partial_ path underneath the directive that
   *       (in some form) represents the location of the value being processed.
   *   * `delete` -- The directive resolved to "emptiness." There should be no
   *     result value for the directive, not even a `null` hole if possible. If
   *     there _must_ be some value due to other constraints, then it should be
   *     `null`.
   *   * `resolve` with `{ value: * }` and optional `{ await: true }` -- `value`
   *     should be used to replace the directive in the result, with no further
   *     expansion. With `await`, the value is `await`ed, and the resolved
   *     result becomes the replacement.
   * @returns {*} Result, as per {@link ExpanderWorkspace.process}.
   */
  process() {
    throw Methods.abstract();
  }


  //
  // Static members
  //

  /**
   * @abstract
   * @returns {boolean} `false` if instances of this directive can only appear
   *   in otherwise-empty objects, or `true` if other bindings can appear along
   *   side the directive binding.
   */
  static get ALLOW_OTHER_BINDINGS() {
    throw Methods.abstract();
  }

  /**
   * @abstract
   * @returns {string} Name of this directive.
   */
  static get NAME() {
    throw Methods.abstract();
  }

  /**
   * @abstract
   * @returns {string[]} Names of directives that this one depends on.
   */
  static get REQUIRES() {
    throw Methods.abstract();
  }
}
