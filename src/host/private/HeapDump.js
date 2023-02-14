// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import fs from 'node:fs/promises';
import inspector from 'node:inspector';
import path from 'node:path';
import { promisify } from 'node:util';

import { EventSink, EventSource } from '@this/async';
import { FormatUtils, IntfLogger } from '@this/loggy';

import { ThisModule } from '#p/ThisModule';


/**
 * All the stuff needed to do heap dumps.
 */
export class HeapDump {
  /** @type {number} Minimum number of bytes between intra-dump reports. */
  static #REPORT_INTERVAL_BYTES = 4_000_000;

  /**
   * @type {?IntfLogger} Logger for this class, or `null` not to do any
   * logging.
   */
  static #logger = ThisModule.logger['heap-dump'];

  /**
   * Performs a heap dump.
   *
   * @param {string} fileName Where to write the dump to. If given a simple
   *   name, the system will try several reasonable directories to write to.
   *   If not already suffixed with `.heapsnapshot` (which is required for
   *   recognition by downstream tooling), it will be appended along with a
   *   timestamp.
   */
  static async dump(fileName) {
    const { filePath, handle } = await this.#openDumpFile(fileName);

    this.#logger.dumpingTo(filePath);

    let chunkCount = 0;
    let byteCount  = 0;

    const writeChunk = async (event) => {
      const chunk = event.payload;

      await handle.write(chunk);

      const thisByteCount = byteCount + chunk.length;
      const lastInterval  = Math.floor(byteCount     / this.#REPORT_INTERVAL_BYTES);
      const thisInterval  = Math.floor(thisByteCount / this.#REPORT_INTERVAL_BYTES);

      chunkCount++;
      byteCount = thisByteCount;

      if (lastInterval !== thisInterval) {
        this.#logger.wrote({ bytes: byteCount, chunks: chunkCount });
      }
    };

    const source = new EventSource();
    const sink   = new EventSink(writeChunk, source.currentEvent);
    const sess   = new inspector.Session();

    await sink.start();
    sess.connect();

    sess.on('HeapProfiler.addHeapSnapshotChunk', async (msg) => {
      source.emit(msg.params.chunk);
    });

    // TODO: Use 'node:inspector/promises' once this project starts requiring
    // Node v19+.
    const post = promisify((...args) => sess.post(...args));
    await post('HeapProfiler.takeHeapSnapshot', null);
    await sink.drainAndStop();

    this.#logger.wrote({ bytes: byteCount, chunks: chunkCount });

    sess.disconnect();
    await handle.close();

    this.#logger.dumpedTo(filePath);
  }

  /**
   * Opens a file for (presumed) dump writing.
   *
   * @param {string} fileName Original file name.
   * @returns {{ filePath, handle }} Actual file path opened, and the open file
   *   handle.
   */
  static async #openDumpFile(fileName) {
    if (!fileName.endsWith('.heapsnapshot')) {
      const nowStr =
        FormatUtils.dateTimeStringFromSecs(Date.now() / 1000, { colons: false });
      fileName += `-${nowStr}.heapsnapshot`;
    }

    const dirsToTry = ['.'];

    if (!/[/]/.test(fileName)) {
      // We were given just a base name. Add some more options to try in case
      // the CWD turns out not to be writable.
      if (process.env.HOME) {
        dirsToTry.push(process.env.HOME);
      }
      if (process.env.TMPDIR) {
        dirsToTry.push(process.env.TMPDIR);
      }
      dirsToTry.push('/tmp');
    }

    for (const dir of dirsToTry) {
      try {
        const filePath = path.resolve(dir, fileName);
        const handle   = await fs.open(filePath, 'w');
        return { filePath, handle };
      } catch {
        // Ignore, and try the next option.
      }
    }

    throw new Error('Could not find a writable directory for a heap dump.');
  }
}
