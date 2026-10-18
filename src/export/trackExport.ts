import type { Project, Scene, Sample, ExportFiles, ExportFormat } from '../domain/types';
import { validateProject, slugify } from '../domain/project';
import { sampleTrack, trackStats, trackIssues, bounds } from '../domain/geometry';
import { buildScene } from '../domain/scene';
import { MATERIALS } from '../domain/mesh';
import { BinaryWriter, zipFiles, texturePng, encodePng, utf8 } from './binary';
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

// KN5 v5 field layout independently implemented from the public AcTools format.
// Reference: github.com/gro-ove/actools/blob/master/AcTools/Kn5File/Kn5Writer.cs
function encodeKn5(scene: Scene) {
  const writer = new BinaryWriter(1024 * 1024);
  writer.raw(utf8('sc6969')).u32(5).u32(MATERIALS.length);
  for (const material of MATERIALS) {
    const texture = texturePng(material.color, material.name === 'grass' ? 25 : 12);
    writer.u32(1).string(material.texture).u32(texture.length).raw(texture);
  }
  writer.u32(MATERIALS.length);
  for (const material of MATERIALS) {
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
      writer.string(name).f32(value).floats(Array(9).fill(0));
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
    writer.u32(mesh.material).u32(0).f32(0).f32(100000).floats(center).f32(radius).u8(1);
  }
  for (const marker of scene.markers)
    writer.u32(1).string(marker.name).u32(0).u8(1).floats(marker.transform);
  return writer.finish();
}

function encodeObj(scene: Scene) {
  const lines = ['# Roadbuilder — mètres, Y vertical, avant -Z', 'mtllib track.mtl'];
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
  const mtl = MATERIALS.map(
    (m) =>
      `newmtl ${m.name}\nKa 0.35 0.35 0.35\nKd 1 1 1\nKs 0.05 0.05 0.05\nmap_Kd texture/${m.texture}\n`,
  ).join('\n');
  return { obj: lines.join('\n') + '\n', mtl };
}

function surfacesIni() {
  return [
    ['ROAD', 1, 1, 0],
    ['GRASS', 0.65, 0, 0],
    ['KERB', 0.95, 1, 0],
    ['PIT', 1, 1, 1],
  ]
    .map(
      ([key, friction, valid, pit], i) =>
        `[SURFACE_${i}]\nKEY=${key}\nFRICTION=${friction}\nDAMPING=0\nWAV=\nWAV_PITCH=0\nFF_EFFECT=NULL\nDIRT_ADDITIVE=${key === 'GRASS' ? 1 : 0}\nIS_VALID_TRACK=${valid}\nBLACK_FLAG_TIME=0\nSIN_HEIGHT=0\nSIN_LENGTH=0\nIS_PITLANE=${pit}\nVIBRATION_GAIN=${key === 'KERB' ? 0.1 : 0}\nVIBRATION_LENGTH=${key === 'KERB' ? 0.2 : 0}\n`,
    )
    .join('\n');
}

function makeMap(project: Project, samples: Sample[], preview = false) {
  const width = 512,
    height = 512,
    pixels = new Uint8Array(width * height * 4);
  if (preview) for (let i = 0; i < pixels.length; i += 4) pixels.set([26, 40, 35, 255], i);
  const bb = bounds(samples, project.width + 15);
  const scale = Math.min(
    (width - 60) / Math.max(1, bb.maxX - bb.minX),
    (height - 60) / Math.max(1, bb.maxZ - bb.minZ),
  );
  const xOffset = (width / scale - (bb.maxX + bb.minX)) / 2;
  const zOffset = (height / scale - (bb.maxZ + bb.minZ)) / 2;
  const dot = (x: number, y: number, radius: number, color: number[]) => {
    for (
      let py = Math.max(0, Math.floor(y - radius));
      py <= Math.min(height - 1, Math.ceil(y + radius));
      py++
    ) {
      for (
        let px = Math.max(0, Math.floor(x - radius));
        px <= Math.min(width - 1, Math.ceil(x + radius));
        px++
      ) {
        if ((px - x) ** 2 + (py - y) ** 2 <= radius ** 2) pixels.set(color, (py * width + px) * 4);
      }
    }
  };
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1],
      b = samples[i];
    const count = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) * scale));
    for (let j = 0; j <= count; j++) {
      const t = j / count;
      dot(
        (a.x + (b.x - a.x) * t + xOffset) * scale,
        (a.z + (b.z - a.z) * t + zOffset) * scale,
        Math.max(2, (project.width * scale) / 2),
        preview ? [210, 233, 142, 255] : [255, 255, 255, 255],
      );
    }
  }
  if (preview && samples.length)
    dot(
      (samples[0].x + xOffset) * scale,
      (samples[0].z + zOffset) * scale,
      5,
      [255, 255, 255, 255],
    );
  return {
    png: encodePng(width, height, pixels),
    ini: `[PARAMETERS]\nWIDTH=${width}\nHEIGHT=${height}\nMARGIN=0\nSCALE_FACTOR=${1 / scale}\nX_OFFSET=${xOffset}\nZ_OFFSET=${zOffset}\nDRAWING_SIZE=10\n`,
  };
}

function buildExport(project: Project, format: ExportFormat = 'ac') {
  project = validateProject(project);
  const samples = sampleTrack(project),
    issues = trackIssues(project, samples);
  if (issues.errors.length) throw new Error(issues.errors.join('\n'));
  const scene = buildScene(project, samples),
    stats = trackStats(samples),
    slug = slugify(project.name);
  for (const mesh of scene.meshes) {
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const [a, b, c] = mesh.indices.slice(i, i + 3).map((index) => mesh.vertices[index].position);
      const areaY = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
      if (areaY <= 1e-9)
        throw new Error(
          'Un bord de route ou de stand se replie dans un virage. Écartez les points, réduisez la largeur ou déplacez le début du tracé vers une ligne droite.',
        );
    }
  }
  const files: ExportFiles = {};
  if (format === 'obj') {
    const { obj, mtl } = encodeObj(scene);
    files['track.obj'] = obj;
    files['track.mtl'] = mtl;
    files['markers.json'] = JSON.stringify(scene.markers, null, 2);
    for (const material of MATERIALS)
      files[`texture/${material.texture}`] = texturePng(material.color);
    files['LIRE-MOI.txt'] =
      'Roadbuilder — sources 3D\n\nImportez track.obj dans Blender (axe vertical Y, avant -Z, échelle 1 m).\nLes textures se trouvent dans texture/. Les transformations des repères Assetto Corsa sont dans markers.json (matrices 4×4, translation sur la dernière ligne).\nOBJ ne conserve pas les repères AC : recréez-les si vous passez par Blender/ksEditor.\nPour un export KN5 direct, utilisez Exporter > Assetto Corsa dans Roadbuilder.\n';
  } else {
    const root = `content/tracks/${slug}/`;
    const map = makeMap(project, samples),
      preview = makeMap(project, samples, true);
    files[`${root}${slug}.kn5`] = encodeKn5(scene);
    files[`${root}models.ini`] = `[MODEL_0]\nFILE=${slug}.kn5\nPOSITION=0,0,0\nROTATION=0,0,0\n`;
    files[`${root}data/surfaces.ini`] = surfacesIni();
    files[`${root}data/map.ini`] = map.ini;
    files[`${root}data/lighting.ini`] = '[LIGHTING]\nSUN_PITCH_ANGLE=45\nSUN_HEADING_ANGLE=30\n';
    files[`${root}data/groove.ini`] = '[GROOVE]\nVIRTUAL_LAPS=1\nMAX_LAPS=30\nSTARTING_LAPS=0\n';
    files[`${root}map.png`] = map.png;
    files[`${root}ui/outline.png`] = map.png;
    files[`${root}ui/preview.png`] = preview.png;
    files[`${root}ui/ui_track.json`] = JSON.stringify(
      {
        name: project.name,
        description: `Créé avec Roadbuilder. ${project.closed ? 'Circuit fermé' : 'Route ouverte'}. Prototype pour essais libres en solo.`,
        tags: [project.closed ? 'circuit' : 'hillclimb', 'fictional', 'roadbuilder'],
        country: 'France',
        city: '',
        length: `${Math.round(stats.length)} m`,
        width: `${project.width} m`,
        pitboxes: '1',
        run: project.closed
          ? samples.reduce(
              (sum, p, i) => (i ? sum + samples[i - 1].x * p.z - p.x * samples[i - 1].z : sum),
              0,
            ) > 0
            ? 'clockwise'
            : 'counter-clockwise'
          : 'point-to-point',
        author: project.author || 'Roadbuilder',
        version: '0.1',
        url: '',
        year: 2026,
      },
      null,
      2,
    );
    files['INSTALLATION.txt'] =
      `ROADBUILDER — ${project.name}\n\nEXPORT KN5 EXPÉRIMENTAL, À VÉRIFIER EN JEU\n\n1. Décompressez cette archive dans un dossier temporaire.\n2. Copiez content/tracks/${slug} dans assettocorsa/content/tracks/.\n   Si ce nom existe déjà, conservez une copie de votre ancienne version avant de la remplacer.\n3. Dans Content Manager ou Assetto Corsa, sélectionnez ${project.name}.\n4. Lancez des ESSAIS LIBRES, avec une seule voiture et sans adversaires.\n\nINCLUS\nChaussée avec collisions, accotements, vibreurs optionnels, textures intégrées au KN5,\nrepères de départ/stand et chronométrage, surfaces, plan et aperçu.\nTerrain en herbe avec collisions, à l’intérieur et autour du tracé, raccordé à son relief.\nMarge extérieure du terrain : ${project.terrainMargin} m au-delà des limites des accotements.\nLe point 1 définit le début du tracé ; la ligne de départ est placée après le stand.\n\nLIMITES DE CETTE VERSION\nLa compatibilité en jeu n’a pas été vérifiée automatiquement.\nUn emplacement de stand seulement, sans véritable voie des stands.\nPas de trajectoires IA : les courses contre l’IA ne sont pas prises en charge.\nRoutes ouvertes : essais libres uniquement ; chronométrage point-à-point non validé.\nLe terrain s’arrête au rectangle en pointillés visible dans l’éditeur.\nAu-delà de ce bord extérieur, une chute reste possible. Augmentez la marge si nécessaire.\nPas de barrières, de ponts ou de décor ; le relief du terrain est interpolé automatiquement.\nLes chevauchements de bords de route/accotements ne sont pas tous détectés.\nPour un circuit destiné à la compétition, vérifiez et complétez le modèle dans un outil 3D.\n\nLe fichier projet.roadbuilder.json permet de reprendre le travail dans l’éditeur.\n${issues.warnings.length ? '\nAVERTISSEMENTS\n' + issues.warnings.join('\n') : ''}\n`;
  }
  files['projet.roadbuilder.json'] = JSON.stringify(project, null, 2);
  return {
    files,
    bytes: zipFiles(files),
    filename: `${slug}${format === 'obj' ? '_sources' : '_assetto'}.zip`,
    scene,
    stats,
    issues,
  };
}
export { encodeKn5, encodeObj, makeMap, buildExport };
