import type { TrackIssues } from '../core/track/issues';

/** Why a track cannot be exported. */
export type ExportErrorDetail =
  { code: 'invalid-track'; issues: TrackIssues } | { code: 'folded-surface' };

export class ExportError extends Error {
  constructor(readonly detail: ExportErrorDetail) {
    super(detail.code);
    this.name = 'ExportError';
  }
}
