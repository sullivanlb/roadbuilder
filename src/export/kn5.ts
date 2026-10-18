import type { Scene } from '../domain/types';
import { bounds } from '../domain/track/geometry';
import { MATERIALS } from '../domain/track/mesh';
import { BinaryWriter, utf8 } from './binary/writer';
import { texturePng } from './binary/png';
import { usedMaterialIndexes } from './materials';

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

// KN5 v5 field layout independently implemented from the public AcTools format.
// Reference: github.com/gro-ove/actools/blob/master/AcTools/Kn5File/Kn5Writer.cs
export function encodeKn5(scene: Scene) {
  const writer = new BinaryWriter(1024 * 1024);
  const indexes = usedMaterialIndexes(scene);
  const remap = new Map(indexes.map((material, position) => [material, position]));
  writer.raw(utf8('sc6969')).u32(5).u32(indexes.length);
  for (const index of indexes) {
    const material = MATERIALS[index];
    const texture = texturePng(material.color, material.name === 'grass' ? 25 : 12);
    writer.u32(1).string(material.texture).u32(texture.length).raw(texture);
  }
  writer.u32(indexes.length);
  for (const index of indexes) {
    const material = MATERIALS[index];
    writer.string(material.name).string('ksPerPixel').u8(0).u8(0).u32(0);
    const properties = {
      ksAmbient: 0.35,
      ksDiffuse: 0.65,
      ksSpecular: 0.05,
      ksSpecularEXP: 12,
      ksEmissive: 0,
    };
    writer.u32(Object.keys(properties).length);
    for (const [name, value] of Object.entries(properties))
      writer.string(name).f32(value).floats(new Array<number>(9).fill(0));
    writer.u32(1).string('txDiffuse').u32(0).string(material.texture);
  }
  writer
    .u32(1)
    .string('ROADBUILDER_ROOT')
    .u32(scene.meshes.length + scene.markers.length)
    .u8(1)
    .floats(IDENTITY);
  for (const mesh of scene.meshes) {
    if (mesh.vertices.length > 65535) throw new Error('Trop de sommets dans un objet KN5.');
    writer.u32(2).string(mesh.name).u32(0).u8(1).u8(1).u8(1).u8(0).u32(mesh.vertices.length);
    for (const v of mesh.vertices)
      writer.floats(v.position).floats(v.normal).floats(v.uv).floats(v.tangent);
    writer.u32(mesh.indices.length);
    for (const i of mesh.indices) writer.u16(i);
    const bb = bounds(
      mesh.vertices.map((v) => ({ x: v.position[0], y: v.position[1], z: v.position[2] })),
    );
    const center = [(bb.minX + bb.maxX) / 2, (bb.minY + bb.maxY) / 2, (bb.minZ + bb.maxZ) / 2];
    const radius = Math.hypot(bb.maxX - bb.minX, bb.maxY - bb.minY, bb.maxZ - bb.minZ) / 2;
    writer
      .u32(remap.get(mesh.material)!)
      .u32(0)
      .f32(0)
      .f32(100000)
      .floats(center)
      .f32(radius)
      // IsRenderable=0: the mesh keeps its collision but is not drawn,
      // like the collision walls of the official tracks.
      .u8(mesh.renderable === false ? 0 : 1);
  }
  for (const marker of scene.markers)
    writer.u32(1).string(marker.name).u32(0).u8(1).floats(marker.transform);
  return writer.finish();
}
