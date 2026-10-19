import { transfer } from 'comlink';
import { runExport } from './exportJob';

/** What the export worker exposes. */
export const exportApi = {
  run(...args: Parameters<typeof runExport>) {
    const result = runExport(...args);
    // Hand the archive bytes over instead of copying them.
    return result.ok ? transfer(result, [result.bytes.buffer]) : result;
  },
};

export type ExportWorkerApi = typeof exportApi;
