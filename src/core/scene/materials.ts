/**
 * Look of every material in the scene: base colour (sRGB 0–255), texture grain
 * and, for what glows, how bright it shines by itself.
 */
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
  bark: { color: [88, 66, 48], grain: 20 },
  foliage: { color: [64, 98, 50], grain: 30 },
  conifer: { color: [42, 74, 52], grain: 30 },
  facade: { color: [198, 190, 172], grain: 12 },
  roof: { color: [78, 82, 86], grain: 12 },
  glass: { color: [72, 98, 116], grain: 6 },
  seat: { color: [52, 92, 150], grain: 8 },
  signBoard: { color: [226, 172, 46], grain: 6 },
  steel: { color: [124, 130, 134], grain: 10 },
  lamp: { color: [255, 241, 206], grain: 4, emissive: 0.6 },
} as const satisfies Record<
  string,
  { color: readonly [number, number, number]; grain: number; emissive?: number }
>;

/** How bright a material shines by itself, 0 for what does not glow. */
export const emissive = (material: MaterialId): number => {
  const look = MATERIALS[material];
  return 'emissive' in look ? look.emissive : 0;
};

export type MaterialId = keyof typeof MATERIALS;

export const MATERIAL_IDS = Object.keys(MATERIALS) as MaterialId[];
