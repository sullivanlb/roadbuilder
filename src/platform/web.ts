import type { KeyValueStorage, OutgoingFile, PickedFile, Platform } from './platform';

/** How long a download link stays valid: long enough for slow "save as" dialogs. */
const DOWNLOAD_URL_LIFETIME = 30_000;

function browserStorage(): KeyValueStorage | null {
  try {
    const storage = window.localStorage;
    return {
      read: (key) => storage.getItem(key),
      write: (key, value) => storage.setItem(key, value),
    };
  } catch {
    // Storage can be blocked by privacy settings; manual saves remain available.
    return null;
  }
}

/** Browser implementation: localStorage, a file input and anchor downloads. */
export function createWebPlatform(): Platform {
  const urls = new Map<string, ReturnType<typeof setTimeout>>();
  const revoke = (url: string) => {
    clearTimeout(urls.get(url));
    URL.revokeObjectURL(url);
    urls.delete(url);
  };
  return {
    storage: browserStorage(),
    pickFile(accept) {
      return new Promise<PickedFile | null>((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = accept.join(',');
        input.addEventListener('change', () => resolve(input.files?.[0] ?? null), { once: true });
        input.addEventListener('cancel', () => resolve(null), { once: true });
        input.click();
      });
    },
    saveFile(file: OutgoingFile) {
      const content = typeof file.data === 'string' ? file.data : new Uint8Array(file.data);
      const url = URL.createObjectURL(new Blob([content], { type: file.type }));
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      document.body.append(link);
      link.click();
      link.remove();
      urls.set(
        url,
        setTimeout(() => revoke(url), DOWNLOAD_URL_LIFETIME),
      );
      return Promise.resolve();
    },
    dispose() {
      for (const url of [...urls.keys()]) revoke(url);
    },
  };
}
