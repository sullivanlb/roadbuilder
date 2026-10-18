import type { Template } from '../types';

export interface TemplateDefinition {
  name: string;
  closed: boolean;
  width: number;
  points: [number, number, number][];
}

/** Built-in templates offered when creating a project. */
export const TEMPLATES: Record<Template, TemplateDefinition> = {
  club: {
    name: 'Circuit des Collines',
    closed: true,
    width: 12,
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
    name: 'Karting des Pins',
    closed: true,
    width: 7,
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
    name: 'Col de la Lumière',
    closed: false,
    width: 8,
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
  blank: { name: 'Mon nouveau tracé', closed: false, width: 10, points: [] },
};
