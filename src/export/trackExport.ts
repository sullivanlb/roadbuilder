import type { ExportFiles, ExportFormat, Project } from '../domain/types';
import { ExportError } from '../domain/diagnostics';
import type { Locale } from '../i18n/catalogues';
import { slugify } from '../domain/project/factory';
import { validateProject } from '../domain/project/validation';
import { sampleTrack, trackStats, trackIssues } from '../domain/track/geometry';
import { buildScene } from '../domain/track/scene';
import { MATERIALS } from '../domain/track/mesh';
import { texturePng } from './binary/png';
import { zipFiles } from './binary/zip';
import { installationText, objReadme, surfacesIni, uiTrackJson } from './documents';
import { encodeKn5 } from './kn5';
import { makeMap } from './map';
import { usedMaterialIndexes } from './materials';
import { encodeObj } from './obj';

/** Validates the project and builds the complete archive for one export format. */
export function buildExport(project: Project, format: ExportFormat = 'ac', locale: Locale = 'fr') {
  project = validateProject(project);
  const samples = sampleTrack(project),
    issues = trackIssues(project, samples);
  if (issues.errors.length) throw new ExportError({ code: 'invalid-track' }, issues);
  const scene = buildScene(project, samples),
    stats = trackStats(samples),
    slug = slugify(project.name),
    barrierCount = project.barriers?.length ?? 0;
  for (const mesh of scene.meshes) {
    // Vertical barrier faces have no ground area: excluded from the check.
    if (mesh.barrier) continue;
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const [a, b, c] = mesh.indices.slice(i, i + 3).map((index) => mesh.vertices[index].position);
      const areaY = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
      if (areaY <= 1e-9) throw new ExportError({ code: 'folded-edge' });
    }
  }
  const files: ExportFiles = {};
  if (format === 'obj') {
    const { obj, mtl } = encodeObj(scene);
    files['track.obj'] = obj;
    files['track.mtl'] = mtl;
    files['markers.json'] = JSON.stringify(scene.markers, null, 2);
    for (const index of usedMaterialIndexes(scene))
      files[`texture/${MATERIALS[index].texture}`] = texturePng(MATERIALS[index].color);
    files['LIRE-MOI.txt'] = objReadme(barrierCount, locale);
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
    files[`${root}ui/ui_track.json`] = uiTrackJson(project, samples, stats, locale);
    files['INSTALLATION.txt'] = installationText({
      project,
      slug,
      barrierCount,
      warnings: issues.warnings,
      locale,
    });
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
