// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { BaseConfig } from '#x/BaseConfig';

/**
 * Mapper from configuration objects, and an optional desired base class result,
 * to the concrete configuration class (subclass of `baseClass` if specified)
 * which should actually be used to construct instances.
 *
 * @typedef {function(object, ?function(new:BaseConfig)):
 * function(new:BaseConfig)} ConfigClassMapper
 */
export const ConfigClassMapper = Symbol('ConfigClassMapper');
