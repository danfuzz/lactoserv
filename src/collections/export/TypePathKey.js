// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { PathKey } from '#x/PathKey';
import { TreeMap } from '#x/TreeMap';


/**
 * Type for key parameters passed to methods of {@link TreeMap}. Instances
 * of {@link PathKey} per se are used internally and are what is returned,
 * but it is generally okay to pass in plain objects with the expected
 * properties. This type covers both possibilities.
 *
 * @typedef {PathKey|{ path: Array<string>, wildcard: boolean }} TypePathKey
 */
export const TypePathKey = Symbol('TypePathKey');
