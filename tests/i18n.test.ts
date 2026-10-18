import { describe, expect, it } from 'vitest';
import { ExportError } from '../src/domain/diagnostics';
import { createProject } from '../src/domain/project/factory';
import { buildExport } from '../src/export/trackExport';
import type { ExportFiles } from '../src/domain/types';
import { catalogues } from '../src/i18n/catalogues';
import { enMessages } from '../src/i18n/en';
import {
  formatExportError,
  formatProjectError,
  formatTrackIssue,
  frMessages,
} from '../src/i18n/fr';

describe('French catalogue', () => {
  it('formats project import failures with their parameters', () => {
    expect(formatProjectError({ code: 'value-range', field: 'x', min: -10000, max: 10000 })).toBe(
      'Position X : valeur attendue entre -10000 et 10000.',
    );
    expect(formatProjectError({ code: 'barrier-index', end: 'to' })).toBe(
      'Fin de barrière : indice de point hors du tracé.',
    );
    expect(formatProjectError({ code: 'name-length', min: 1, max: 80 })).toBe(
      'Le nom doit contenir de 1 à 80 caractères.',
    );
  });

  it('formats the diagnostics shown in the editor', () => {
    expect(formatTrackIssue({ code: 'points-minimum', min: 3, closed: true })).toBe(
      'Ajoutez au moins 3 points pour fermer le circuit.',
    );
    expect(formatTrackIssue({ code: 'points-minimum', min: 2, closed: false })).toBe(
      'Ajoutez au moins 2 points pour créer une route.',
    );
    expect(formatTrackIssue({ code: 'tight-turn', from: 2, to: 3 })).toContain('points 3 et 4');
    expect(formatTrackIssue({ code: 'steep-grade', grade: 17.6 })).toBe(
      'Pente maximale de 18 % : certaines voitures auront des difficultés.',
    );
  });

  it('lists the issues of a rejected export', () => {
    const invalid = new ExportError(
      { code: 'invalid-track' },
      { errors: [{ code: 'points-too-close', min: 2 }], warnings: [], tightTurns: [] },
    );
    expect(formatExportError(invalid)).toBe(
      'Deux points consécutifs sont trop proches (minimum 2 m).',
    );
    expect(formatExportError(new ExportError({ code: 'folded-edge' }))).toContain(
      'se replie dans un virage',
    );
  });
});

const placeholders = (text: string) =>
  [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

const jsonFile = (files: ExportFiles, suffix: string) =>
  JSON.parse(files[Object.keys(files).find((key) => key.endsWith(suffix))!] as string) as {
    description: string;
  };

describe('English catalogue', () => {
  it('formats the imported project and export failures', () => {
    expect(
      catalogues.en.projectError({ code: 'value-range', field: 'x', min: -10000, max: 10000 }),
    ).toBe('Position X: expected value between -10000 and 10000.');
    expect(catalogues.en.projectError({ code: 'barrier-index', end: 'to' })).toBe(
      'Barrier end: point index out of the track.',
    );
    const invalid = new ExportError(
      { code: 'invalid-track' },
      { errors: [{ code: 'points-too-close', min: 2 }], warnings: [], tightTurns: [] },
    );
    expect(catalogues.en.exportError(invalid)).toBe(
      'Two consecutive points are too close (minimum 2 m).',
    );
    expect(catalogues.en.exportError(new ExportError({ code: 'folded-edge' }))).toContain(
      'folds inside a corner',
    );
  });

  it('formats the track diagnostics', () => {
    expect(catalogues.en.trackIssue({ code: 'points-minimum', min: 3, closed: true })).toBe(
      'Add at least 3 points to close the circuit.',
    );
    expect(catalogues.en.trackIssue({ code: 'tight-turn', from: 2, to: 3 })).toContain(
      'points 3 and 4',
    );
    expect(catalogues.en.trackIssue({ code: 'steep-grade', grade: 17.6 })).toBe(
      'Maximum grade of 18 %: some cars will struggle.',
    );
  });

  it('covers every French message with the same placeholders', () => {
    for (const key of Object.keys(frMessages) as (keyof typeof frMessages)[]) {
      expect(enMessages[key], key).toBeTruthy();
      expect(placeholders(enMessages[key]), key).toEqual(placeholders(frMessages[key]));
    }
  });

  it('writes the exported documents in English', () => {
    const documents = catalogues.en.documents;
    expect(documents.objHeader).toBe('# Roadbuilder — meters, Y up, forward -Z');
    expect(documents.trackDescription(true)).toBe(
      'Made with Roadbuilder. Closed circuit. Prototype for solo free practice.',
    );
    expect(documents.objReadme(0)).toContain('Import track.obj into Blender');
    expect(documents.objReadme(1)).toContain('1WALL_*');
    expect(
      documents.installation({
        name: 'Circuit test',
        slug: 'circuit_test',
        terrainMargin: 300,
        barrierCount: 2,
        warnings: [],
      }),
    ).toContain('EXPERIMENTAL KN5 EXPORT, TO BE CHECKED IN GAME');
    expect(
      documents.installation({
        name: 'Circuit test',
        slug: 'circuit_test',
        terrainMargin: 300,
        barrierCount: 2,
        warnings: [{ code: 'steep-grade', grade: 18.2 }],
      }),
    ).toContain('WARNINGS\nMaximum grade of 18 %');
  });

  it('localises the archives while the default stays French', () => {
    const project = createProject('club');
    const english = buildExport(project, 'ac', 'en');
    const french = buildExport(project, 'ac');
    expect(english.files['INSTALLATION.txt']).toContain('EXPERIMENTAL KN5 EXPORT');
    expect(french.files['INSTALLATION.txt']).toContain('EXPORT KN5 EXPÉRIMENTAL');
    expect(jsonFile(english.files, 'ui/ui_track.json').description).toContain(
      'Made with Roadbuilder',
    );
    expect(jsonFile(french.files, 'ui/ui_track.json').description).toContain(
      'Créé avec Roadbuilder',
    );
    const englishObj = buildExport(project, 'obj', 'en');
    expect(englishObj.files['LIRE-MOI.txt']).toContain('Import track.obj into Blender');
    expect(englishObj.files['track.obj']).toContain('# Roadbuilder — meters');
    expect(buildExport(project, 'obj', 'fr').files['track.obj']).toContain(
      '# Roadbuilder — mètres',
    );
  });
});
