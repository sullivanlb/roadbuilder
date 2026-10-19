/** Look of every material in the scene: base colour (sRGB 0–255) and texture grain. */
export const MATERIALS = {
  asphalt: { color: [67, 72, 76], grain: 12 },
  grass: { color: [76, 103, 62], grain: 25 },
  kerbRed: { color: [184, 57, 48], grain: 12 },
  paint: { color: [224, 225, 211], grain: 12 },
  pit: { color: [87, 91, 91], grain: 12 },
  metal: { color: [168, 174, 176], grain: 12 },
  tire: { color: [38, 40, 42], grain: 12 },
  tecproRed: { color: [172, 48, 40], grain: 12 },
  tecproWhite: { color: [226, 224, 214], grain: 12 },
  concrete: { color: [186, 184, 176], grain: 12 },
} as const satisfies Record<string, { color: readonly [number, number, number]; grain: number }>;

export type MaterialId = keyof typeof MATERIALS;

export const MATERIAL_IDS = Object.keys(MATERIALS) as MaterialId[];
