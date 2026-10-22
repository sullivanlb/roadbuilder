import type { NumericRule } from './rules';
import type { Earthwork, EarthworkType, Hill } from './schema';

/** The settings of an earthwork that can change with its type. */
export const EARTHWORK_SETTING_NAMES = ['offset', 'width', 'height'] as const;
export type EarthworkSettings = Pick<Earthwork, (typeof EARTHWORK_SETTING_NAMES)[number]>;

/**
 * Farthest an earthwork reaches beyond the shoulders, offset and width together:
 * within the narrowest terrain margin, so it always lies on the terrain.
 */
export const EARTHWORK_REACH = 50;

/**
 * The settings each type of earthwork accepts, in metres (docs/adr/0015). A rule
 * whose minimum is its maximum is fixed and not offered in the interface. The
 * height of a ditch is its depth; an embankment falls when its height is negative.
 */
export const EARTHWORK_RULES: Record<
  EarthworkType,
  Record<keyof EarthworkSettings, NumericRule>
> = {
  embankment: {
    offset: { min: 0, max: 30, step: 0.5 },
    width: { min: 2, max: 40, step: 0.5 },
    height: { min: -20, max: 20, step: 0.5 },
  },
  ditch: {
    offset: { min: 0, max: 30, step: 0.5 },
    width: { min: 1, max: 12, step: 0.5 },
    height: { min: 0.2, max: 4, step: 0.1 },
  },
  runoff: {
    offset: { min: 0, max: 0, step: 0.5 },
    width: { min: 5, max: EARTHWORK_REACH, step: 1 },
    height: { min: 0, max: 0, step: 0.5 },
  },
};

/** What a new earthwork of each type looks like. */
export const EARTHWORK_DEFAULTS: Record<EarthworkType, EarthworkSettings> = {
  embankment: { offset: 2, width: 8, height: 3 },
  ditch: { offset: 1, width: 3, height: 0.8 },
  runoff: { offset: 0, width: 25, height: 0 },
};

/** Whether a setting of a type can be changed: a fixed one cannot. */
export const editableEarthwork = (type: EarthworkType, setting: keyof EarthworkSettings) =>
  EARTHWORK_RULES[type][setting].min < EARTHWORK_RULES[type][setting].max;

/** What a new hill looks like: an oval rise, longer across its heading. */
export const HILL_DEFAULTS: Pick<Hill, 'width' | 'depth' | 'height'> = {
  width: 120,
  depth: 80,
  height: 12,
};
