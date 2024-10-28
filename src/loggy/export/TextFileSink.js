// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { EventSink, LinkedEvent } from '@this/async';
import { FileAppender } from '@this/fs-util';
import { LogPayload } from '@this/loggy-intf';
import { Duration, Moment } from '@this/quant';
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
   * Format name.
   *
   * @type {string}
   */
  #format;

  /**
   * Has this instance ever written to the file?
   *
   * @type {boolean}
   */
  #everWritten = false;

  /**
   * The moment at or after which a full timestamp is to be written, or `null`
   * if one should always be written.
   *
   * @type {Moment}
   */
  #nextFullTimestamp = null;

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
    super((event) => this.#process(event), firstEvent);

    this.#format   = MustBe.string(format);
    this.#filePath = MustBe.string(filePath);

    if (!TextFileSink.isValidFormat(format)) {
      throw new Error(`Unknown log format: ${format}`);
    }

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
   * Formatter which converts to human-oriented text.
   *
   * @param {?LogPayload} payload Payload to convert, or `null` if this is to be
   *   a "first write" marker.
   * @param {boolean} styled Style/colorize the result?
   * @returns {string} Converted form.
   */
  #formatHuman(payload, styled) {
    if (payload === null) {
      // This is a "page break" written to non-console files.
      return `\n\n${'- '.repeat(38)}-\n\n\n`;
    }

    const width    = (this.#appender.columns ?? 120) - 1;
    const when     = payload.when;
    const nextFull = this.#nextFullTimestamp;
    const human    = payload.toHuman(styled, width);

    if (!nextFull || (when.ge(nextFull))) {
      const fullStamp = payload.getWhenString(styled);
      const dashes    = '-'.repeat((Math.min(width, 80) - 30) >> 1);
      this.#nextFullTimestamp = TextFileSink.#roundToNextMinute(when);
      return `\n${dashes} ${fullStamp} ${dashes}\n${human}`;
    } else {
      return human;
    }
  }

  /**
   * Formatter which converts to JSON text.
   *
   * @param {?LogPayload} payload Payload to convert, or `null` if this is to be
   *   a "first write" marker.
   * @returns {?string} Converted form, or `null` if nothing is to be written.
   */
  #formatJson(payload) {
    // Note: We assume here that `payload.args` is JSON-encodable, which should
    // have been guaranteed by the time we get here.
    return (payload === null)
      ? null
      : JSON.stringify(payload.toPlainObject());
  }

  /**
   * Formats the payload according to {@link #format}.
   *
   * @param {?LogPayload} payload Payload to convert, or `null` if this is to be
   *   a "first write" marker.
   * @returns {?string} Converted form, or `null` if nothing is to be written.
   */
  #formatPayload(payload) {
    switch (this.#format) {
      case 'human':       { return this.#formatHuman(payload, false); }
      case 'humanStyled': { return this.#formatHuman(payload, true);  }
      case 'json':        { return this.#formatJson(payload);         }
    }

    // The constructor check should have caught this.
    throw new Error('Shouldn\'t happen: Unknown formatter.');
  }

  /**
   * Formats and writes the indicated payload or "first write" marker.
   *
   * @param {?LogPayload} payload What to write, or `null` to write a "first
   *   write" marker.
   */
  async #writePayload(payload) {
    const text = this.#formatPayload(payload);

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
  static #FORMATTERS = new Set(['human', 'humanStyled', 'json']);

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
   * Rounds a time up to the start of the next minute.
   *
   * @param {Moment} moment The time in question.
   * @returns {Moment} Time representing the start of the next minute.
   */
  static #roundToNextMinute(moment) {
    const atSec      = moment.atSec;
    const thisMinute = Math.trunc(atSec / 60) * 60;

    return new Moment(thisMinute + 60);
  }
}
