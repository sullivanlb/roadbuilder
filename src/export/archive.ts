import { slugify } from '../core/project/factory';
import { parseProject, serializeProject } from '../core/project/schema';
import type { Project } from '../core/project/schema';
import { buildScene, findFoldedSurface } from '../core/scene/scene';
import { sampleTrack, trackStats } from '../core/track/centerline';
import { trackIssues } from '../core/track/issues';
import { grooveIni, lightingIni, modelsIni, surfacesIni, uiTrackJson } from './assetto/files';
import { encodeKn5 } from './assetto/kn5';
import { makeMap } from './assetto/map';
import { zipFiles } from './binary/zip';
import type { ArchiveFiles } from './binary/zip';
import type { DocumentTexts } from './documents';
import { ExportError } from './errors';
import { encodeObj } from './obj/obj';
import { texture, textureFile, usedMaterials } from './textures';

export const EXPORT_FORMATS = ['assetto', 'obj'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export interface Archive {
  filename: string;
  files: ArchiveFiles;
  bytes: Uint8Array;
}

/**
 * Checks the project and packs the archive of one export format. Throws an
 * ExportError when the track has blocking issues or a surface folds over itself.
 */
export function buildArchive(input: Project, format: ExportFormat, texts: DocumentTexts): Archive {
  const project = parseProject(input);
  const samples = sampleTrack(project),
    issues = trackIssues(project, samples);
  if (issues.errors.length) throw new ExportError({ code: 'invalid-track', issues });
  const scene = buildScene(project, samples);
  if (findFoldedSurface(scene)) throw new ExportError({ code: 'folded-surface' });
  const slug = slugify(project.name),
    projectFile = `${slug}.roadbuilder.json`;
  const files: ArchiveFiles = {};
  if (format === 'obj') {
    const { obj, mtl } = encodeObj(scene, texts.objHeader);
    files['track.obj'] = obj;
    files['track.mtl'] = mtl;
    files['markers.json'] = JSON.stringify(scene.markers, null, 2);
    for (const material of usedMaterials(scene))
      files[`texture/${textureFile(material)}`] = texture(material);
    files['README.txt'] = texts.objReadme(project.barriers.length);
  } else {
    const root = `content/tracks/${slug}/`;
    const map = makeMap(project, samples),
      preview = makeMap(project, samples, true);
    files[`${root}${slug}.kn5`] = encodeKn5(scene);
    files[`${root}models.ini`] = modelsIni(`${slug}.kn5`);
    files[`${root}data/surfaces.ini`] = surfacesIni();
    files[`${root}data/map.ini`] = map.ini;
    files[`${root}data/lighting.ini`] = lightingIni();
    files[`${root}data/groove.ini`] = grooveIni();
    files[`${root}map.png`] = map.png;
    files[`${root}ui/outline.png`] = map.png;
    files[`${root}ui/preview.png`] = preview.png;
    files[`${root}ui/ui_track.json`] = uiTrackJson(project, samples, trackStats(samples), texts);
    files['INSTALLATION.txt'] = texts.installation({
      name: project.name,
      slug,
      projectFile,
      terrainMargin: project.terrain.margin,
      barrierCount: project.barriers.length,
      pitBoxes: project.pitLane ? project.cars : null,
      warnings: issues.warnings,
    });
  }
  files[projectFile] = serializeProject(project);
  return {
    filename: `${slug}${format === 'obj' ? '_obj' : '_assetto'}.zip`,
    files,
    bytes: zipFiles(files),
  };
}
