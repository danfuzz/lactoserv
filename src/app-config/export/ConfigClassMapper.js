// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { BaseConfig } from '#x/BaseConfig';


/**
 * Mapper from configuration objects, and an optional desired base class result,
 * to the concrete configuration class (subclass of `baseClass` if specified)
 * which should actually be used to construct instances. If no more-specific
 * configuration class is available, the mapper function is expected to return
 * the given base class (second argument). Not passing a base class argument is
 * the same as passing `BaseConfig`.
 *
 * @typedef {function(object, ?function(new:BaseConfig)):
 *   function(new:BaseConfig)} ConfigClassMapper
 */
export const ConfigClassMapper = Symbol('ConfigClassMapper');
