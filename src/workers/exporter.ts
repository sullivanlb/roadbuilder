import { wrap } from 'comlink';
import type { Remote } from 'comlink';
import type { ExportWorkerApi } from './exportApi';
import type { ExportResult, runExport } from './exportJob';

export interface Exporter {
  run: (...args: Parameters<typeof runExport>) => Promise<ExportResult>;
  dispose: () => void;
}

/**
 * Runs exports in a module worker, started on the first export. Without Worker
 * support (tests, old browsers) the same job runs on the main thread, loaded
 * then, so the app does not carry the exporters and scenery models up front.
 */
export function createExporter(): Exporter {
  if (typeof Worker === 'undefined')
    return {
      run: async (...args) => (await import('./exportJob')).runExport(...args),
      dispose: () => {},
    };
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
