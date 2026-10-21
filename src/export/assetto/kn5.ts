import { bounds } from '../../core/math';
import type { Scene } from '../../core/scene/scene';
import { emissive } from '../../core/scene/materials';
import type { MaterialId } from '../../core/scene/materials';
import { vertexCount } from '../../core/scene/mesh';
import { BinaryWriter, utf8 } from '../binary/writer';
import { texture, textureFile, usedMaterials } from '../textures';

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const TANGENT = [1, 0, 0];
const shading = (material: MaterialId) => ({
  ksAmbient: 0.35,
  ksDiffuse: 0.65,
  ksSpecular: 0.05,
  ksSpecularEXP: 12,
  ksEmissive: emissive(material),
});

// KN5 v5 field layout independently implemented from the public AcTools format.
// Reference: github.com/gro-ove/actools/blob/master/AcTools/Kn5File/Kn5Writer.cs
export function encodeKn5(scene: Scene) {
  const writer = new BinaryWriter(1024 * 1024);
  const materials = usedMaterials(scene);
  const slot = new Map(materials.map((material, index) => [material, index]));
  writer.raw(utf8('sc6969')).u32(5).u32(materials.length);
  for (const material of materials) {
    const png = texture(material);
    writer.u32(1).string(textureFile(material)).u32(png.length).raw(png);
  }
  writer.u32(materials.length);
  for (const material of materials) {
    writer.string(material).string('ksPerPixel').u8(0).u8(0).u32(0);
    const properties = shading(material);
    writer.u32(Object.keys(properties).length);
    // Each property holds a float, then a vec2, a vec3 and a vec4; ksEmissive is a
    // colour, read from the vec3.
    for (const [name, value] of Object.entries(properties)) {
      const colour = name === 'ksEmissive' ? [value, value, value] : [0, 0, 0];
      writer
        .string(name)
        .f32(value)
        .floats([0, 0, ...colour, 0, 0, 0, 0]);
    }
    writer.u32(1).string('txDiffuse').u32(0).string(textureFile(material));
  }
  writer
    .u32(1)
    .string('ROADBUILDER_ROOT')
    .u32(scene.meshes.length + scene.markers.length)
    .u8(1)
    .floats(IDENTITY);
  for (const mesh of scene.meshes) {
    const count = vertexCount(mesh);
    if (count > 65535) throw new Error('Too many vertices in a KN5 object.');
    writer.u32(2).string(mesh.name).u32(0).u8(1).u8(1).u8(1).u8(0).u32(count);
    for (let i = 0; i < count; i++)
      writer
        .floats(mesh.positions.slice(i * 3, i * 3 + 3))
        .floats(mesh.normals.slice(i * 3, i * 3 + 3))
        .floats(mesh.uvs.slice(i * 2, i * 2 + 2))
        .floats(TANGENT);
    writer.u32(mesh.indices.length);
    for (const index of mesh.indices) writer.u16(index);
    const corners = [];
    for (let i = 0; i < count; i++)
      corners.push({
        x: mesh.positions[i * 3],
        y: mesh.positions[i * 3 + 1],
        z: mesh.positions[i * 3 + 2],
      });
    const box = bounds(corners);
    const center = [
      (box.minX + box.maxX) / 2,
      (box.minY + box.maxY) / 2,
      (box.minZ + box.maxZ) / 2,
    ];
    const radius = Math.hypot(box.maxX - box.minX, box.maxY - box.minY, box.maxZ - box.minZ) / 2;
    writer
      .u32(slot.get(mesh.material)!)
      .u32(0)
      .f32(0)
      .f32(100000)
      .floats(center)
      .f32(radius)
      // IsRenderable = 0 keeps the collision without drawing the mesh, like the official walls.
      .u8(mesh.visible ? 1 : 0);
  }
  for (const marker of scene.markers)
    writer.u32(1).string(marker.name).u32(0).u8(1).floats(marker.transform);
  return writer.finish();
}
