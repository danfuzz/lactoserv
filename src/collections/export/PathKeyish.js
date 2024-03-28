// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { TreePathKey } from '#x/TreePathKey';
import { TreePathMap } from '#x/TreePathMap';


/**
 * Type for key parameters passed to methods of {@link TreePathMap}. Instances
 * of {@link TreePathKey} per se are used internally and are what is returned,
 * but it is generally okay to pass in plain objects with the expected
 * properties.
 *
 * @typedef {TreePathKey|{ path: Array<string>, wildcard: boolean }} PathKeyish
 */
export const PathKeyish = Symbol('PathKeyish');
