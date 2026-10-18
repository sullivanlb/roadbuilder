import { describe, expect, it } from 'vitest';
import { ExportError } from '../src/domain/diagnostics';
import { formatExportError, formatProjectError, formatTrackIssue } from '../src/i18n/fr';

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
