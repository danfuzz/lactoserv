// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'node:fs/promises';
import { Writable } from 'node:stream';

import { WallClock } from '@this/clocky';
import { Duration } from '@this/quant';
import { MustBe } from '@this/typey';

import { Paths } from '#x/Paths';


/**
 * Class which knows how to append to a file, with reasonably decent buffering.
 */
export class FileAppender {
  /**
   * Absolute path of the file to append.
   *
   * @type {string}
   */
  #filePath;

  /**
   * Maximum amount of time to buffer up stuff to write.
   *
   * @type {Duration}
   */
  #maxBufferTime;

  /**
   * The console stream associated with the file, or `null` if there is none.
   *
   * @type {Writable}
   */
  #consoleStream = null;

  /**
   * Buffered texts in need of writing.
   *
   * @type {Array<string>}
   */
  #buffered = [];

  /**
   * Is there a timer currently running, after which the buffered texts will be
   * written?
   *
   * @type {boolean}
   */
  #nowWaiting = false;

  /**
   * Error from the last attempt to write to the file, if any.
   *
   * @type {?Error}
   */
  #writeError = null;

  /**
   * Constructs an instance.
   *
   * @param {string} filePath Absolute path of the file to append to.
   * @param {?Duration} [maxBufferTime] Maximum amount of time to buffer up
   *   stuff to write, or `null` not to do any buffering.
   */
  constructor(filePath, maxBufferTime = null) {
    this.#filePath = Paths.mustBeAbsolutePath(filePath);
    this.#maxBufferTime = maxBufferTime
      ? MustBe.instanceOf(maxBufferTime, Duration)
      : Duration.ZERO;

    switch (filePath) {
      case '/dev/stderr': this.#consoleStream = process.stderr; break;
      case '/dev/stdout': this.#consoleStream = process.stdout; break;
    }
  }

  /**
   * @returns {?number} The console width of this instance's file, if it is
   * known to be a console, or `null` if the width is unknown or unavailable.
   * This specifically works with `/dev/stdout` and `/dev/stderr`.
   */
  get columns() {
    return this.#consoleStream?.columns ?? null;
  }

  /**
   * Appends the given text to the file.
   *
   * @param {*} text The text to append. If not a string, it is first
   *   stringified.
   * @param {boolean} [ensureNewline] Should a newline be appended at the end,
   *   if `text` does not already have one?
   */
  appendText(text, ensureNewline = false) {
    if (this.#writeError) {
      throw this.#writeError;
    }

    if (typeof text !== 'string') {
      text = `${text}`;
    }

    if (ensureNewline && !text.endsWith('\n')) {
      text = `${text}\n`;
    }

    this.#buffered.push(text);

    if (!this.#nowWaiting) {
      this.#nowWaiting = true;
      this.#waitAndFlush();
    }
  }

  /**
   * Immediately flushes any pending output.
   */
  async flush() {
    await this.#writeNow();

    if (this.#writeError) {
      throw this.#writeError;
    }
  }

  /**
   * Immediately attempts to write any buffered texts.
   */
  async #writeNow() {
    if (this.#writeError) {
      return;
    }

    try {
      const finalText = this.#buffered.join('');
      this.#buffered = [];
      await fs.appendFile(this.#filePath, finalText);
    } catch (e) {
      this.#writeError = e;
    }
  }

  /**
   * Waits for the configured amount of time, and then calls {@link #writeNow}.
   * This also ensures that {@link #nowWaiting} is synchronously accurate.
   */
  async #waitAndFlush() {
    try {
      if (this.#maxBufferTime.sec > 0) {
        await WallClock.waitFor(this.#maxBufferTime);
      }

      // The loop is so that `#nowWaiting` can't possibly end up telling a lie.
      while ((this.#buffered.length !== 0) && !this.#writeError) {
        await this.#writeNow();
      }
      this.#nowWaiting = false;
    } catch (e) {
      this.#writeError = e;
    }
  }
}
