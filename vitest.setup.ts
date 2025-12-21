import '@testing-library/jest-dom';

class MemoryStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  get length(): number {
    return this.store.size;
  }
}

const memoryStorage = new MemoryStorage();

try {
  Object.defineProperty(window, 'localStorage', {
    value: memoryStorage,
    configurable: true,
  });
  Object.defineProperty(globalThis, 'localStorage', {
    value: memoryStorage,
    configurable: true,
  });
} catch {
  // Ignore if localStorage is non-configurable in this environment.
}
