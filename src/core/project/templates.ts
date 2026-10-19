import type { RoadSettings } from './schema';

export const TEMPLATES = ['club', 'kart', 'mountain', 'blank'] as const;
export type Template = (typeof TEMPLATES)[number];

interface TemplateDefinition {
  road: Omit<RoadSettings, 'shoulder'>;
  points: readonly (readonly [x: number, y: number, z: number])[];
}

/** Built-in starting tracks; their names come from the interface language. */
export const TEMPLATE_DEFINITIONS: Record<Template, TemplateDefinition> = {
  club: {
    road: { closed: true, width: 12, kerbs: true },
    points: [
      [-280, 0, 180],
      [80, 0, 180],
      [270, 4, 120],
      [310, 8, -80],
      [190, 12, -180],
      [50, 10, -100],
      [-50, 5, -180],
      [-260, 1, -140],
      [-340, 0, 0],
    ],
  },
  kart: {
    road: { closed: true, width: 7, kerbs: true },
    points: [
      [-130, 0, 70],
      [80, 0, 70],
      [140, 0, 20],
      [100, 0, -55],
      [35, 0, -70],
      [20, 0, 0],
      [-30, 0, 15],
      [-55, 0, -65],
      [-135, 0, -60],
    ],
  },
  mountain: {
    road: { closed: false, width: 8, kerbs: false },
    points: [
      [-300, 0, 300],
      [-80, 12, 300],
      [180, 25, 220],
      [210, 38, 110],
      [-150, 56, 90],
      [-210, 70, -20],
      [130, 90, -65],
      [190, 106, -160],
      [-80, 130, -240],
      [-280, 145, -310],
    ],
  },
  blank: { road: { closed: false, width: 10, kerbs: true }, points: [] },
};
