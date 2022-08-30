// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { JsonSchemaError } from '#x/JsonSchemaError';

import Ajv from 'ajv';
import ajvFormats from 'ajv-formats';

/**
 * Simple interface for JSON Schema validation.
 *
 * Useful links:
 * * JSON Schema spec: <https://json-schema.org/>
 * * AJV implementation: <https://ajv.js.org/>
 */
export class JsonSchema {
  /** {string} Schema title. */
  #title;

  /** {Ajv} Underlying validator instance. */
  #validator;

  /** {?string} The main schema's ID, if known. */
  #mainSchemaId = null;

  /**
   * Constructs an instance.
   *
   * @param {string} title The title to use to describe the data to be
   *   validated. This is used, for example, in error messages.
   */
  constructor(title) {
    this.#title = title;
    this.#validator = new Ajv({
      allErrors: true,
      verbose: true
      // discriminator: true,
      // formats: { name: format, ... },
      // schemas: { id: { ... }, ...},
      // logger: ...
    });

    ajvFormats(this.#validator);
  }

  /**
   * Adds a string format validator.
   *
   * @param {string} name The format's name.
   * @param {Function} formatValidator The format validator function.
   */
  addFormat(name, formatValidator) {
    this.#validator.addFormat(name, formatValidator);
  }

  /**
   * Adds the main schema for this instance.
   *
   * @param {object} schema The schema.
   */
  addMainSchema(schema) {
    if (this.#mainSchemaId) {
      throw new Error('Main schema already added.');
    }

    this.addSchema(schema);
    this.#mainSchemaId = schema.$id;
  }

  /**
   * Adds a schema to this instance, for use as a reference from the main
   * schema.
   *
   * @param {object} schema The schema.
   */
  addSchema(schema) {
    const id = schema.$id;
    if (!id) {
      throw new Error('Schema has no ID.');
    }

    this.#validator.addSchema(schema);
  }

  /**
   * Validate the given data against the main schema of this instance.
   *
   * @param {*} data Data to validate.
   * @returns {?JsonSchemaError} Error instance, or `null` if `data` is valid
   *   per the main schema.
   */
  validate(data) {
    const id = this.#mainSchemaId;

    if (!id) {
      throw new Error('No main schema registered with this instance.');
    }

    if (this.#validator.validate(id, data)) {
      return null;
    }

    return new JsonSchemaError(this.#title, this.#validator.errors);
  }
}
