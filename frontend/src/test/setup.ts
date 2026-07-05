// Node >= 22 ships an experimental global localStorage that shadows jsdom's
// and resolves to undefined unless node is started with --localstorage-file.
// Provide an in-memory Storage so persisted zustand stores work in tests.
if (globalThis.localStorage === undefined) {
  const data = new Map<string, string>();
  const memoryStorage: Storage = {
    get length() {
      return data.size;
    },
    key: (index: number) => Array.from(data.keys())[index] ?? null,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, String(value));
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    clear: () => {
      data.clear();
    },
  };
  Object.defineProperty(globalThis, 'localStorage', {
    value: memoryStorage,
    configurable: true,
  });
}
