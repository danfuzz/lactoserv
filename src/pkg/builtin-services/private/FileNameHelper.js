// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { Socket } from 'node:net';
import { Duplex, Readable, Writable } from 'node:stream';
import { setImmediate } from 'node:timers';

import { ManualPromise, TokenBucket } from '@this/async';
import { MustBe } from '@this/typey';


/**
 * Utilities for file name stuff.
 */
export class FileNameHelper {
  /**
   * Parses a file name into a main part and a suffix.
   *
   * @param {string} name The original name.
   * @returns {{ base: string, suffix: string }} The parsed parts.
   */
  static parse(name) {
    const { base, suffix = '' } =
      name.match(/^(?<base>.*?)(?<suffix>[.][^.]*)?$/).groups;

    return { base, suffix };
  }

  /**
   * Inserts a string into a file name, just before the suffix.
   *
   * @param {string} name The original name.
   * @param {string} ending The new pre-suffix name ending.
   * @returns {string} The combined name.
   */
  static insertEnding(name, ending) {
    const { base, suffix } = this.parse(name);

    return `${base}${ending}${suffix}`;
  }
}
