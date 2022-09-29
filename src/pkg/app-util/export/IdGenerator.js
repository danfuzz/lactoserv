// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

/**
 * Generator of unique-enough IDs to track HTTP(ish) requests.
 *
 * The format of the IDs is `MMMMM-NNNN`, where both halves are lowercase
 * hexadecimal, with `MMMMM` being a representation of the "current minute"
 * (wraps around every couple years or so) and `NNNN` being the request number
 * within that minute (four digits by default but will expand if necessary).
 */
export class IdGenerator {
  /** @type {number} Minute number. */
  #minuteNumber = -1;

  /** @type {number} Sequence number. */
  #sequenceNumber = 0;

  // The default constructor is fine here.

  /**
   * Makes a new request ID, for use with a single request.
   *
   * @returns {string} An appropriately-constructed request ID.
   */
  makeRequestId() {
    const minuteNumber =
      Math.trunc(Date.now() * IdGenerator.#MINS_PER_MSEC) & 0xfffff;

    if (minuteNumber !== this.#minuteNumber) {
      this.#minuteNumber   = minuteNumber;
      this.#sequenceNumber = 0;
    }

    const sequenceNumber = this.#sequenceNumber;
    this.#sequenceNumber++;

    const minStr = minuteNumber.toString(16).padStart(5, '0');
    const seqStr = (sequenceNumber < 0x10000)
      ? sequenceNumber.toString(16).padStart(4, '0')
      : sequenceNumber.toString(16).padStart(8, '0');

    return `${minStr}-${seqStr}`;
  }


  //
  // Static members
  //

  /** @type {number} The number of minutes in a millisecond. */
  static #MINS_PER_MSEC = 1 / (1000 * 60);
}
