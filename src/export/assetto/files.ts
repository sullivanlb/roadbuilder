import { isCircuit } from '../../core/project/schema';
import type { Project } from '../../core/project/schema';
import type { SceneLight } from '../../core/scene/scenery';
import { isClockwise } from '../../core/track/centerline';
import type { Sample, TrackStats } from '../../core/track/centerline';
import type { DocumentTexts } from '../documents';

/**
 * Physical surfaces of the track. Assetto Corsa picks one for each mesh whose
 * name starts with a digit followed by the KEY (1ROAD_main, 1GRASS_terrain_0…).
 */
const SURFACES = [
  { key: 'ROAD', friction: 1, valid: 1, pit: 0, dirt: 0, vibration: 0, vibrationLength: 0 },
  { key: 'GRASS', friction: 0.65, valid: 0, pit: 0, dirt: 1, vibration: 0, vibrationLength: 0 },
  { key: 'KERB', friction: 0.95, valid: 1, pit: 0, dirt: 0, vibration: 0.1, vibrationLength: 0.2 },
  { key: 'PIT', friction: 1, valid: 1, pit: 1, dirt: 0, vibration: 0, vibrationLength: 0 },
] as const;

type IniSections = Record<string, Record<string, string | number>>;

const ini = (sections: IniSections) =>
  Object.entries(sections)
    .map(
      ([name, values]) =>
        `[${name}]\n` +
        Object.entries(values)
          .map(([key, value]) => `${key}=${value}\n`)
          .join(''),
    )
    .join('\n');

export const surfacesIni = () =>
  ini(
    Object.fromEntries(
      SURFACES.map((surface, index) => [
        `SURFACE_${index}`,
        {
          KEY: surface.key,
          FRICTION: surface.friction,
          DAMPING: 0,
          WAV: '',
          WAV_PITCH: 0,
          FF_EFFECT: 'NULL',
          DIRT_ADDITIVE: surface.dirt,
          IS_VALID_TRACK: surface.valid,
          BLACK_FLAG_TIME: 0,
          SIN_HEIGHT: 0,
          SIN_LENGTH: 0,
          IS_PITLANE: surface.pit,
          VIBRATION_GAIN: surface.vibration,
          VIBRATION_LENGTH: surface.vibrationLength,
        },
      ]),
    ),
  );

export const modelsIni = (kn5: string) =>
  ini({ MODEL_0: { FILE: kn5, POSITION: '0,0,0', ROTATION: '0,0,0' } });

export const lightingIni = () => ini({ LIGHTING: { SUN_PITCH_ANGLE: 45, SUN_HEADING_ANGLE: 30 } });

const vector = (values: readonly number[]) => values.map((v) => +v.toFixed(3)).join(', ');

/**
 * extension/ext_config.ini, read by Custom Shaders Patch: one light per lamp and
 * the lamp material glowing brighter, both lit when the sun sets. `SUN` is the
 * sun angle from the zenith, 90 at the horizon (docs/assetto-corsa.md).
 */
export function extConfigIni(lights: readonly SceneLight[]) {
  const sections: IniSections = {
    CONDITION_0: { NAME: 'ROADBUILDER_NIGHT', INPUT: 'SUN', LUT: '(|0=0|86=0|96=1|180=1|)' },
    MATERIAL_ADJUSTMENT_0: {
      MATERIALS: 'lamp',
      KEY_0: 'ksEmissive',
      VALUE_0: '30, 28, 24',
      VALUE_0_OFF: '0.6, 0.6, 0.6',
      CONDITION: 'ROADBUILDER_NIGHT',
    },
  };
  lights.forEach((light, i) => {
    sections[`LIGHT_${i}`] = {
      POSITION: vector(light.position),
      DIRECTION: vector(light.direction),
      COLOR: '1, 0.92, 0.8, 30',
      SPOT: 140,
      SPOT_SHARPNESS: 0.3,
      RANGE: 45,
      RANGE_GRADIENT_OFFSET: 0.2,
      FADE_AT: 500,
      FADE_SMOOTH: 50,
      CONDITION: 'ROADBUILDER_NIGHT',
    };
  });
  return ini(sections);
}

export const grooveIni = () => ini({ GROOVE: { VIRTUAL_LAPS: 1, MAX_LAPS: 30, STARTING_LAPS: 0 } });

/** The roadway width, as a range where width zones make it vary. */
function widthLabel(samples: readonly Sample[]): string {
  const widths = samples.map((sample) => Math.round(sample.half * 20) / 10);
  const min = Math.min(...widths),
    max = Math.max(...widths);
  return min === max ? `${min} m` : `${min}–${max} m`;
}

/** ui_track.json, read by the game and Content Manager to present the track. */
export function uiTrackJson(
  project: Project,
  samples: readonly Sample[],
  stats: TrackStats,
  texts: DocumentTexts,
): string {
  const circuit = isCircuit(project);
  return JSON.stringify(
    {
      name: project.name,
      description: texts.trackDescription(project.road.closed),
      tags: [circuit ? 'circuit' : 'hillclimb', 'fictional', 'roadbuilder'],
      country: '',
      city: '',
      length: `${Math.round(stats.length)} m`,
      width: widthLabel(samples),
      pitboxes: String(project.cars),
      run: circuit ? (isClockwise(samples) ? 'clockwise' : 'counter-clockwise') : 'point-to-point',
      author: project.author || 'Roadbuilder',
      version: '1.0',
      url: '',
      year: new Date().getFullYear(),
    },
    null,
    2,
  );
}
