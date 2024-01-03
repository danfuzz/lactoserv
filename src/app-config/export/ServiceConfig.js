// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { ClassedConfig } from '#x/ClassedConfig';


/**
 * Class for configuration of services. Accepted configuration bindings (in
 * the constructor) are entirely as defined by the superclass, {@link
 * ClassedConfig}.
 */
export class ServiceConfig extends ClassedConfig {
  // This class exists so that the warehouse configuration parser can
  // specifically ask for instances of this class (because there are different
  // factory namespaces for applications vs. services).
}
