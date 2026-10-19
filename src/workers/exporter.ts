import { wrap } from 'comlink';
import type { Remote } from 'comlink';
import type { ExportWorkerApi } from './exportApi';
import { runExport } from './exportJob';
import type { ExportResult } from './exportJob';

export interface Exporter {
  run: (...args: Parameters<typeof runExport>) => Promise<ExportResult>;
  dispose: () => void;
}

/**
 * Runs exports in a module worker, started on the first export. Without Worker
 * support (tests, old browsers) the same job runs on the main thread.
 */
export function createExporter(): Exporter {
  if (typeof Worker === 'undefined')
    return { run: (...args) => Promise.resolve(runExport(...args)), dispose: () => {} };
  let worker: Worker | null = null;
  let remote: Remote<ExportWorkerApi> | null = null;
  return {
    run: (...args) => {
      if (!remote) {
        worker = new Worker(new URL('./export.worker.ts', import.meta.url), { type: 'module' });
        remote = wrap<ExportWorkerApi>(worker);
      }
      return remote.run(...args);
    },
    dispose: () => {
      worker?.terminate();
      worker = null;
      remote = null;
    },
  };
}
