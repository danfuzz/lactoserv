// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { BaseClassedConfig } from '@this/compote';


/**
 * Class for configuration of applications. Accepted configuration bindings (in
 * the constructor) are entirely as defined by the superclass, {@link
 * BaseClassedConfig}.
 */
export class ApplicationConfig extends BaseClassedConfig {
  // This class exists so that the warehouse configuration parser can
  // specifically ask for instances of this class (because there are different
  // factory namespaces for applications vs. services).
}
