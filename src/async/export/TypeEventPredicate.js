// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { LinkedEvent } from '#x/LinkedEvent';


/**
 * Event predicate, as used by this module. See the class documentation of
 * {@link EventTracker} for details.
 *
 * @typedef {null|number|string|function(LinkedEvent):
 * boolean} TypeEventPredicate
 */
export const TypeEventPredicate = Symbol('TypeEventPredicate');
