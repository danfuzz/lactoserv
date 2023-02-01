// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { BaseConverter } from '#x/BaseConverter';
import { Construct } from '#x/Construct';

/**
 * Special-case converter for instances of `Error` including subclasses.
 *
 * **Note:** Subclasses have to be registered with this module explicitly in
 * order to be converted from instances to data.
 */
export class ConvError extends BaseConverter {
  // Note: The default constructor is fine here.

  /** @override */
  decode(data_unused) {
    throw new Error('TODO');
  }

  /** @override */
  encode(value) {
    const type = value.constructor;
    const { cause, code, message, name, stack } = value;
    const rest = { ...value };
    const main = {
      name: name ?? type.name ?? 'Error',
      code,
      message: message ?? '',
      stack,
      cause
    };

    delete rest.cause;
    delete rest.code;
    delete rest.message;
    delete rest.name;
    delete rest.stack;

    if (!main.cause) delete main.cause;
    if (!main.code)  delete main.code;
    if (!main.stack) delete main.stack;

    return (Object.entries(rest).length === 0)
      ? new Construct(type, main)
      : new Construct(type, main, rest);
  }
}
