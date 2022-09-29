// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

/**
 * Generator of unique-enough IDs to track connections, requests, etc., in the
 * logs.
 *
 * The format of the IDs is `XX-MMMMM-NNNN`, where all parts are lowercase
 * hexadecimal.
 *
 * * `XX` is an arbitrary (though not truly random) number to make IDs easier
 *   for a human to visually distinguish.
 * * `MMMMM` is a representation of the "current minute" which wraps around
 *   every couple years or so.
 * * `NNNN` is a sequence number within the current minute. It is four digits,
 *   unless by some miracle there are more logged items than that in a minute
 *   in which case it expands.
 */
export class IdGenerator {
  /** @type {number} Current minute number. */
  #minuteNumber = -1;

  /** @type {number} Next sequence number to use. */
  #sequenceNumber = 0;

  /** @type {number} Last-used prefix number. */
  #lastPrefix = -1;

  // The default constructor is fine here.

  /**
   * Makes a new request ID, for use with a single request.
   *
   * @returns {string} An appropriately-constructed request ID.
   */
  makeRequestId() {
    const now          = Date.now();
    const msecNumber   = now & 0xff;
    const minuteNumber = Math.trunc(now * IdGenerator.#MINS_PER_MSEC) & 0xfffff;

    const prefix = (msecNumber === this.#lastPrefix)
      ? (msecNumber + 47) & 0xff
      : msecNumber;
    this.#lastPrefix = prefix;

    if (minuteNumber !== this.#minuteNumber) {
      this.#minuteNumber   = minuteNumber;
      this.#sequenceNumber = 0;
    }

    const sequenceNumber = this.#sequenceNumber;
    this.#sequenceNumber++;

    const preStr = prefix.toString(16).padStart(2, '0');
    const minStr = minuteNumber.toString(16).padStart(5, '0');
    const seqStr = (sequenceNumber < 0x10000)
      ? sequenceNumber.toString(16).padStart(4, '0')
      : sequenceNumber.toString(16).padStart(8, '0');

    return `${preStr}-${minStr}-${seqStr}`;
  }


  //
  // Static members
  //

  /** @type {number} The number of minutes in a millisecond. */
  static #MINS_PER_MSEC = 1 / (1000 * 60);
}
