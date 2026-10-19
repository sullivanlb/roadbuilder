import { expose } from 'comlink';
import { exportApi } from './exportApi';

// Builds archives off the main thread, so the editor stays responsive during an export.
expose(exportApi);
