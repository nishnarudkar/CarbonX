// Vitest setup: register jest-dom and vitest-axe (accessibility) matchers.
// Handle Node 24/25 native localStorage conflicts by installing a mock if clear is missing.
if (typeof window !== "undefined") {
  const needsMock = !window.localStorage || typeof window.localStorage.clear !== "function";
  if (needsMock) {
    const store = new Map<string, string>();
    const mockStorage: Storage = {
      get length() {
        return store.size;
      },
      clear() {
        store.clear();
      },
      getItem(key: string) {
        return store.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        store.set(key, value);
      },
      removeItem(key: string) {
        store.delete(key);
      },
      key(index: number) {
        return Array.from(store.keys())[index] ?? null;
      },
    };
    Object.defineProperty(window, "localStorage", {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, "localStorage", {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
  }
}

import "@testing-library/jest-dom/vitest";
import * as axeMatchers from "vitest-axe/matchers";
import { expect } from "vitest";

expect.extend(axeMatchers);
