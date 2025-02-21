import { beforeEach, describe, expect, test } from 'bun:test';
import { MiddlewareImpl, mw } from './middleware';

const ref: MiddlewareImpl = {};

describe('Middleware', () => {
  beforeEach(() => {
    mw.stack = [];
  });

  test('dedupe', () => {
    mw.use(ref);
    mw.use(ref);
    expect(mw.stack.length).toBe(1);
  });
});
