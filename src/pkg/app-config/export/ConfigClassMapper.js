// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { BaseConfigurationItem } from '#x/BaseConfigurationItem';

/**
 * Mapper from configuration objects, and an optional desired base class result,
 * to the concrete configuration class (subclass of `baseClass` if specified)
 * which should actually be used to construct instances.
 *
 * @typedef {function(object, ?function(new:BaseConfigurationItem)):
 * function(new:BaseConfigurationItem)} ConfigClassMapper
 */
export const ConfigClassMapper = Symbol('ConfigClassMapper');
