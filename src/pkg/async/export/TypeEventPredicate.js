// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { LinkedEvent } from '#x/LinkedEvent';

/**
 * Event predicate, as used by this module. See the class documentation of
 * {@link EventTracker} for details.
 *
 * @typedef {null|number|string|function(LinkedEvent):
 * boolean} TypeEventPredicate
 */
export const TypeEventPredicate = Symbol('TypeEventPredicate');
