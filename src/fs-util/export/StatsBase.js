// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'node:fs';


/**
 * @type {function(new: object)} The base class of {@link fs.Stats} and {@link
 * fs.BigIntStats}. Neither this class nor either of the concrete subclasses
 * are directly exposed by Node, because (arguably bad) reasons, but we can at
 * least extract it and then use it for type checks.
 */
export const StatsBase = Object.getPrototypeOf(fs.Stats.prototype).constructor;
