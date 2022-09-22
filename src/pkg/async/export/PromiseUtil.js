// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { MustBe } from '@this/typey';


/**
 * Miscellaneous promise utilities.
 */
export class PromiseUtil {
  /**
   * Constructs a promise which is rejected but which is considered "already
   * handled."
   *
   * @param {Error} reason The rejection reason.
   */
  static rejectAndHandle(reason) {
    MustBe.object(reason, Error);

    const result = Promise.reject(reason);

    (async () => {
      try {
        await result;
      } catch {
        // Ignore it.
      }
    })();

    return result;
  }
}
