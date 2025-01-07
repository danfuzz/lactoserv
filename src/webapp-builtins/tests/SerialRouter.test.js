// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { PathKey } from '@this/collections';
import { MockComponent, MockRootComponent } from '@this/compy/testing';
import { DispatchInfo, FullResponse } from '@this/net-util';
import { SerialRouter } from '@this/webapp-builtins';
import { MockApplication } from '@this/webapp-core/testing';

import { RequestUtil } from '#tests/RequestUtil';


describe('constructor', () => {
  test('accepts a valid minimal configuration', () => {
    expect(() => new SerialRouter({
      applications: []
    })).not.toThrow();
  });

  test('accepts a valid configuration with applications', () => {
    expect(() => new SerialRouter({
      applications: ['foo', 'bar', 'baz']
    })).not.toThrow();
  });

  test.each`
  name
  ${undefined}
  ${false}
  ${true}
  ${123}
  ${123n}
  ${['x']}
  ${{ a: 'x' }}
  ${''}         // This and the rest are syntactically incorrect names.
  ${'-zonk'}
  ${'zonk-'}
  ${'ab$cd'}
  ${' this '}
  `('does not allow binding to `$name`', ({ name }) => {
    const applications = [name];
    expect(() => new SerialRouter({ applications })).toThrow();
  });
});

describe('_impl_handleRequest()', () => {
  async function makeInstance(opts, { appCount = 1, handlerFunc = null } = {}) {
    const root = new MockRootComponent();
    await root.start();

    root.applicationManager = {
      get(name) {
        return root.context.getComponent(['application', name]);
      }
    };

    const apps = new MockComponent({ name: 'application' });
    await root.addAll(apps);

    for (let i = 1; i <= appCount; i++) {
      const app = new MockApplication({ name: `mockApp${i}` });
      if (handlerFunc) {
        app.mockHandler = handlerFunc;
      }
      await apps.addAll(app);
    }

    const sr = new SerialRouter({ name: 'myRouter', ...opts });

    await apps.addAll(sr);

    return sr;
  }

  async function expectApp(sr, appNames, expectResponse = true) {
    if (typeof appNames === 'string') {
      appNames = [appNames];
    }

    MockApplication.mockCalls = [];

    const request = RequestUtil.makeGet('/blorp');
    const result  = await sr.handleRequest(request, new DispatchInfo(PathKey.EMPTY, request.pathname));
    if (expectResponse) {
      expect(result).toBeInstanceOf(FullResponse);
    } else {
      expect(result).toBeNull();
    }

    const calls = MockApplication.mockCalls;
    expect(calls.length).toBe(appNames.length);
    expect(calls.map((info) => info.application.name)).toEqual(appNames);
  }

  async function expectNull(sr) {
    MockApplication.mockCalls = [];

    const request = RequestUtil.makeGet('/blorp');
    const result  = await sr.handleRequest(request, new DispatchInfo(PathKey.EMPTY, request.pathname));
    expect(result).toBeNull();

    const calls = MockApplication.mockCalls;
    expect(calls).toEqual([]);
  }

  test('does not handle any requests when there are no applications', async () => {
    const sr = await makeInstance(
      {
        applications: []
      }
    );

    await expectNull(sr);
  });

  test('asks the only application in a single-application list to handle a request', async () => {
    const sr = await makeInstance(
      {
        applications: ['mockApp1']
      }
    );

    await expectApp(sr, 'mockApp1');
  });

  test('asks the first application in the list to handle request and only continues if that one does not handle the request', async () => {
    let   appToHandle = null;
    const handlerFunc = (callInfo) => {
      return (callInfo.application.name === appToHandle);
    };

    const sr = await makeInstance(
      {
        applications: ['mockApp1', 'mockApp2', 'mockApp3']
      },
      {
        appCount: 3,
        handlerFunc
      }
    );

    appToHandle = 'mockApp1';
    await expectApp(sr, 'mockApp1');

    appToHandle = 'mockApp2';
    await expectApp(sr, ['mockApp1', 'mockApp2']);

    appToHandle = 'mockApp3';
    await expectApp(sr, ['mockApp1', 'mockApp2', 'mockApp3']);
  });

  test('returns `null` if no application handles a request', async () => {
    const sr = await makeInstance(
      {
        applications: ['mockApp1', 'mockApp2', 'mockApp3', 'mockApp4']
      },
      {
        appCount:    4,
        handlerFunc: () => false
      }
    );

    await expectApp(sr, ['mockApp1', 'mockApp2', 'mockApp3', 'mockApp4'], false);
  });
});
