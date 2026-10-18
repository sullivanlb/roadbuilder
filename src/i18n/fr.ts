import type {
  ExportError,
  ProjectErrorDetail,
  ProjectField,
  TrackIssue,
} from '../domain/diagnostics';

/** French labels of the ranged numeric fields carried by value-range errors. */
const FIELD_LABELS: Record<ProjectField, string> = {
  x: 'Position X',
  y: 'Altitude',
  z: 'Position Z',
  width: 'Largeur',
  shoulder: 'Accotement',
  terrainMargin: 'Marge du terrain',
  barrierOffset: 'Décalage de barrière',
};

/** Turns a project import failure into the French text shown to the user. */
export function formatProjectError(detail: ProjectErrorDetail): string {
  switch (detail.code) {
    case 'project-format':
      return 'Ce fichier n’est pas un projet Roadbuilder version 1.';
    case 'name-length':
      return `Le nom doit contenir de ${detail.min} à ${detail.max} caractères.`;
    case 'author-length':
      return `Auteur invalide (${detail.max} caractères maximum).`;
    case 'track-options':
      return 'Options du tracé invalides.';
    case 'points-limit':
      return `Maximum ${detail.max} points.`;
    case 'invalid-point':
      return 'Point invalide.';
    case 'value-range':
      return `${FIELD_LABELS[detail.field]} : valeur attendue entre ${detail.min} et ${detail.max}.`;
    case 'barriers-limit':
      return `Maximum ${detail.max} tronçons de barrière.`;
    case 'barriers-min-points':
      return 'Les barrières nécessitent au moins deux points de tracé.';
    case 'invalid-barrier':
      return 'Barrière invalide.';
    case 'barrier-type':
      return 'Type de barrière inconnu.';
    case 'barrier-side':
      return 'Côté de barrière invalide.';
    case 'barrier-index':
      return `${detail.end === 'from' ? 'Début' : 'Fin'} de barrière : indice de point hors du tracé.`;
    case 'barrier-span':
      return 'Une barrière doit couvrir au moins deux points.';
    case 'barrier-direction':
      return 'Sur une route ouverte, une barrière doit suivre le sens du tracé.';
  }
}

/** Turns a track diagnostic into the French text shown to the user. */
export function formatTrackIssue(issue: TrackIssue): string {
  switch (issue.code) {
    case 'points-minimum':
      return issue.closed
        ? `Ajoutez au moins ${issue.min} points pour fermer le circuit.`
        : `Ajoutez au moins ${issue.min} points pour créer une route.`;
    case 'track-too-short':
      return `Le tracé doit mesurer au moins ${issue.min} m pour accueillir le départ.`;
    case 'points-too-close':
      return `Deux points consécutifs sont trop proches (minimum ${issue.min} m).`;
    case 'steep-grade':
      return `Pente maximale de ${Math.round(issue.grade)} % : certaines voitures auront des difficultés.`;
    case 'tight-turn':
      return `Virage trop serré entre les points ${issue.from + 1} et ${issue.to + 1} pour cette largeur. Écartez les points du virage ou réduisez la largeur.`;
    case 'track-crossing':
      return 'Le tracé se croise : déplacez les points concernés. Les ponts ne sont pas pris en charge.';
  }
}

/** Turns a failed export into the French text appended to « Export impossible ». */
export function formatExportError(error: ExportError): string {
  return error.detail.code === 'invalid-track'
    ? (error.issues?.errors ?? []).map(formatTrackIssue).join('\n')
    : 'Un bord de route ou de stand se replie dans un virage. Écartez les points, réduisez la largeur ou déplacez le début du tracé vers une ligne droite.';
}
