import '@testing-library/jest-dom';

// Node 26 definiert localStorage als undefined im globalen Scope, was verhindert,
// dass vitest's populateGlobal jsdom's Storage-Implementierung in den globalen Scope kopiert.
// Workaround: localStorage direkt von global.jsdom.window holen (vitest setzt global.jsdom
// in der Umgebungs-Setup-Phase, bevor setupFiles ausgeführt werden).
const jsDomGlobal = globalThis as typeof globalThis & { jsdom?: { window: Window } };
if (jsDomGlobal.jsdom?.window?.localStorage != null && globalThis.localStorage == null) {
  Object.defineProperty(globalThis, 'localStorage', {
    value: jsDomGlobal.jsdom.window.localStorage,
    configurable: true,
    writable: true,
  });
}
