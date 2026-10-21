import { createI18n } from 'vue-i18n';
import type { ProjectErrorDetail } from '../core/project/errors';
import type { TrackIssue } from '../core/track/issues';
import type { DocumentTexts } from '../export/documents';
import type { ExportError } from '../export/errors';
import { enMessages } from './en';
import { frMessages } from './fr';
import type { MessageKey, MessageParams } from './fr';
import { LOCALE_STORAGE_KEY, storedLocale } from './locale';
import type { Locale } from './locale';

export type { Locale } from './locale';
export { LOCALES, LOCALE_STORAGE_KEY } from './locale';
export type { MessageKey, MessageParams } from './fr';

/**
 * vue-i18n instance installed on the app in main.ts. Messages stay flat objects
 * whose keys contain dots, hence flatJson; French is both the default and the
 * fallback, so a missing key can never surface in another language.
 *
 * flatJson nests the flat keys *inside the object it is given*, so the instance
 * receives shallow copies and the fr/en modules keep their flat, immutable shape.
 */
export const i18n = createI18n({
  legacy: false,
  locale: storedLocale(),
  fallbackLocale: 'fr',
  flatJson: true,
  messages: { fr: { ...frMessages }, en: { ...enMessages } },
});

/** Current interface language; vue-i18n owns the ref, so views follow setLocale(). */
export const locale = i18n.global.locale;

/** Mirrors the language onto the root element so assistive tools and CSS follow it. */
export function initLocale() {
  try {
    document.documentElement.lang = locale.value;
  } catch {
    /* Outside a browser the attribute stays unset. */
  }
}

export function setLocale(next: Locale) {
  locale.value = next;
  initLocale();
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
  } catch {
    /* The preference stays in memory when storage is unavailable. */
  }
}

/** Fills the {placeholders} of one message and picks the plural form when asked to. */
type Translate = <K extends MessageKey>(
  key: K,
  params?: MessageParams<K>,
  plural?: number,
) => string;

/** Bound to one locale, or to the reactive current one when no locale is given. */
function translator(target?: Locale): Translate {
  if (target === undefined) {
    return (key, params, plural) =>
      plural === undefined
        ? i18n.global.t(key, params ?? {})
        : i18n.global.t(key, params ?? {}, plural);
  }
  // vue-i18n only honours a per-call locale through its options object, plural included.
  return (key, params, plural) =>
    i18n.global.t(
      key,
      params ?? {},
      plural === undefined ? { locale: target } : { locale: target, plural },
    );
}

/** Looks up an interface string and fills its {placeholders}. */
export const t: Translate = translator();

/** Formats a number with the separators of the current language. */
export function formatNumber(value: number, digits = 0): string {
  return i18n.global.n(value, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Turns a project import failure into the text shown to the user. */
export function formatProjectError(detail: ProjectErrorDetail, target?: Locale): string {
  const tr = translator(target);
  switch (detail.code) {
    case 'file-too-large':
      return tr('projectError.fileTooLarge', { size: detail.maxBytes / (1024 * 1024) });
    case 'invalid-json':
      return tr('projectError.invalidJson');
    case 'not-a-project':
      return tr('projectError.notAProject');
    case 'points-limit':
      return tr('projectError.pointsLimit', { max: detail.max });
    case 'barriers-limit':
      return tr('projectError.barriersLimit', { max: detail.max });
    case 'width-zones-limit':
      return tr('projectError.widthZonesLimit', { max: detail.max });
    case 'bank-zones-limit':
      return tr('projectError.bankZonesLimit', { max: detail.max });
    case 'scenery-limit':
      return tr('projectError.sceneryLimit', { max: detail.max });
    case 'duplicate-id':
      return tr('projectError.duplicateId');
    case 'barrier-endpoint':
      return tr('projectError.barrierEndpoint');
    case 'barrier-span':
      return tr('projectError.barrierSpan');
    case 'barrier-direction':
      return tr('projectError.barrierDirection');
    case 'invalid-value':
      return tr('projectError.invalidValue', { path: detail.path });
    case 'position-point':
      return tr('projectError.positionPoint');
    case 'pit-lane-on-road':
      return tr('projectError.pitLaneOnRoad');
    case 'cars-without-pit-lane':
      return tr('projectError.carsWithoutPitLane');
  }
}

/** Turns a track diagnostic into the text shown to the user. */
export function formatTrackIssue(issue: TrackIssue, target?: Locale): string {
  const tr = translator(target);
  switch (issue.code) {
    case 'points-minimum':
      return issue.closed
        ? tr('trackIssue.pointsMinimumClosed', { min: issue.min })
        : tr('trackIssue.pointsMinimumOpen', { min: issue.min });
    case 'track-too-short':
      return tr('trackIssue.trackTooShort', { min: issue.min });
    case 'points-too-close':
      return tr('trackIssue.pointsTooClose', { min: issue.min });
    case 'steep-grade':
      return tr('trackIssue.steepGrade', { grade: Math.round(issue.grade) });
    case 'tight-turn':
      return tr('trackIssue.tightTurn', { from: issue.from + 1, to: issue.to + 1 });
    case 'track-crossing':
      return tr('trackIssue.trackCrossing');
    case 'pit-lane-too-short':
      return tr('trackIssue.pitLaneTooShort', { cars: issue.cars, capacity: issue.capacity });
    case 'pit-lane-too-tight':
      return tr('trackIssue.pitLaneTooTight', { from: issue.from + 1, to: issue.to + 1 });
    case 'width-zones-overlap':
      return tr('trackIssue.widthZonesOverlap');
    case 'bank-zones-overlap':
      return tr('trackIssue.bankZonesOverlap');
    case 'radius-reduced':
      return tr('trackIssue.radiusReduced', {
        point: issue.point + 1,
        requested: Math.round(issue.requested),
        actual: Math.round(issue.actual),
      });
    case 'sharp-corner':
      return tr('trackIssue.sharpCorner', { point: issue.point + 1, angle: issue.angle });
  }
}

/** Turns a failed export into the text appended to the « export failed » notification. */
export function formatExportError(error: ExportError, target?: Locale): string {
  const detail = error.detail;
  return detail.code === 'invalid-track'
    ? detail.issues.errors.map((issue) => formatTrackIssue(issue, target)).join('\n')
    : translator(target)('exportError.foldedSurface');
}

/** Localised texts embedded in the exported archives. */
export function documentTexts(target: Locale): DocumentTexts {
  const tr = translator(target);
  return {
    objHeader: tr('documents.objHeader'),
    trackDescription: (closed) =>
      tr('documents.trackDescription', {
        mode: tr(closed ? 'sidebar.closed' : 'sidebar.open'),
      }),
    objReadme: (barrierCount) =>
      tr('documents.objReadme') + (barrierCount ? tr('documents.objReadmeBarriers') : ''),
    installation: ({ name, slug, projectFile, terrainMargin, barrierCount, pitBoxes, warnings }) =>
      tr('documents.installationHead', { name, slug }) +
      (pitBoxes === null
        ? tr('documents.installationSpawnPit')
        : tr('documents.installationPitLane', { count: pitBoxes })) +
      (barrierCount
        ? tr('documents.installationBarriers', { count: barrierCount }, barrierCount) + '\n'
        : '') +
      tr('documents.installationBody', { terrainMargin }) +
      (barrierCount
        ? tr('documents.installationBarrierLimits')
        : tr('documents.installationNoBarrierLimits')) +
      tr('documents.installationTail', { projectFile }) +
      (warnings.length
        ? '\n' +
          tr('documents.installationWarnings') +
          '\n' +
          warnings.map((issue) => formatTrackIssue(issue, target)).join('\n')
        : '') +
      '\n',
  };
}
