import type { Scene } from '../domain/types';
import { MATERIALS } from '../domain/track/mesh';
import { catalogues } from '../i18n/catalogues';
import type { Locale } from '../i18n/catalogues';
import { usedMaterialIndexes } from './materials';

/** Encodes the scene as Wavefront OBJ plus its material library. */
export function encodeObj(scene: Scene, locale: Locale = 'fr') {
  const lines = [catalogues[locale].documents.objHeader, 'mtllib track.mtl'];
  let offset = 1;
  for (const mesh of scene.meshes) {
    lines.push(`o ${mesh.name}`, `usemtl ${MATERIALS[mesh.material].name}`);
    for (const v of mesh.vertices) lines.push(`v ${v.position.map((n) => n.toFixed(5)).join(' ')}`);
    for (const v of mesh.vertices) lines.push(`vt ${v.uv.map((n) => n.toFixed(5)).join(' ')}`);
    for (const v of mesh.vertices) lines.push(`vn ${v.normal.map((n) => n.toFixed(5)).join(' ')}`);
    for (let i = 0; i < mesh.indices.length; i += 3)
      lines.push(
        'f ' +
          mesh.indices
            .slice(i, i + 3)
            .map((n) => `${n + offset}/${n + offset}/${n + offset}`)
            .join(' '),
      );
    offset += mesh.vertices.length;
  }
  const mtl = usedMaterialIndexes(scene)
    .map(
      (index) =>
        `newmtl ${MATERIALS[index].name}\nKa 0.35 0.35 0.35\nKd 1 1 1\nKs 0.05 0.05 0.05\nmap_Kd texture/${MATERIALS[index].texture}\n`,
    )
    .join('\n');
  return { obj: lines.join('\n') + '\n', mtl };
}
