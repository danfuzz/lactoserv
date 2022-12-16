// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// All code and assets are considered proprietary and unlicensed.

/**
 * Generator of unique-enough IDs to track connections, requests, etc., in the
 * logs.
 *
 * The format of the IDs is `XX-MMMMM-NNNN`:
 *
 * * `XX` is an arbitrary (though not truly random) two-character string of
 *   lowercase letters, to make IDs easier for a human to visually distinguish.
 * * `MMMMM` is a lowecase hexadecimal representation of the "current minute,"
 *   which rolls over every couple years or so.
 * * `NNNN` is a lowercase hexadecimal sequence number within the current
 *   minute. It is four digits, unless by some miracle there are more logged
 *   items in a minute than will fit in that, in which case it expands.
 */
export class IdGenerator {
  /** @type {number} Current minute number. */
  #minuteNumber = -1;

  /** @type {number} Next sequence number to use. */
  #sequenceNumber = 0;

  // The default constructor is fine here.

  /**
   * Makes a new ID.
   *
   * @returns {string} An appropriately-constructed ID.
   */
  makeId() {
    const now          = Date.now();
    const minuteNumber = Math.trunc(now * IdGenerator.#MINS_PER_MSEC) & 0xfffff;

    if (minuteNumber !== this.#minuteNumber) {
      this.#minuteNumber   = minuteNumber;
      this.#sequenceNumber = 0;
    }

    const sequenceNumber = this.#sequenceNumber;
    this.#sequenceNumber++;

    const preStr = IdGenerator.#makePrefix(now, sequenceNumber);
    const minStr = minuteNumber.toString(16).padStart(5, '0');
    const seqStr = (sequenceNumber < 0x10000)
      ? sequenceNumber.toString(16).padStart(4, '0')
      : sequenceNumber.toString(16).padStart(8, '0');

    return `${preStr}-${minStr}-${seqStr}`;
  }


  //
  // Static members
  //

  /**
   * Makes a prefix string based on a time value and sequence number.
   *
   * @param {number} now Recent return value from `Date.now()`.
   * @param {number} sequenceNumber Recent / current sequence number.
   * @returns {string} A prefix string.
   */
  static #makePrefix(now, sequenceNumber) {
    const base   = now + (sequenceNumber * ((26 * 3) + 1));
    const digit1 = base % 26;
    const digit2 = Math.trunc(base / 26) % 26;
    const char1  = String.fromCharCode(digit1 + this.#LOWERCASE_A);
    const char2  = String.fromCharCode(digit2 + this.#LOWERCASE_A);

    return `${char1}${char2}`;
  }

  /** @type {number} The Unicode codepoint for lowercase `a`. */
  static #LOWERCASE_A = 'a'.charCodeAt(0);

  /** @type {number} The number of minutes in a millisecond. */
  static #MINS_PER_MSEC = 1 / (1000 * 60);
}
