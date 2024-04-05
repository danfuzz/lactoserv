// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'node:fs/promises';

import { Duration } from '@this/data-values';
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
   * Constructs an instance.
   *
   * @param {string} filePath Absolute path of the file to append to.
   * @param {Duration} [maxBufferTime] Maximum amount of time to buffer up stuff
   *   to write. Defaults to 250msec.
   */
  constructor(filePath, maxBufferTime = null) {
    this.#filePath = Paths.checkAbsolutePath(filePath);
    this.#maxBufferTime = maxBufferTime
      ? MustBe.instanceOf(maxBufferTime, Duration)
      : new Duration(0.25);
  }

  /**
   * Appends the given text to the file.
   *
   * @param {*} text The text to append. If not a string, it is first
   *   stringified.
   * @param {boolean} [ensureNewline] Should a newline be appended at the end,
   *   if `text` does not already have one?
   */
  async appendText(text, ensureNewline = false) {
    if (typeof text !== 'string') {
      text = `${text}`;
    }

    if (ensureNewline && !text.endsWith('\n')) {
      text = `${text}\n`;
    }

    await fs.appendFile(this.#filePath, text);
  }
}
