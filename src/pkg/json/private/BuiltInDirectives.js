// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { AwaitDirective } from '#p/AwaitDirective';
import { BaseDirDirective } from '#p/BaseDirDirective';
import { DefsDirective } from '#p/DefsDirective';
import { JsonDirective } from '#x/JsonDirective';
import { RefDirective } from '#p/RefDirective';

/**
 * Repository for all the built-in directives.
 */
export class BuiltInDirectives {
  /**
   * @type {Map<string, function(new:JsonDirective)>} Map from each directive
   * name the directive class which implements it.
   */
  static #DIRECTIVE_CLASSES = this.#makeMap(
    AwaitDirective,
    BaseDirDirective,
    DefsDirective,
    RefDirective);

  /**
   * Adds all the built-in directive classes to the given map.
   *
   * @param {Map<string, function(new:JsonDirective)>} map The map to add to.
   */
  static addAllDirectivesTo(map) {
    for (const [name, cls] of this.#DIRECTIVE_CLASSES) {
      if (!map.has(name)) {
        map.set(name, cls);
      }
    }
  }

  /**
   * Adds all the named built-in directive classes to the given map, along with
   * any needed dependent directives.
   *
   * @param {Map<string, function(new:JsonDirective)>} map The map to add to.
   * @param {string[]} names The directive names.
   * @throws {Error} Thrown if there is no directive with one of the given
   *   names.
   */
  static addDirectivesTo(map, ...names) {
    for (;;) {
      const reqs = [];

      for (const name of names) {
        if (!map.has(name)) {
          const directive = this.getDirective(name);
          map.set(name, directive);
          reqs.push(...directive.REQUIRES);
        }
      }

      if (reqs.length === 0) {
        break;
      }

      names = reqs;
    }
  }

  /**
   * Gets the directive class with the given name.
   *
   * @param {string} name The name.
   * @returns {function(new:JsonDirective)} Corresponding directive class.
   * @throws {Error} Thrown if there is no directive with the given name.
   */
  static getDirective(name) {
    const result = this.#DIRECTIVE_CLASSES.get(name);

    if (!result) {
      throw new Error(`No such directive: ${name}`);
    }

    return result;
  }

  /**
   * Makes a map for the given directive classes, based on the name defined in
   * each.
   *
   * @param {(function(new:JsonDirective))[]} classes Classes to map-ify.
   * @returns {Map<string, function(new:JsonDirective)>} Corresponding map.
   */
  static #makeMap(...classes) {
    const result = new Map();

    for (const c of classes) {
      result.set(c.NAME, c);
    }

    return result;
  }
}
