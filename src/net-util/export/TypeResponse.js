// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { FullResponse } from '#x/FullResponse';
import { StatusResponse } from '#x/StatusResponse';


/**
 * Type definition for the sorts of values allowed when responding to network
 * requests, when using the classes in this module.
 *
 * * {@link FullResponse} -- A complete response.
 * * {@link StatusResponse} -- A response which _just_ notes the status code.
 *   Code "near" the protocol handler is expected to expand these into complete
 *   responses when appropriate.
 * * `null` -- Indicator that the request was not handled (which is different
 *   than being handled with a result of "not found").
 *
 * @typedef {FullResponse|StatusResponse|null} TypeResponse
 */
export const TypeResponse = Symbol('TypeResponse');
