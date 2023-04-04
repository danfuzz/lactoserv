// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { EventSink } from '@this/async';
import { BaseConverter, Converter, ConverterConfig } from '@this/data-values';
import { MustBe } from '@this/typey';

import { LogEvent } from '#x/LogEvent';
import { LogPayload } from '#x/LogPayload';


/**
 * Logging sink, which processes events by writing them in human-readable form
 * to a text file of some sort.
 */
export class TextFileSink extends EventSink {
  /** @type {string} Absolute path of the file to write to. */
  #filePath;

  /**
   * @type {function(LogPayload): Buffer|string} Function to convert an event
   * into writable form.
   */
  #formatter;

  /** @type {boolean} Has this instance ever written to the file? */
  #everWritten = false;

  /**
   * Constructs an instance.
   *
   * @param {string} format Name of the formatter to use.
   * @param {string} filePath File to write to. It is immediately resolved to an
   *   absolute path.
   * @param {LogEvent|Promise<LogEvent>} firstEvent First event to be processed
   *   by the instance, or promise for same.
   */
  constructor(format, filePath, firstEvent) {
    MustBe.string(format);
    MustBe.string(filePath);

    if (!TextFileSink.isValidFormat(format)) {
      throw new Error(`Unknown log format: ${format}`);
    }

    super((event) => this.#process(event), firstEvent);

    this.#formatter = TextFileSink.#FORMATTERS.get(format);
    this.#filePath  = path.resolve(filePath);
  }

  /**
   * Formats and writes the indicated record or "first write" marker.
   *
   * @param {?LogPayload} record Record to write, or `null` to write a "first
   *   write" marker.
   */
  async #writeRecord(record) {
    // `?? null` to force it to be a function call and not a method call on
    // `this`.
    const text = (this.#formatter ?? null)(record);

    if (text !== null) {
      const finalText = text.endsWith('\n') ? text : `${text}\n`;
      await fs.appendFile(this.#filePath, finalText);
    }
  }

  /**
   * Processes an event, by writing it to this instance's designated file.
   *
   * @param {LogEvent} event Event to log.
   */
  async #process(event) {
    if (!this.#everWritten) {
      if (!/^[/]dev[/]std(err|out)$/.test(this.#filePath)) {
        await this.#writeRecord(null);
      }
      this.#everWritten = true;
    }

    await this.#writeRecord(event.payload);
  }


  //
  // Static members
  //

  /**
   * @type {Converter} Data converter to use for encoding record arguments,
   * specifically for the `json` format.
   */
  static #CONVERTER_FOR_JSON =
    new Converter(ConverterConfig.makeLoggingInstance({ freeze: false }));

  /**
   * @type {Map<string, function(LogPayload): Buffer|string>} Map from names to
   * corresponding formatter methods.
   */
  static #FORMATTERS = new Map(Object.entries({
    human: (record) => this.#formatHuman(record),
    json:  (record) => this.#formatJson(record)
  }));

  /**
   * Indicates whether or not the given format name is valid.
   *
   * @param {string} format The format name.
   * @returns {boolean} `true` iff `format` is a valid name.
   */
  static isValidFormat(format) {
    return this.#FORMATTERS.has(format);
  }

  /**
   * Formatter `human`, which converts to human-oriented text.
   *
   * @param {?LogPayload} record Record to convert, or `null` if this is to be
   *   a "first write" marker.
   * @returns {string} Converted form.
   */
  static #formatHuman(record) {
    if (record === null) {
      // This is a "page break" written to non-console files.
      return `\n\n${'- '.repeat(38)}-\n\n\n`;
    }

    return record.toHuman();
  }

  /**
   * Formatter `json`, which converts to JSON text.
   *
   * @param {?LogPayload} record Record to convert, or `null` if this is to be
   *   a "first write" marker.
   * @returns {?string} Converted form, or `null` if nothing is to be written.
   */
  static #formatJson(record) {
    if (record === null) {
      return null;
    }

    // What's going on: We assume that the `args` payload is already
    // sufficiently encoded (because that would have / should have happened
    // synchronously while logging), but we want to generically encode
    // everything else. So, we do a top-level encode of the record, tweak it,
    // let the normal encode mechanism do it's thing, and then tweak it back.

    const encodedRecord = record[BaseConverter.ENCODE]();
    const objToEncode   = { ...encodedRecord.options, args: null };
    const encoded       = this.#CONVERTER_FOR_JSON.encode(objToEncode);

    encoded.args = encodedRecord.options.args;
    return JSON.stringify(encoded);

    //const finalObj      = { ...encoded, args: encodedRecord.options.args };
    //return JSON.stringify(finalObj);
  }
}
