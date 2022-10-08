// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { Methods } from '@this/typey';


/**
 * Base class for system services.
 */
export class BaseService {
  /**
   * Starts the service. This async-returns once the service is actually
   * running.
   *
   * @abstract
   * @throws {Error} Thrown if there was trouble starting the service.
   */
  async start() {
    Methods.abstract();
  }

  /**
   * Stops the service. This async-returns once the service is actually
   * stopped.
   *
   * @abstract
   * @throws {Error} Thrown if there was trouble running or stopping the
   *   service.
   */
  async stop() {
    Methods.abstract();
  }
}
