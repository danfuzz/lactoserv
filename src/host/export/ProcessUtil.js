// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0


/**
 * Utilities for dealing with system processes in general.
 */
export class ProcessUtil {
  /**
   * Checks to see if a process exists with the given ID.
   *
   * @param {number} pid The process ID to check for.
   * @returns {boolean} `true` iff the process exists.
   */
  static processExists(pid) {
    try {
      // Note: Per Node docs, `kill` with the signal `0` merely checks for
      // process existence; just what we want here!
      process.kill(pid, 0);
      return true;
    } catch (e) {
      if (e.code === 'ESRCH') {
        // This is the expected "no such process ID" error.
        return false;
      } else {
        throw e;
      }
    }
  }
}
