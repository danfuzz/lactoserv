// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { EventSink, LinkedEvent } from '@this/async';
import { MustBe } from '@this/typey';


/**
 * Logging sink, which processes events by writing them in human-readable form
 * to a text file of some sort.
 */
export class TextFileSink extends EventSink {
  /** @type {string} Absolute path to the file to write to. */
  #filePath;

  /** @type {boolean} Has this instance ever written to the file? */
  #everWritten = false;

  /**
   * Constructs an instance.
   *
   * @param {string} filePath File to write to. It is immediately resolved to an
   *   absolute path.
   * @param {LinkedEvent|Promise<LinkedEvent>} firstEvent First event to be
   *   processed by the instance, or promise for same.
   */
  constructor(filePath, firstEvent) {
    MustBe.string(filePath);
    super((event) => this.#process(event), firstEvent);

    this.#filePath = path.resolve(filePath);
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

    const text = event.payload.toHuman();
    await fs.appendFile(this.#filePath, text);
  }
}
