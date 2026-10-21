import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { addBarrier, addScenery } from '../../src/core/project/edits';
import { parseProjectFile } from '../../src/core/project/schema';
import { buildArchive } from '../../src/export/archive';
import { crc32 } from '../../src/export/binary/crc32';
import { zipFiles } from '../../src/export/binary/zip';
import { ExportError } from '../../src/export/errors';
import { documentTexts } from '../../src/i18n';
import { onPoint, template, tightTurnProject } from '../helpers';

const texts = documentTexts('fr');

const failure = (run: () => unknown) => {
  try {
    run();
  } catch (error) {
    return error as ExportError;
  }
  throw new Error('expected an ExportError');
};

describe('Assetto Corsa archive', () => {
  it('lays out the track folder with a valid KN5', () => {
    const project = template('club');
    const archive = buildArchive(project, 'assetto', texts);
    const root = `content/tracks/rb_test_club/`;
    expect(archive.filename).toBe('rb_test_club_assetto.zip');
    expect(Object.keys(archive.files)).toEqual([
      `${root}rb_test_club.kn5`,
      `${root}models.ini`,
      `${root}data/surfaces.ini`,
      `${root}data/map.ini`,
      `${root}data/lighting.ini`,
      `${root}data/groove.ini`,
      `${root}map.png`,
      `${root}ui/outline.png`,
      `${root}ui/preview.png`,
      `${root}ui/ui_track.json`,
      'INSTALLATION.txt',
      'rb_test_club.roadbuilder.json',
    ]);
    const kn5 = archive.files[`${root}rb_test_club.kn5`] as Uint8Array;
    expect(new TextDecoder().decode(kn5.subarray(0, 6))).toBe('sc6969');
    expect(new DataView(kn5.buffer, kn5.byteOffset).getUint32(6, true)).toBe(5);
    expect(archive.files[`${root}models.ini`]).toBe(
      '[MODEL_0]\nFILE=rb_test_club.kn5\nPOSITION=0,0,0\nROTATION=0,0,0\n',
    );
    expect(archive.files[`${root}data/surfaces.ini`]).toContain(
      '[SURFACE_1]\nKEY=GRASS\nFRICTION=0.65\n',
    );
    const ui = JSON.parse(archive.files[`${root}ui/ui_track.json`] as string) as Record<
      string,
      unknown
    >;
    expect(ui).toMatchObject({
      name: 'Test club',
      run: 'counter-clockwise',
      tags: ['circuit', 'fictional', 'roadbuilder'],
    });
    expect(parseProjectFile(archive.files['rb_test_club.roadbuilder.json'] as string)).toEqual(
      project,
    );
  });

  it('lights the lamps at night through Custom Shaders Patch', () => {
    const root = `content/tracks/rb_test_club/`;
    const config = `${root}extension/ext_config.ini`;
    expect(buildArchive(template('club'), 'assetto', texts).files[config]).toBeUndefined();
    const lit = produce(template('club'), (draft) => {
      addScenery(draft, 'light', { x: -150, z: 0 });
    });
    const ini = buildArchive(lit, 'assetto', texts).files[config] as string;
    expect(ini).toContain('[CONDITION_0]\nNAME=ROADBUILDER_NIGHT\nINPUT=SUN');
    expect(ini).toContain('[MATERIAL_ADJUSTMENT_0]\nMATERIALS=lamp\nKEY_0=ksEmissive');
    expect(ini.match(/^\[LIGHT_\d+\]$/gm)).toEqual(['[LIGHT_0]']);
    expect(ini).toMatch(/POSITION=-150(\.\d+)?, [-\d.]+, [-\d.]+/);
  });

  it('includes barrier materials and documents them', () => {
    const project = produce(template('club'), (draft) => {
      addBarrier(draft, {
        type: 'tecpro',
        side: 'right',
        from: onPoint(draft.points[1]),
        to: onPoint(draft.points[3]),
      });
    });
    const archive = buildArchive(project, 'assetto', texts);
    const kn5 = Object.entries(archive.files).find(([path]) =>
      path.endsWith('.kn5'),
    )![1] as Uint8Array;
    // Base surfaces (asphalt, grass, kerb red, paint, pit), the pit wall's concrete and the two TecPro colours.
    expect(new DataView(kn5.buffer, kn5.byteOffset).getUint32(10, true)).toBe(8);
    expect(archive.files['INSTALLATION.txt']).toContain('Barrières : 1 tronçon avec collision');
  });
});

describe('OBJ sources', () => {
  it('writes the scene, its materials and their textures', () => {
    const project = produce(template('club'), (draft) => {
      addBarrier(draft, {
        type: 'wall',
        side: 'left',
        from: onPoint(draft.points[7]),
        to: onPoint(draft.points[2]),
      });
    });
    const archive = buildArchive(project, 'obj', texts);
    expect(archive.filename).toBe('rb_test_club_obj.zip');
    expect(archive.files['track.obj']).toContain('mtllib track.mtl');
    expect(archive.files['track.obj']).toContain('o 1GRASS_terrain_0');
    expect(archive.files['track.obj']).toContain('usemtl concrete');
    expect(archive.files['track.mtl']).toContain('map_Kd texture/kerb_red.png');
    expect(archive.files['texture/concrete.png']).toBeInstanceOf(Uint8Array);
    expect(archive.files['README.txt']).toContain('1WALL');
  });
});

describe('export checks', () => {
  it('refuses a track with blocking issues', () => {
    const issues = failure(() => buildArchive(tightTurnProject(), 'assetto', texts));
    expect(issues).toBeInstanceOf(ExportError);
    expect(issues.detail.code).toBe('invalid-track');
    expect(failure(() => buildArchive(template('blank'), 'obj', texts)).detail.code).toBe(
      'invalid-track',
    );
  });
});

describe('ZIP', () => {
  it('stores files with their CRC and rejects unsafe paths', () => {
    const bytes = zipFiles({ 'été.txt': 'bonjour' });
    const view = new DataView(bytes.buffer);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    expect(view.getUint32(14, true)).toBe(crc32(new TextEncoder().encode('bonjour')));
    expect(view.getUint32(bytes.length - 22, true)).toBe(0x06054b50);
    expect(() => zipFiles({ '../track.kn5': 'x' })).toThrow('Invalid ZIP path');
  });
});
