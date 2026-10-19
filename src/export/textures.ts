import { MATERIALS } from '../core/scene/materials';
import type { MaterialId } from '../core/scene/materials';
import type { Scene } from '../core/scene/scene';
import { texturePng } from './binary/png';

/** File name of a material's texture: kerbRed → kerb_red.png. */
export const textureFile = (material: MaterialId) =>
  `${material.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)}.png`;

/** The material's 32×32 grain texture. */
export const texture = (material: MaterialId) =>
  texturePng([...MATERIALS[material].color], MATERIALS[material].grain);

/** Materials used by the scene, in catalogue order. */
export function usedMaterials(scene: Scene): MaterialId[] {
  const used = new Set(scene.meshes.map((mesh) => mesh.material));
  return (Object.keys(MATERIALS) as MaterialId[]).filter((material) => used.has(material));
}
