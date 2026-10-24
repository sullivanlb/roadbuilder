import type { Scene } from '../../core/scene/scene';
import { emissive, look } from '../../core/scene/materials';
import { vertexCount } from '../../core/scene/mesh';
import { textureFile, usedMaterials } from '../textures';

const format = (values: number[]) => values.map((n) => n.toFixed(5)).join(' ');

/** Encodes the scene as Wavefront OBJ plus its material library. */
export function encodeObj(scene: Scene, header: string) {
  const lines = [header, 'mtllib track.mtl'];
  let offset = 1;
  for (const mesh of scene.meshes) {
    const count = vertexCount(mesh);
    lines.push(`o ${mesh.name}`, `usemtl ${mesh.material}`);
    for (let i = 0; i < count; i++)
      lines.push(`v ${format(mesh.positions.slice(i * 3, i * 3 + 3))}`);
    for (let i = 0; i < count; i++) lines.push(`vt ${format(mesh.uvs.slice(i * 2, i * 2 + 2))}`);
    for (let i = 0; i < count; i++)
      lines.push(`vn ${format(mesh.normals.slice(i * 3, i * 3 + 3))}`);
    for (let i = 0; i < mesh.indices.length; i += 3)
      lines.push(
        'f ' +
          mesh.indices
            .slice(i, i + 3)
            .map((n) => `${n + offset}/${n + offset}/${n + offset}`)
            .join(' '),
      );
    offset += count;
  }
  const mtl = usedMaterials(scene)
    .map(
      (material) =>
        `newmtl ${material}\nKa 0.35 0.35 0.35\nKd 1 1 1\nKs 0.05 0.05 0.05\n` +
        (emissive(material) ? `Ke ${Array(3).fill(emissive(material)).join(' ')}\n` : '') +
        `map_Kd texture/${textureFile(material)}\n` +
        (look(material).alphaTest ? `map_d texture/${textureFile(material)}\n` : ''),
    )
    .join('\n');
  return { obj: lines.join('\n') + '\n', mtl };
}
