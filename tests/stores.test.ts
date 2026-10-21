import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { setRoad, updatePoint } from '../src/core/project/edits';
import { parseProjectFile, serializeProject } from '../src/core/project/schema';
import { headingVector } from '../src/core/project/scenery';
import { pitLaneLayout } from '../src/core/track/pitLane';
import { positionDistance } from '../src/core/track/positions';
import { pickInLayer } from '../src/editor/layers';
import { previewClick, previewHover } from '../src/editor/previewInput';
import { trackHitNear } from '../src/rendering/plan/hitTest';
import { sampleAt } from '../src/core/track/centerline';
import type { LayerId, TrackHit } from '../src/editor/layers';
import { useEditorStore } from '../src/stores/editor';
import { useExportStore } from '../src/stores/export';
import { AUTOSAVE_KEY, useFilesStore } from '../src/stores/files';
import { useProjectStore } from '../src/stores/project';
import { useUiStore } from '../src/stores/ui';
import { memoryStorage, storeContext, template, testPlatform, tightTurnProject } from './helpers';
import type { MemoryStorage, TestPlatform } from './helpers';

let storage: MemoryStorage;
let platform: TestPlatform;

function stores() {
  const context = storeContext(platform);
  return context.run(() => ({
    files: useFilesStore(),
    project: useProjectStore(),
    editor: useEditorStore(),
    ui: useUiStore(),
    exporter: useExportStore(),
  }));
}

beforeEach(() => {
  vi.useFakeTimers();
  storage = memoryStorage();
  platform = testPlatform(storage);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('project history', () => {
  it('groups a continuous edit into one undo step and ignores no-op commits', () => {
    const { project } = stores();
    const before = project.project;
    project.edit((draft) => setRoad(draft, { width: 10 }), { commit: false });
    project.edit((draft) => setRoad(draft, { width: 14 }), { commit: false });
    project.commit();
    project.commit();
    expect(project.canUndo).toBe(true);
    project.undo();
    expect(project.project).toBe(before);
    expect(project.canUndo).toBe(false);
    project.redo();
    expect(project.project.road.width).toBe(14);
  });

  it('commits pending changes before undoing them', () => {
    const { project } = stores();
    const before = project.project;
    project.edit((draft) => setRoad(draft, { shoulder: 3 }), { commit: false });
    project.undo();
    expect(project.project).toBe(before);
  });

  it('makes a new project undoable but starts a loaded one with no history', () => {
    const { project } = stores();
    const first = project.project;
    project.replace(template('kart'));
    project.undo();
    expect(project.project).toBe(first);
    project.load(template('mountain'));
    expect(project.canUndo).toBe(false);
    expect(project.canRedo).toBe(false);
  });
});

describe('editor', () => {
  it('adds a point after the selection and refuses one too close', () => {
    const { project, editor, ui } = stores();
    editor.selectPointAt(0);
    editor.addPoint({ x: 0, z: 0 });
    expect(editor.selectedIndex).toBe(1);
    expect(project.project.points).toHaveLength(10);
    const first = project.project.points[0];
    editor.addPoint({ x: first.x + 0.5, z: first.z });
    expect(ui.notification?.error).toBe(true);
    expect(project.project.points).toHaveLength(10);
  });

  it('selects the next point after a deletion and drops a selection that undo removed', async () => {
    const { project, editor } = stores();
    editor.selectPointAt(3);
    const next = project.project.points[4].id;
    editor.deleteSelectedPoint();
    expect(editor.selectedPointId).toBe(next);
    editor.selectPointAt(0);
    editor.addPoint({ x: 0, z: 0 });
    project.undo();
    await nextTick();
    expect(editor.selectedPointId).toBeNull();
  });

  it('lays a barrier in two clicks anywhere on the track, refusing one too short', () => {
    const { project, editor, ui } = stores();
    editor.setTool('barrier');
    editor.beginBarrier({ s: 240, side: 'right' });
    editor.completeBarrier(242);
    expect(ui.notification?.error).toBe(true);
    editor.completeBarrier(100);
    expect(project.project.barriers).toEqual([
      expect.objectContaining({ type: 'guardrail', side: 'right', offset: 1 }),
    ]);
    const [laid] = project.project.barriers;
    const distance = (position: typeof laid.from) =>
      positionDistance(project.project, project.samples, position);
    expect(distance(laid.from)).toBeCloseTo(100, 6);
    expect(distance(laid.to)).toBeCloseTo(240, 6);
    expect(editor.selectedBarrier?.id).toBe(project.project.barriers[0].id);
    expect(editor.barrierDraft).toBeNull();
    editor.setBarrierType('wall');
    editor.swapSelectedBarrierSide();
    expect(project.project.barriers[0]).toMatchObject({ type: 'wall', side: 'left' });
    editor.deleteSelectedBarrier();
    expect(project.project.barriers).toEqual([]);
    project.undo();
    expect(project.project.barriers).toHaveLength(1);
  });

  it('lays a pit lane in two clicks on a circuit, never on a road', () => {
    const { project, editor, ui } = stores();
    project.replace(template('kart'));
    editor.setTool('pits');
    editor.beginPitLane({ s: 20, side: 'left' });
    editor.completePitLane(30);
    expect(ui.notification?.error).toBe(true);
    editor.completePitLane(220);
    expect(project.project.pitLane).toMatchObject({ side: 'left', width: 7 });
    expect(editor.tool).toBe('select');
    project.replace(template('mountain'));
    editor.beginPitLane({ s: 20, side: 'left' });
    expect(editor.pitDraft).toBeNull();
    expect(ui.notification?.message).toContain('circuits');
  });

  it('lays a width zone in two clicks, refusing one too short or overlapping', () => {
    const { project, editor, ui } = stores();
    project.replace(template('club'));
    editor.setTool('width');
    editor.beginWidthZone(300);
    editor.completeWidthZone(302);
    expect(ui.notification?.error).toBe(true);
    editor.completeWidthZone(120);
    expect(project.project.widthZones).toEqual([expect.objectContaining({ width: 16 })]);
    expect(editor.selectedWidthZone?.id).toBe(project.project.widthZones[0].id);
    expect(editor.widthDraft).toBeNull();
    expect(project.samples.find((sample) => sample.s > 210)!.half).toBeCloseTo(8, 6);
    editor.beginWidthZone(200);
    editor.completeWidthZone(400);
    expect(ui.notification?.message).toContain('chevauche');
    expect(project.project.widthZones).toHaveLength(1);
    editor.setTool('select');
    expect(editor.widthDraft).toBeNull();
    editor.deleteSelectedWidthZone();
    expect(project.project.widthZones).toEqual([]);
    project.undo();
    expect(project.project.widthZones).toHaveLength(1);
  });

  it('picks only what belongs to the active layer', () => {
    const { project, editor } = stores();
    project.replace(template('club'));
    editor.beginWidthZone(100);
    editor.completeWidthZone(300);
    editor.beginBarrier({ s: 100, side: 'left' });
    editor.completeBarrier(300);
    const [zone] = project.project.widthZones;
    const [barrier] = project.project.barriers;
    const lane = pitLaneLayout(project.project, project.samples)!;
    // One click that lands on a point, a barrier and a width zone at once.
    const hit: TrackHit = {
      ground: { x: 0, z: 0 },
      road: { s: 200, side: 'left' },
      pointId: project.project.points[1].id,
      barrierId: barrier.id,
      sceneryId: 'tree',
    };
    const pick = (layer: LayerId, at = hit) =>
      pickInLayer(layer, at, project.project, project.samples);
    expect(pick('track')).toEqual({ kind: 'points', ids: [project.project.points[1].id] });
    expect(pick('road')).toEqual({ kind: 'widthZone', id: zone.id });
    expect(pick('edges')).toEqual({ kind: 'barrier', id: barrier.id });
    expect(pick('pits')).toBeNull();
    const onLane = { ...hit, road: { s: lane.entry + lane.length / 2, side: lane.side } };
    expect(pick('pits', onLane)).toEqual({ kind: 'pitLane' });
    expect(pick('terrain')).toBeNull();
    expect(pick('scenery')).toEqual({ kind: 'scenery', ids: ['tree'] });
  });

  it('places scenery facing the track, then turns, copies and deletes the selection', async () => {
    const { project, editor, ui } = stores();
    project.replace(template('club'));
    editor.setTool('grandstand');
    expect(editor.layer).toBe('scenery');
    // Beside the main straight, which passes x = -100 at z = 203.
    editor.placeScenery('grandstand', { x: -100, z: 230 });
    const [stand] = project.project.scenery;
    expect(stand).toMatchObject({ kind: 'grandstand', solid: true });
    // It faces the straight, north of it on the plan.
    expect(headingVector(stand.heading).z).toBeLessThan(-0.95);
    expect(editor.selection).toEqual({ kind: 'scenery', ids: [stand.id] });
    editor.placeScenery('tree', { x: -100, z: 100 });
    const tree = project.project.scenery[1];
    expect(headingVector(tree.heading).z).toBeGreaterThan(0.95);
    editor.select({ kind: 'scenery', ids: [stand.id, tree.id] });
    editor.turnSelectedScenery(-15);
    expect(project.project.scenery.map((item) => item.heading)).toEqual([
      (stand.heading + 345) % 360,
      tree.heading - 15,
    ]);
    editor.duplicateSelectedScenery();
    expect(project.project.scenery).toHaveLength(4);
    expect(editor.selectedSceneryIds).toEqual(project.project.scenery.slice(2).map((i) => i.id));
    editor.deleteSelection();
    expect(project.project.scenery).toHaveLength(2);
    expect(editor.selection).toBeNull();
    // Undo brings the copies back but not their selection; redo drops it again.
    editor.selectScenery(stand.id);
    editor.deleteSelectedScenery();
    project.undo();
    await nextTick();
    expect(project.project.scenery).toHaveLength(2);
    editor.selectScenery(stand.id);
    project.undo();
    project.undo();
    await nextTick();
    expect(editor.selectedSceneryIds).toEqual([stand.id]);
    expect(ui.notification).toBeNull();
  });

  it('places scenery from the 3D preview and picks it there', () => {
    const { project, editor, ui } = stores();
    project.replace(template('club'));
    editor.setTool('light');
    const ground = { x: -100, y: 0, z: 230 };
    previewClick(
      { project, editor, ui },
      trackHitNear(project.project, project.samples, ground),
      false,
    );
    const [light] = project.project.scenery;
    expect(light).toMatchObject({ kind: 'light', x: -100, z: 230 });
    editor.setTool('select');
    editor.select(null);
    previewClick(
      { project, editor, ui },
      trackHitNear(project.project, project.samples, ground),
      false,
    );
    expect(editor.selection).toEqual({ kind: 'scenery', ids: [light.id] });
  });

  it('moves to the layer of a tool or a selection, and keeps each layer’s selection', () => {
    const { project, editor } = stores();
    project.replace(template('club'));
    editor.reset();
    expect(editor.layer).toBe('track');
    expect(editor.selectedPointId).toBe(project.project.points[0].id);
    editor.setTool('barrier');
    expect(editor.layer).toBe('edges');
    expect(editor.selection).toBeNull();
    editor.setTool('select');
    expect(editor.layer).toBe('edges');
    editor.selectPoint(project.project.points[2].id);
    expect(editor.layer).toBe('track');
    editor.setLayer('road');
    expect(editor.tool).toBe('select');
    expect(editor.selection).toBeNull();
    editor.setLayer('track');
    expect(editor.selectedPointId).toBe(project.project.points[2].id);
    editor.toggleLayer('edges');
    expect(editor.hiddenLayers).toEqual(['edges']);
    editor.toggleLayer('edges');
    expect(editor.hiddenLayers).toEqual([]);
  });

  it('lays a width zone, barriers or the pit lane on a stretch picked in the band', () => {
    const { project, editor } = stores();
    project.replace(template('club'));
    editor.reset();
    editor.setRange({ start: 50, length: 600 });
    editor.selectPointsInRange();
    expect(editor.selectedPoints?.ids.length).toBeGreaterThan(0);
    expect(editor.range).toBeNull();

    editor.setLayer('road');
    editor.setRange({ start: 100, length: 150 });
    editor.widthZoneOnRange();
    expect(project.project.widthZones).toHaveLength(1);
    expect(editor.selection).toEqual({ kind: 'widthZone', id: project.project.widthZones[0].id });
    expect(editor.range).toBeNull();
    // The same stretch again overlaps: refused, and the stretch stays.
    editor.setRange({ start: 120, length: 50 });
    editor.widthZoneOnRange();
    expect(project.project.widthZones).toHaveLength(1);
    expect(editor.range).not.toBeNull();

    editor.setLayer('edges');
    editor.barriersOnRange(['left', 'right']);
    expect(project.project.barriers.map((barrier) => barrier.side)).toEqual(['left', 'right']);

    editor.setLayer('pits');
    editor.setRange({ start: 300, length: 200 });
    editor.pitLaneOnRange();
    const lane = pitLaneLayout(project.project, project.samples)!;
    expect(lane.entry).toBeCloseTo(300, 6);
    expect(lane.length).toBeCloseTo(200, 6);
  });

  it('keeps the 3D view whatever the tool, and acts on clicks made in it', () => {
    const { project, editor, ui } = stores();
    project.replace(template('club'));
    editor.reset();
    editor.setView('3d');
    editor.setTool('barrier');
    expect(editor.view).toBe('3d');
    const context = { project, editor, ui };
    const at = (s: number, side: 1 | -1 = -1) => {
      const sample = sampleAt(project.samples, s)!;
      const lateral = side * (sample.half + 1);
      return trackHitNear(project.project, project.samples, {
        x: sample.x + sample.nx * lateral,
        z: sample.z + sample.nz * lateral,
      });
    };
    // Two clicks on the left of the road lay a barrier there.
    previewHover(context, at(100));
    expect(editor.hoverS).toBeCloseTo(100, -1);
    previewClick(context, at(100), false);
    previewHover(context, at(260));
    expect(editor.barrierTarget).toBeCloseTo(260, -1);
    previewClick(context, at(260), false);
    expect(project.project.barriers).toEqual([expect.objectContaining({ side: 'left' })]);
    // Selecting picks in the active layer: the barrier now, a point on the track layer.
    editor.setTool('select');
    previewClick(context, at(180), false);
    expect(editor.selection).toEqual({ kind: 'barrier', id: project.project.barriers[0].id });
    editor.setLayer('track');
    const point = project.project.points[2];
    previewClick(context, trackHitNear(project.project, project.samples, point), false);
    expect(editor.selectedPointId).toBe(point.id);
  });
});

describe('automatic save', () => {
  it('restores the last save and writes changes after a short delay', async () => {
    storage.write(AUTOSAVE_KEY, serializeProject(template('kart')));
    const { files, project, editor } = stores();
    expect(project.project.name).toBe('Test kart');
    expect(editor.selectedIndex).toBe(0);
    project.edit((draft) => setRoad(draft, { width: 9 }));
    await vi.advanceTimersByTimeAsync(0);
    expect(files.saveState).toBe('pending');
    await vi.advanceTimersByTimeAsync(350);
    expect(files.saveState).toBe('saved');
    expect(JSON.parse(storage.read(AUTOSAVE_KEY)!)).toMatchObject({ road: { width: 9 } });
  });

  it('sets an unreadable save aside before anything overwrites it', async () => {
    storage.write(AUTOSAVE_KEY, '{broken');
    const { files, project } = stores();
    expect(files.restoreFailed).toBe(true);
    expect(
      [...storage.values].some(
        ([key, value]) => key.startsWith(`${AUTOSAVE_KEY}.recovery.`) && value === '{broken',
      ),
    ).toBe(true);
    project.edit((draft) => setRoad(draft, { width: 9 }));
    await vi.advanceTimersByTimeAsync(400);
    expect(files.saveState).toBe('saved');
  });

  it('never overwrites an unreadable save it could not set aside', async () => {
    platform = testPlatform({
      read: () => '{broken',
      write: () => {
        throw new Error('quota');
      },
    });
    const { files, project } = stores();
    expect(files.saveState).toBe('recovery');
    project.edit((draft) => setRoad(draft, { width: 9 }));
    await vi.advanceTimersByTimeAsync(400);
    files.flush();
    expect(files.saveState).toBe('recovery');
  });

  it('reports a device without storage', () => {
    platform = testPlatform(null);
    expect(stores().files.saveState).toBe('unavailable');
  });
});

describe('project files', () => {
  it('opens a project file and reports invalid ones without touching the current project', async () => {
    const { files, project, ui } = stores();
    platform.offer(serializeProject(template('mountain')));
    await files.openProject();
    expect(project.project.name).toBe('Test mountain');
    platform.offer('{nope');
    await files.openProject();
    expect(ui.notification).toEqual({
      message: expect.stringContaining('JSON') as string,
      error: true,
    });
    platform.offer({ name: 'big.json', size: 2 * 1024 * 1024, text: () => Promise.resolve('{}') });
    await files.openProject();
    expect(ui.notification?.message).toContain('1 Mo');
    expect(project.project.name).toBe('Test mountain');
  });

  it('drops a slow file read once another project replaced the document', async () => {
    const { files, project } = stores();
    let resolve!: (text: string) => void;
    platform.offer({
      name: 'slow.json',
      size: 10,
      text: () => new Promise((done) => (resolve = done)),
    });
    const opening = files.openProject();
    await vi.advanceTimersByTimeAsync(0);
    files.newProject('blank');
    resolve(serializeProject(template('kart')));
    await opening;
    expect(project.project.points).toEqual([]);
  });

  it('saves the project as a file named after it', async () => {
    const { files, project } = stores();
    project.edit((draft) => updatePoint(draft, draft.points[0].id, { y: 42 }));
    await files.saveProject();
    expect(platform.saved[0]).toMatchObject({
      name: 'rb_circuit_des_collines.roadbuilder.json',
      type: 'application/json',
    });
    expect(parseProjectFile(platform.saved[0].data as string).points[0].y).toBe(42);
  });
});

describe('export', () => {
  it('records the author and hands over the archive', async () => {
    const { exporter, project, ui } = stores();
    exporter.open();
    expect(ui.dialog).toBe('export');
    exporter.author = '  Pilote ';
    exporter.format = 'obj';
    const running = exporter.run();
    await vi.advanceTimersByTimeAsync(50);
    await running;
    expect(project.project.author).toBe('Pilote');
    expect(platform.saved.at(-1)).toMatchObject({
      name: 'rb_circuit_des_collines_obj.zip',
      type: 'application/zip',
    });
    expect(ui.dialog).toBeNull();
  });

  it('does nothing while the track has blocking issues', async () => {
    const { exporter, project } = stores();
    project.replace(tightTurnProject());
    await exporter.run();
    expect(platform.saved).toEqual([]);
  });
});
