import { createPinia, setActivePinia } from 'pinia';
import { createApp } from 'vue';
import { vi } from 'vitest';
import { createProject } from '../src/core/project/factory';
import { parseProject } from '../src/core/project/schema';
import type { Project } from '../src/core/project/schema';
import type { Template } from '../src/core/project/templates';
import { installPlatform } from '../src/platform/platform';
import type { KeyValueStorage, OutgoingFile, PickedFile, Platform } from '../src/platform/platform';
import tightTurn from './fixtures/tight-turn.roadbuilder.json';

/** A template project with a fixed name. */
export const template = (name: Template = 'club'): Project => createProject(name, `Test ${name}`);

/** Seven points on an open road, with two bends too tight for its 24 m width. */
export const tightTurnProject = (): Project => parseProject(tightTurn);

/** A project shaped like a JSON file, for importing. */
export const asJson = (project: unknown) =>
  JSON.parse(JSON.stringify(project)) as Record<string, unknown>;

export interface MemoryStorage extends KeyValueStorage {
  values: Map<string, string>;
}

export function memoryStorage(initial: Record<string, string> = {}): MemoryStorage {
  const values = new Map(Object.entries(initial));
  return {
    values,
    read: (key) => values.get(key) ?? null,
    write: (key, value) => {
      values.set(key, value);
    },
  };
}

export interface TestPlatform extends Platform {
  saved: OutgoingFile[];
  /** The next file the user will pick. */
  offer(file: PickedFile | string | null): void;
}

export function testPlatform(storage: KeyValueStorage | null = memoryStorage()): TestPlatform {
  let next: PickedFile | null = null;
  const saved: OutgoingFile[] = [];
  return {
    storage,
    saved,
    offer(file) {
      next =
        typeof file === 'string'
          ? { name: 'project.json', size: file.length, text: () => Promise.resolve(file) }
          : file;
    },
    pickFile: vi.fn(() => Promise.resolve(next)),
    saveFile: vi.fn((file: OutgoingFile) => {
      saved.push(file);
      return Promise.resolve();
    }),
    dispose: vi.fn(),
  };
}

/** An app context with Pinia and a platform, so stores can be used outside components. */
export function storeContext(platform: Platform = testPlatform()) {
  const app = createApp({});
  installPlatform(app, platform);
  const pinia = createPinia();
  app.use(pinia);
  setActivePinia(pinia);
  return { app, pinia, platform, run: <T>(fn: () => T) => app.runWithContext(fn) };
}
