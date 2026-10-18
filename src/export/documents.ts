import type { Project, Sample } from '../domain/types';
import type { TrackIssue } from '../domain/diagnostics';
import { catalogues } from '../i18n/catalogues';
import type { Locale } from '../i18n/catalogues';

/** Assetto Corsa surfaces.ini: the four physical surfaces used by the meshes. */
export function surfacesIni(): string {
  return [
    ['ROAD', 1, 1, 0],
    ['GRASS', 0.65, 0, 0],
    ['KERB', 0.95, 1, 0],
    ['PIT', 1, 1, 1],
  ]
    .map(
      ([key, friction, valid, pit], i) =>
        `[SURFACE_${i}]\nKEY=${key}\nFRICTION=${friction}\nDAMPING=0\nWAV=\nWAV_PITCH=0\nFF_EFFECT=NULL\nDIRT_ADDITIVE=${key === 'GRASS' ? 1 : 0}\nIS_VALID_TRACK=${valid}\nBLACK_FLAG_TIME=0\nSIN_HEIGHT=0\nSIN_LENGTH=0\nIS_PITLANE=${pit}\nVIBRATION_GAIN=${key === 'KERB' ? 0.1 : 0}\nVIBRATION_LENGTH=${key === 'KERB' ? 0.2 : 0}\n`,
    )
    .join('\n');
}

/** ui_track.json shown by Content Manager for the exported track. */
export function uiTrackJson(
  project: Project,
  samples: Sample[],
  stats: { length: number },
  locale: Locale = 'fr',
): string {
  return JSON.stringify(
    {
      name: project.name,
      description: catalogues[locale].documents.trackDescription(project.closed),
      tags: [project.closed ? 'circuit' : 'hillclimb', 'fictional', 'roadbuilder'],
      country: 'France',
      city: '',
      length: `${Math.round(stats.length)} m`,
      width: `${project.width} m`,
      pitboxes: '1',
      run: project.closed
        ? samples.reduce(
            (sum, p, i) => (i ? sum + samples[i - 1].x * p.z - p.x * samples[i - 1].z : sum),
            0,
          ) > 0
          ? 'clockwise'
          : 'counter-clockwise'
        : 'point-to-point',
      author: project.author || 'Roadbuilder',
      version: '0.1',
      url: '',
      year: 2026,
    },
    null,
    2,
  );
}

/** LIRE-MOI.txt shipped in the OBJ archive. */
export function objReadme(barrierCount: number, locale: Locale = 'fr'): string {
  return catalogues[locale].documents.objReadme(barrierCount);
}

interface InstallationTextOptions {
  project: Project;
  slug: string;
  barrierCount: number;
  warnings: TrackIssue[];
  locale?: Locale;
}

/**
 * INSTALLATION.txt shipped in the Assetto Corsa archive. Its text depends on the
 * barrier count so that projects without barriers keep their previous archive bytes.
 */
export function installationText({
  project,
  slug,
  barrierCount,
  warnings,
  locale = 'fr',
}: InstallationTextOptions): string {
  return catalogues[locale].documents.installation({
    name: project.name,
    slug,
    terrainMargin: project.terrainMargin,
    barrierCount,
    warnings,
  });
}
