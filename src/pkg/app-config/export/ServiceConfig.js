// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { TypedConfig } from '#x/TypedConfig';


/**
 * Class for configuration of services. Accepted configuration bindings (in
 * the constructor) are entirely as defined by the superclass, {@link
 * TypedConfig}.
 */
export class ServiceConfig extends TypedConfig {
  // This class exists so that the warehouse configuration parser can
  // specifically ask for instances of this class (because there are different
  // factory namespaces for applications vs. services).
}
