/**
 * Look of a material. Most take a generated texture: a base colour (sRGB
 * 0–255) with some grain. Scenery and roadway materials take an image from
 * src/assets/scenery/textures instead (docs/adr/0014); their colour then
 * stands for the image where it cannot be shown.
 */
export interface MaterialLook {
  color: readonly [number, number, number];
  grain: number;
  /** How bright it shines by itself; absent for what does not glow. */
  emissive?: number;
  /** File name of its image among the scenery textures. */
  image?: string;
  /** Cut out where the image is transparent, like foliage. */
  alphaTest?: true;
  /** Metres covered by one repeat of the image, on surfaces that tile it. */
  tile?: number;
}

export const MATERIALS = {
  // The roadway, a photographed track asphalt at its real scale.
  asphalt: { color: [78, 80, 82], grain: 0, image: 'asphalt.png', tile: 2 },
  grass: { color: [76, 103, 62], grain: 25 },
  kerbRed: { color: [184, 57, 48], grain: 12 },
  paint: { color: [224, 225, 211], grain: 12 },
  pit: { color: [87, 91, 91], grain: 12 },
  metal: { color: [168, 174, 176], grain: 12 },
  tire: { color: [38, 40, 42], grain: 12 },
  tecproRed: { color: [172, 48, 40], grain: 12 },
  tecproWhite: { color: [226, 224, 214], grain: 12 },
  concrete: { color: [186, 184, 176], grain: 12 },
  // Scenery: trees.
  bark: { color: [96, 82, 70], grain: 0, image: 'bark.png' },
  branches: { color: [110, 96, 80], grain: 0, image: 'branches.png' },
  leaves: { color: [72, 100, 74], grain: 0, image: 'leaves.png', alphaTest: true },
  firBark: { color: [80, 66, 56], grain: 0, image: 'fir_bark.png' },
  needles: { color: [78, 98, 58], grain: 0, image: 'needles.png', alphaTest: true },
  // Scenery: buildings and grandstands, tiled over their surfaces.
  brick: { color: [150, 110, 96], grain: 0, image: 'brick.png', tile: 1.6 },
  stone: { color: [196, 190, 176], grain: 0, image: 'stone.png', tile: 2 },
  roofing: { color: [96, 96, 94], grain: 0, image: 'roofing.png', tile: 3 },
  cladding: { color: [128, 136, 142], grain: 0, image: 'cladding.png', tile: 2 },
  sheet: { color: [146, 150, 154], grain: 0, image: 'sheet.png', tile: 2 },
  glass: { color: [40, 50, 58], grain: 0, image: 'glass.png' },
  frame: { color: [20, 22, 24], grain: 6 },
  door: { color: [34, 44, 54], grain: 6 },
  seat: { color: [26, 70, 150], grain: 6 },
  // Scenery: lights and signs.
  steel: { color: [52, 56, 62], grain: 8 },
  galvanised: { color: [160, 164, 166], grain: 10 },
  housing: { color: [62, 64, 68], grain: 6 },
  grating: { color: [86, 86, 86], grain: 20 },
  panelBack: { color: [146, 150, 156], grain: 8 },
  lamp: { color: [255, 241, 206], grain: 4, emissive: 0.6 },
  ad0: { color: [20, 40, 90], grain: 0, image: 'ad_0.png' },
  ad1: { color: [20, 20, 20], grain: 0, image: 'ad_1.png' },
  ad2: { color: [180, 20, 20], grain: 0, image: 'ad_2.png' },
  ad3: { color: [20, 80, 40], grain: 0, image: 'ad_3.png' },
} as const satisfies Record<string, MaterialLook>;

export type MaterialId = keyof typeof MATERIALS;

export const MATERIAL_IDS = Object.keys(MATERIALS) as MaterialId[];

/** The look of a material, with its optional fields. */
export const look = (material: MaterialId): MaterialLook => MATERIALS[material];

/** How bright a material shines by itself, 0 for what does not glow. */
export const emissive = (material: MaterialId): number => look(material).emissive ?? 0;

/** The advertising boards, in turn along a grandstand or by sign. */
export const AD_MATERIALS = ['ad0', 'ad1', 'ad2', 'ad3'] as const satisfies readonly MaterialId[];
