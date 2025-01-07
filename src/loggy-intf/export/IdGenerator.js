// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Moment } from '@this/quant';
import { MustBe } from '@this/typey';


/**
 * Generator of unique-enough IDs to track connections, requests, etc., in the
 * logs.
 *
 * The format of the IDs is `XX_MMMMM_NN`:
 *
 * * `XX` is an arbitrary (though not truly random) two-character string of
 *   lowercase letters, to make IDs easier for a human to visually distinguish.
 * * `MMMMM` is a lowecase hexadecimal representation of the "current minute,"
 *   which rolls over every couple years or so.
 * * `NN` is a lowercase hexadecimal sequence number within the current minute.
 *   It is two digits, unless by some miracle there are more logged items in a
 *   minute than will fit in that, in which case it expands in two-digit
 *   increments.
 */
export class IdGenerator {
  /**
   * Current minute number.
   *
   * @type {number}
   */
  #minuteNumber = -1;

  /**
   * Next sequence number to use.
   *
   * @type {number}
   */
  #sequenceNumber = 0;

  // @defaultConstructor

  /**
   * Makes a new ID.
   *
   * @param {Moment} now The current time.
   * @returns {string} An appropriately-constructed ID.
   */
  makeId(now) {
    MustBe.instanceOf(now, Moment);

    const nowSec       = now.atSec;
    const minuteNumber = Math.trunc(nowSec * IdGenerator.#MINS_PER_SEC) & 0xfffff;

    if (minuteNumber !== this.#minuteNumber) {
      this.#minuteNumber   = minuteNumber;
      this.#sequenceNumber = 0;
    }

    const sequenceNumber = this.#sequenceNumber;
    this.#sequenceNumber++;

    const preStr = IdGenerator.#makePrefix(nowSec, sequenceNumber);
    const minStr = minuteNumber.toString(16).padStart(5, '0');
    const seqStr = IdGenerator.#stringFromSequenceNumber(sequenceNumber);

    return `${preStr}_${minStr}_${seqStr}`;
  }

  /**
   * Sets the sequence number. This is mainly intended for unit testing.
   *
   * @param {number} n The new sequence number.
   */
  setSequenceNumber(n) {
    this.#sequenceNumber = MustBe.number(n, { safeInteger: true, minInclusive: 0 });
  }


  //
  // Static members
  //

  /**
   * The Unicode codepoint for lowercase `a`.
   *
   * @type {number}
   */
  static #LOWERCASE_A = 'a'.charCodeAt(0);

  /**
   * The number of minutes in a second.
   *
   * @type {number}
   */
  static #MINS_PER_SEC = 1 / 60;

  /**
   * Makes a prefix string based on a time value and sequence number.
   *
   * @param {number} nowSec Recent time value in seconds.
   * @param {number} sequenceNumber Recent / current sequence number.
   * @returns {string} A prefix string.
   */
  static #makePrefix(nowSec, sequenceNumber) {
    const base   = (nowSec * 1000) + (sequenceNumber * ((26 * 3) + 1));
    const digit1 = base % 26;
    const digit2 = Math.trunc(base / 26) % 26;
    const char1  = String.fromCharCode(digit1 + this.#LOWERCASE_A);
    const char2  = String.fromCharCode(digit2 + this.#LOWERCASE_A);

    return `${char1}${char2}`;
  }

  /**
   * Converts a sequence number to a string, as appropriate.
   *
   * @param {number} n The sequence number.
   * @returns {string} The converted number.
   */
  static #stringFromSequenceNumber(n) {
    const str = n.toString(16);

    return ((str.length & 1) === 0) ? str : `0${str}`;
  }
}
