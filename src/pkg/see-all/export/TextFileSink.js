// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { LogEvent } from '#x/LogEvent';

import { EventSink } from '@this/async';
import { MustBe } from '@this/typey';

import * as fs from 'node:fs/promises';
import * as path from 'node:path';


/**
 * Logging sink, which processes events by writing them in human-readable form
 * to a text file of some sort.
 */
export class TextFileSink extends EventSink {
  /** {string} Absolute path to the file to write to. */
  #filePath;

  /**
   * Constructs an instance.
   *
   * @param {string} filePath File to write to. It is immediately resolved to an
   *   absolute path.
   * @param {LogEvent|Promise<LogEvent>} firstEvent First event to be processed
   *   by the instance, or promise for same.
   */
  constructor(filePath, firstEvent) {
    MustBe.string(filePath);
    super(event => this.#process(event), firstEvent);

    this.#filePath = path.resolve(filePath);
  }

  /**
   * Processes an event, by writing it to this instance's designated file.
   *
   * @param {LogEvent} event Event to log.
   */
  async #process(event) {
    const text = event.toHuman();
    await fs.appendFile(this.#filePath, text);
  }
}
