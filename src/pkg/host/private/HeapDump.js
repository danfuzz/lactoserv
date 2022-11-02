// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import fs from 'node:fs';
import inspector from 'node:inspector';
import path from 'node:path';
import { promisify } from 'node:util';

import { FormatUtils } from '@this/loggy';

import { ThisModule } from '#p/ThisModule';


/**
 * All the stuff needed to do heap dumps.
 */
export class HeapDump {
  /** @type {number} Minimum number of bytes between intra-dump reports. */
  static #REPORT_INTERVAL_BYTES = 4_000_000;

  /** @type {function(...*)} Logger for this class. */
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
    const { fd, filePath } = this.#openDumpFile(fileName);

    this.#logger.dumpingTo(filePath);

    let chunkCount = 0;
    let byteCount  = 0;

    const sess = new inspector.Session();
    sess.connect();

    sess.on('HeapProfiler.addHeapSnapshotChunk', (msg) => {
      const { chunk } = msg.params;

      fs.writeSync(fd, msg.params.chunk);

      const thisByteCount = byteCount + chunk.length;
      const lastInterval  = Math.floor(byteCount     / this.#REPORT_INTERVAL_BYTES);
      const thisInterval  = Math.floor(thisByteCount / this.#REPORT_INTERVAL_BYTES);

      chunkCount++;
      byteCount = thisByteCount;

      if (lastInterval !== thisInterval) {
        this.#logger.wrote({ bytes: byteCount, chunks: chunkCount });
      }
    });

    // TODO: Use 'node:inspector/promises' once this project starts requiring
    // Node v19+.
    const post = promisify((...args) => sess.post(...args));
    await post('HeapProfiler.takeHeapSnapshot', null);

    this.#logger.wrote({ bytes: byteCount, chunks: chunkCount });

    sess.disconnect();
    fs.closeSync(fd);

    this.#logger.dumpedTo(filePath);
  }

  /**
   * Opens a file for (presumed) dump writing.
   *
   * @param {string} fileName Original file name.
   * @returns {{ fd, filePath }} Opened file handle and actual file path.
   */
  static #openDumpFile(fileName) {
    if (!fileName.endsWith('.heapsnapshot')) {
      const nowStr = FormatUtils.dateTimeStringFromMsec(Date.now());
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
        const fd = fs.openSync(filePath, 'w');
        return { fd, filePath };
      } catch {
        // Ignore, and try the next option.
      }
    }

    throw new Error('Could not find a writable directory for a heap dump.');
  }
}
