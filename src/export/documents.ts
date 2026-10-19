import type { TrackIssue } from '../core/track/issues';

/** Inputs of the installation guide shipped in the Assetto Corsa archive. */
export interface InstallationParams {
  name: string;
  slug: string;
  projectFile: string;
  terrainMargin: number;
  barrierCount: number;
  warnings: readonly TrackIssue[];
}

/** Human-readable texts embedded in the archives, in the language chosen by the user. */
export interface DocumentTexts {
  /** Comment header of track.obj. */
  objHeader: string;
  /** README.txt of the OBJ archive. */
  objReadme(barrierCount: number): string;
  /** Description shown by Content Manager. */
  trackDescription(closed: boolean): string;
  /** INSTALLATION.txt of the Assetto Corsa archive. */
  installation(params: InstallationParams): string;
}
