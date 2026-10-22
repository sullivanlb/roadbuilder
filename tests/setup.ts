import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Exports fetch the textures the app serves (src/assets/scenery/index.ts): the
// tests answer from the repository, every other request goes through. Set
// directly rather than stubbed, so tests unstubbing their globals keep it.
const ROOT = join(import.meta.dirname, '..');
const served = /^\/src\/assets\/scenery\/textures\/[\w.]+\.png$/;
const fetch = globalThis.fetch;
globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const url = input instanceof Request ? input.url : input.toString();
  if (!served.test(url)) return fetch(input, init);
  return Promise.resolve(new Response(readFileSync(join(ROOT, url))));
};
