import type { Scene } from '../domain/types';
import { BASE_MATERIALS, MATERIALS } from '../domain/track/mesh';

/**
 * Materials actually written: the five base ones, always present so that
 * projects without barriers stay identical to previous exports, plus the
 * barrier materials in use, in catalogue order.
 */
export function usedMaterialIndexes(scene: Scene) {
  const used = new Set(scene.meshes.map((mesh) => mesh.material));
  return MATERIALS.map((_, index) => index).filter(
    (index) => index < BASE_MATERIALS || used.has(index),
  );
}
