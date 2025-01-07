// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { StackTrace } from '#x/StackTrace';


/**
 * Single element of a {@link StackTrace}.
 *
 * @typedef {{ name: ?string, file: string, line: ?number, col: ?number
 * }} StackFrame
 */
export const StackFrame = Symbol('StackFrame');
