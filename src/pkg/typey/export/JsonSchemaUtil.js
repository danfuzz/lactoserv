// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import * as util from 'node:util';

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
}
