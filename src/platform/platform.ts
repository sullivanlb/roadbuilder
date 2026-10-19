import { inject } from 'vue';
import type { App, InjectionKey } from 'vue';

/** A file chosen by the user. */
export interface PickedFile {
  name: string;
  size: number;
  text(): Promise<string>;
}

/** A file the application hands to the user. */
export interface OutgoingFile {
  name: string;
  type: string;
  data: string | Uint8Array;
}

/** Small key/value store kept on the device; any call may throw when storage is unavailable. */
export interface KeyValueStorage {
  read(key: string): string | null;
  write(key: string, value: string): void;
}

/**
 * Everything the editor needs from the environment it runs in. The web build
 * implements it with browser APIs; the desktop build will implement it with Tauri.
 */
export interface Platform {
  storage: KeyValueStorage | null;
  /** Asks the user for a file; resolves to null when they cancel. */
  pickFile(accept: readonly string[]): Promise<PickedFile | null>;
  /** Gives a file to the user: a download on the web, a save dialog on the desktop. */
  saveFile(file: OutgoingFile): Promise<void>;
  /** Releases what the platform still holds (object URLs, timers). */
  dispose(): void;
}

const platformKey: InjectionKey<Platform> = Symbol('platform');

export function installPlatform(app: App, platform: Platform) {
  app.provide(platformKey, platform);
  app.onUnmount(() => platform.dispose());
}

/** The platform provided to the app; usable in components and setup stores. */
export function usePlatform(): Platform {
  const platform = inject(platformKey);
  if (!platform) throw new Error('No platform was installed on the app.');
  return platform;
}
