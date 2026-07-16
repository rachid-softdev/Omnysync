import { vi } from "vitest";

// Stub for next/headers used by the ROOT vitest config (CI). Server components
// under test call headers()/cookies() during render; under jsdom there is no
// request scope, so we return mock objects. This mirrors the behaviour provided
// by omnysync-web/src/__tests__/setup-global.ts for the web config.
const makeReadonlyHeaders = () => ({
  get: vi.fn((_key: string) => null),
  set: vi.fn(),
  has: vi.fn(() => false),
  delete: vi.fn(),
  append: vi.fn(),
  entries: vi.fn(() => []),
  forEach: vi.fn(),
  keys: vi.fn(() => []),
  values: vi.fn(() => []),
  [Symbol.iterator]: vi.fn(() => [][Symbol.iterator]()),
});

export const headers = vi.fn(() => makeReadonlyHeaders());
export const cookies = vi.fn(() => ({
  get: vi.fn(() => undefined),
  set: vi.fn(),
  delete: vi.fn(),
  has: vi.fn(() => false),
  getAll: vi.fn(() => []),
  clear: vi.fn(),
}));
export const draftMode = vi.fn(() => ({
  isEnabled: false,
  enable: vi.fn(),
  disable: vi.fn(),
}));
