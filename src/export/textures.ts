import { look, MATERIALS } from '../core/scene/materials';
import type { MaterialId } from '../core/scene/materials';
import type { Scene } from '../core/scene/scene';
import { texturePng } from './binary/png';

/** The images of the scenery materials, by file name (docs/adr/0014). */
export type SceneryImages = Readonly<Record<string, Uint8Array>>;

/** File name of a material's texture: its image, or kerbRed → kerb_red.png. */
export const textureFile = (material: MaterialId) =>
  look(material).image ??
  `${material.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)}.png`;

/** The material's texture: its image, or its 32×32 grain texture. */
export function texture(material: MaterialId, images: SceneryImages): Uint8Array {
  const { color, grain, image } = look(material);
  if (!image) return texturePng([...color], grain);
  const bytes = images[image];
  if (!bytes) throw new Error(`Missing scenery image ${image}.`);
  return bytes;
}

/** Materials used by the scene, in catalogue order. */
export function usedMaterials(scene: Scene): MaterialId[] {
  const used = new Set(scene.meshes.map((mesh) => mesh.material));
  return (Object.keys(MATERIALS) as MaterialId[]).filter((material) => used.has(material));
}

/** The image files a scene needs. */
export const sceneImages = (scene: Scene) =>
  usedMaterials(scene).flatMap((material) => look(material).image ?? []);
