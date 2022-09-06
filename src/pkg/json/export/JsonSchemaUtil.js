// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

/**
 * Utilities for dealing with JSON Schema.
 */
export class JsonSchemaUtil {
  /**
   * Creates a schema which accepts an object _either_ with a singular `<item>`
   * matching a given sub-schema, _or_ a plural `<item>s` matching an array of
   * the same sub-schema.
   *
   * @param {string} nameSingular The singular form of the name.
   * @param {string} namePlural The plural form of the name.
   * @param {object} subSchema The schema for one matched item.
   * @returns {object} An appropriately-constructed schema.
   */
  static singularOrPlural(nameSingular, namePlural, subSchema) {
    return {
      oneOf: [
        {
          type: 'object',
          required: [nameSingular],
          properties: {
            [nameSingular]: subSchema
          }
        },
        {
          type: 'object',
          required: [namePlural],
          properties: {
            [namePlural]: {
              type: 'array',
              uniqueItems: true,
              items: subSchema
            }
          }
        }
      ]
    };
  }

  /**
   * Combines an optional single item with an optional array to produce an
   * array of all elements. This is used to conveniently merge a pair of
   * singular-or-plural property pairs, as validated for example by a schema
   * produced by {@link #singularOrPlural} into a unified and frozen whole.
   *
   * @param {?*} item Optional single item.
   * @param {?*[]} items Optional array.
   * @returns {*[]} Combined array, which is also frozen.
   */
  static singularPluralCombo(item, items) {
    const itemArray = item ? [item] : [];
    const itemsArray = items ?? [];

    return Object.freeze([...itemArray, ...itemsArray]);
  }
}
