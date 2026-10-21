import type { SceneryImages } from '../../export/textures';
import conifer from './trees/conifer.json';
import leafy from './trees/leafy.json';

/** A model made in Blender: one indexed triangle mesh per material, z up, in metres. */
export interface SceneryModel {
  /** Height of its highest point above its foot. */
  height: number;
  parts: {
    material: string;
    positions: number[];
    normals: number[];
    uvs: number[];
    indices: number[];
  }[];
}

/** The trees, by variant (tools/blender, docs/adr/0014). */
export const TREE_MODELS: Record<'leafy' | 'conifer', SceneryModel> = { leafy, conifer };

const served = import.meta.glob<string>('./textures/*.png', {
  query: '?url',
  import: 'default',
  eager: true,
});

/** Where each scenery texture is served, by file name. */
export const SCENERY_TEXTURE_URLS: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(served).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1), url]),
);

let loading: Promise<SceneryImages> | null = null;

/** The bytes of every scenery texture, fetched once for the exports. */
export function loadSceneryImages(): Promise<SceneryImages> {
  loading ??= Promise.all(
    Object.entries(SCENERY_TEXTURE_URLS).map(async ([file, url]) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Could not load ${file}.`);
      return [file, new Uint8Array(await response.arrayBuffer())] as const;
    }),
  )
    .then(Object.fromEntries)
    .catch((error: unknown) => {
      // A failed fetch is tried again by the next export.
      loading = null;
      throw error;
    });
  return loading;
}
