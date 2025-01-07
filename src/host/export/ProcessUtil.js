// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
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
        // This is the expected error for "no such process ID."
        return false;
      } else if (e.code === 'EPERM') {
        // This is the expected error for "process ID exists but is not owned
        // by the current user."
        return true;
      } else {
        throw e;
      }
    }
  }
}
