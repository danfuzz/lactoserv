// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { TypedItem } from '#x/TypedItem';
import { Names } from '#x/Names';

/**
 * Class for configuration of applications. Accepted configuration bindings (in
 * the constructor) are entirely as defined by the superclass, {@link
 * TypedItem}.
 */
export class ApplicationItem extends TypedItem {
  // This class only exists so as to make things clearer at the use sites,
  // specifically to maintain the "base class name" correspondence between
  // classes in this module and classes in the rest of the system. (E.g.,
  // `ApplicationController` is clearly related to `ApplicationItem`. The
  // relationship with `TypedItem` isn't so obvious.)
}
