// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { EventSink, LinkedEvent } from '@this/async';
import { MustBe } from '@this/typey';

import { LogRecord } from '#x/LogRecord';


/**
 * Logging sink, which processes events by writing them in human-readable form
 * to a text file of some sort.
 */
export class TextFileSink extends EventSink {
  /** @type {string} Absolute path to the file to write to. */
  #filePath;

  /**
   * @type {function(LogRecord): Buffer|string} Function to convert an event
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
   * @param {LinkedEvent|Promise<LinkedEvent>} firstEvent First event to be
   *   processed by the instance, or promise for same.
   */
  constructor(format, filePath, firstEvent) {
    MustBe.string(format);
    MustBe.string(filePath);

    if (!TextFileSink.isValidFormat(format)) {
      throw new Error(`Invalid log format: ${format}`);
    }

    super((event) => this.#process(event), firstEvent);

    this.#formatter = TextFileSink.#FORMATTERS.get(format);
    this.#filePath  = path.resolve(filePath);
  }

  /**
   * Processes an event, by writing it to this instance's designated file.
   *
   * @param {LinkedEvent} event Event to log.
   */
  async #process(event) {
    if (!this.#everWritten) {
      this.#everWritten = true;
      if (!/^[/]dev[/]std(err|out)$/.test(this.#filePath)) {
        await fs.appendFile(this.#filePath, `\n\n${'- '.repeat(38)}-\n\n\n`);
      }
    }

    // `?? null` to force it to be a function call and not a method call on
    // `this`.
    const text      = (this.#formatter ?? null)(event.payload);
    const finalText = text.endsWith('\n') ? text : `${text}\n`;

    await fs.appendFile(this.#filePath, finalText);
  }


  //
  // Static members
  //

  /**
   * @type {Map<string, function(LogRecord): Buffer|string>} Map from names to
   * corresponding formatter methods.
   */
  static #FORMATTERS = new Map(Object.entries({
    human: TextFileSink.#formatHuman,
    json:  TextFileSink.#formatJson
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
   * @param {LogRecord} record Record to convert.
   * @returns {string} Converted form.
   */
  static #formatHuman(record) {
    return record.toHuman();
  }

  /**
   * Formatter `json`, which converts to JSON text.
   *
   * @param {LogRecord} record Record to convert.
   * @returns {string} Converted form.
   */
  static #formatJson(record) {
    return JSON.stringify(record);
  }
}
