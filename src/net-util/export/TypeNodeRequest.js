// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { IncomingMessage } from 'node:http';
import { Http2ServerRequest } from 'node:http2';


/**
 * Type which covers all the recognized forms of a request object that come from
 * the low-level Node libraries.
 *
 * @typedef {IncomingMessage|Http2ServerRequest} TypeNodeRequest
 */
export const TypeNodeRequest = Symbol('TypeNodeRequest');
