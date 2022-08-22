// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

/** {object} Unique object used to grant access to otherwise-private items in
 * this module. Use of this object in effect makes it possible to define
 * "module-protected methods" in the usual sense.
 */
export const PROTECTED_ACCESS = Symbol('static-server PROTECTED_ACCESS');
