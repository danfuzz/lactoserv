// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ThisModule } from '#p/ThisModule';

import { ChainedEvent } from '@this/async';


/**
 * Global control of this module.
 */
export class SeeAll {
  /**
   * @returns {ChainedEvent|Promise<ChainedEvent>} The earliest available event
   * from the logging system, or promise for same. When the system first starts
   * up, this is the promise for the first actual log event. However, after the
   * 100th event is logged, this instead starts tracking the latest logged
   * event. The idea here is that it should take no longer than the time to log
   * that many events for something to get itself hooked up to the logging
   * system and start processing events, and we don't want to miss out on
   * early evetns that would otherwise have already become unavailable.
   */
  static get earliestEvent() {
    return ThisModule.earliestEvent;
  }
}
