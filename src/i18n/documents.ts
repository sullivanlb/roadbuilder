import type { TrackIssue } from '../domain/diagnostics';

/** Inputs of the INSTALLATION.txt shipped in the Assetto Corsa archive. */
export interface InstallationParams {
  name: string;
  slug: string;
  terrainMargin: number;
  barrierCount: number;
  warnings: TrackIssue[];
}

/** Localised texts embedded in the exported archives. */
export interface DocumentTexts {
  /** ui_track.json description. */
  trackDescription(closed: boolean): string;
  /** LIRE-MOI.txt shipped in the OBJ archive. */
  objReadme(barrierCount: number): string;
  /** INSTALLATION.txt shipped in the Assetto Corsa archive. */
  installation(params: InstallationParams): string;
}
