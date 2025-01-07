// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { FullResponse, IntfRequestHandler } from '@this/net-util';

import { BaseApplication } from '#x/BaseApplication';


/**
 * @implements {IntfRequestHandler}
 */
export class MockApplication extends BaseApplication {
  static mockCalls = [];

  // @defaultConstructor

  /** @override */
  async _impl_handleRequest(request, dispatch) {
    let succeed = true;

    const callInfo = { application: this, request, dispatch };
    MockApplication.mockCalls.push(callInfo);

    if (this.mockHandler) {
      const handlerResult = this.mockHandler(callInfo);
      if (typeof handlerResult !== 'boolean') {
        return handlerResult;
      }
      succeed = handlerResult;
    }

    if (succeed) {
      const result = new FullResponse();
      result.mockInfo = callInfo;
      return result;
    } else {
      return null;
    }
  }
}
