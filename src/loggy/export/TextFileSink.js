// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { EventSink, LinkedEvent } from '@this/async';
import { FileAppender } from '@this/fs-util';
import { LogPayload } from '@this/loggy-intf';
import { Duration } from '@this/quant';
import { MustBe } from '@this/typey';


/**
 * Logging sink, which processes events by writing them in human-readable form
 * to a text file of some sort or to the console.
 */
export class TextFileSink extends EventSink {
  /**
   * File appender.
   *
   * @type {FileAppender}
   */
  #appender;

  /**
   * Absolute path of the file to write to.
   *
   * @type {string}
   */
  #filePath;

  /**
   * Function to convert an event into writable form.
   *
   * @type {function(LogPayload, number): Buffer|string}
   */
  #formatter;

  /**
   * Has this instance ever written to the file?
   *
   * @type {boolean}
   */
  #everWritten = false;

  /**
   * Constructs an instance.
   *
   * @param {string} format Name of the formatter to use.
   * @param {string} filePath Absolute path of the file to write to.
   * @param {LinkedEvent|Promise<LinkedEvent>} firstEvent First event to be
   *   processed by the instance, or promise for same.
   * @param {?Duration} [bufferPeriod] How long to buffer writes for, or `null`
   *   not to do buffering.
   */
  constructor(format, filePath, firstEvent, bufferPeriod = null) {
    MustBe.string(format);
    MustBe.string(filePath);

    if (!TextFileSink.isValidFormat(format)) {
      throw new Error(`Unknown log format: ${format}`);
    }

    super((event) => this.#process(event), firstEvent);

    this.#formatter = TextFileSink.#FORMATTERS.get(format);
    this.#filePath  = filePath;
    this.#appender  = new FileAppender(filePath, bufferPeriod);
  }

  /**
   * In addition to the superclass behavior, this flushes any pending output to
   * the file.
   *
   * @override
   */
  async drainAndStop() {
    await super.drainAndStop();
    await this.#appender.flush();
  }

  /**
   * Formats and writes the indicated payload or "first write" marker.
   *
   * @param {?LogPayload} payload What to write, or `null` to write a "first
   *   write" marker.
   */
  async #writePayload(payload) {
    const width = (this.#appender.columns ?? 120) - 1;

    // `?? null` to force it to be a function call and not a method call on
    // `this`.
    const text = (this.#formatter ?? null)(payload, width);

    if (text !== null) {
      await this.#appender.appendText(text, true);
    }
  }

  /**
   * Processes an event, by writing it to this instance's designated file.
   *
   * @param {LinkedEvent} event Event to log.
   */
  async #process(event) {
    if (!this.#everWritten) {
      if (!/^[/]dev[/]std(err|out)$/.test(this.#filePath)) {
        await this.#writePayload(null);
      }
      this.#everWritten = true;
    }

    await this.#writePayload(event.payload);
  }


  //
  // Static members
  //

  /**
   * Map from names to corresponding formatter methods.
   *
   * @type {Map<string, function(LogPayload): Buffer|string>}
   */
  static #FORMATTERS = new Map(Object.entries({
    human:       (payload, width) => this.#formatHuman(payload, width, false),
    humanStyled: (payload, width) => this.#formatHuman(payload, width, true),
    json:        (payload, width_unused) => this.#formatJson(payload)
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
   * @param {?LogPayload} payload Payload to convert, or `null` if this is to be
   *   a "first write" marker.
   * @param {number} maxWidth Desired maximum line width.
   * @param {boolean} styled Style/colorize the result?
   * @returns {string} Converted form.
   */
  static #formatHuman(payload, maxWidth, styled) {
    if (payload === null) {
      // This is a "page break" written to non-console files.
      return `\n\n${'- '.repeat(38)}-\n\n\n`;
    }

    return payload.toHuman(styled, maxWidth);
  }

  /**
   * Formatter `json`, which converts to JSON text.
   *
   * @param {?LogPayload} payload Payload to convert, or `null` if this is to be
   *   a "first write" marker.
   * @returns {?string} Converted form, or `null` if nothing is to be written.
   */
  static #formatJson(payload) {
    // Note: We assume here that `payload.args` is JSON-encodable, which should
    // have been guaranteed by the time we get here.
    return (payload === null)
      ? null
      : JSON.stringify(payload.toPlainObject());
  }
}
