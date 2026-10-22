// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils';
import type { VueWrapper } from '@vue/test-utils';
import { createPinia } from 'pinia';
import type { Pinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App.vue';
import type { PlanPoint } from '../src/core/math';
import { serializeProject } from '../src/core/project/schema';
import { barrierPath } from '../src/core/scene/barriers';
import { controlPointSample, sampleAt, trackLength } from '../src/core/track/centerline';
import { widthZoneRanges } from '../src/core/track/width';
import { bandRows, bandX } from '../src/rendering/band';
import { pointDistance, positionDistance } from '../src/core/track/positions';
import { i18n, setLocale } from '../src/i18n';
import { installPlatform } from '../src/platform/platform';
import { useEditorStore } from '../src/stores/editor';
import { AUTOSAVE_KEY } from '../src/stores/files';
import { useProjectStore } from '../src/stores/project';
import { useViewportStore } from '../src/stores/viewport';
import { memoryStorage, template, testPlatform, tightTurnProject } from './helpers';
import type { MemoryStorage, TestPlatform } from './helpers';

const SIZE = { width: 900, height: 550, band: 140 };

let wrapper: VueWrapper | null;
let pinia: Pinia;
let platform: TestPlatform;
let storage: MemoryStorage;
let strokes: string[];
let drawCalls: number;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const stores = () => ({
  project: useProjectStore(pinia),
  editor: useEditorStore(pinia),
  viewport: useViewportStore(pinia),
});

/** Lets Vue update, the debounced save run and animation frames draw. */
async function settle(ms = 20) {
  await flushPromises();
  await vi.advanceTimersByTimeAsync(ms);
  await flushPromises();
}

async function click(id: string) {
  $(id).click();
  await settle();
}

async function type(id: string, value: string, finish = true) {
  const input = $<HTMLInputElement>(id);
  input.value = value;
  input.dispatchEvent(new Event('input'));
  if (finish) input.dispatchEvent(new Event('change'));
  await settle();
}

function press(key: string, init: KeyboardEventInit = {}) {
  document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }));
}

function pointer(type: string, at: { x: number; y: number }, init: MouseEventInit = {}) {
  $('track-canvas').dispatchEvent(
    new MouseEvent(type, { clientX: at.x, clientY: at.y, button: 0, bubbles: true, ...init }),
  );
}

async function clickPlan(at: { x: number; y: number }) {
  pointer('pointerdown', at);
  pointer('pointerup', at);
  await settle();
}

const screen = (point: PlanPoint) => stores().viewport.projection.toScreen(point);

/** A spot on the road 2 m beside control point `index`. */
function roadSide(index: number, side: 'left' | 'right') {
  const { project } = stores();
  const sample = controlPointSample(project.samples, index)!;
  const sign = side === 'right' ? 2 : -2;
  return screen({ x: sample.x + sample.nx * sign, z: sample.z + sample.nz * sign });
}

/** A spot on the road 2 m beside the centerline, at track distance `s`. */
function trackSpot(s: number, side: 'left' | 'right') {
  const sample = sampleAt(stores().project.samples, s)!;
  const sign = side === 'right' ? 2 : -2;
  return screen({ x: sample.x + sample.nx * sign, z: sample.z + sample.nz * sign });
}

async function saved() {
  await vi.advanceTimersByTimeAsync(350);
  return JSON.parse(storage.read(AUTOSAVE_KEY)!) as ReturnType<typeof template>;
}

async function mountApp() {
  pinia = createPinia();
  wrapper = mount(App, {
    attachTo: document.body,
    global: { plugins: [pinia, i18n, { install: (app) => installPlatform(app, platform) }] },
  });
  await settle();
}

beforeEach(() => {
  vi.useFakeTimers();
  setLocale('fr');
  storage = memoryStorage();
  platform = testPlatform(storage);
  strokes = [];
  drawCalls = 0;
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private readonly callback: ResizeObserverCallback) {}
      observe(target: Element) {
        const height = target.id === 'band-canvas' ? SIZE.band : SIZE.height;
        const size = [{ inlineSize: SIZE.width, blockSize: height }];
        this.callback(
          [
            {
              target,
              contentRect: { width: SIZE.width, height },
              contentBoxSize: size,
              borderBoxSize: size,
            } as never,
          ],
          this,
        );
      }
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
    setTimeout(() => callback(0), 16),
  );
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: SIZE.width,
    bottom: SIZE.height,
    width: SIZE.width,
    height: SIZE.height,
    toJSON() {},
  });
  Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
    configurable: true,
    value() {},
  });
  // A 2D context that records strokes and rejects non-finite coordinates; no WebGL.
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value(kind: string) {
      if (kind !== '2d') return null;
      const state: Record<string, unknown> = {};
      return new Proxy(state, {
        get(target, key: string) {
          if (key in target) return target[key];
          if (key === 'createLinearGradient' || key === 'createRadialGradient')
            return () => ({ addColorStop() {} });
          if (key === 'measureText') return (text: string) => ({ width: text.length * 6 });
          return (...args: unknown[]) => {
            for (const arg of args)
              if (typeof arg === 'number' && !Number.isFinite(arg))
                throw new Error(`${key}: non-finite value`);
            if (key === 'stroke') strokes.push(String(target.strokeStyle));
            drawCalls++;
          };
        },
        set(target, key: string, value: unknown) {
          target[key] = value;
          return true;
        },
      });
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.setAttribute('open', '');
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.removeAttribute('open');
    },
  });
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('editor interface', () => {
  it('shows the project, draws it and groups slider moves in the history', async () => {
    await mountApp();
    expect($('layer-track').textContent).toContain('9');
    expect(drawCalls).toBeGreaterThan(0);
    await click('layer-terrain');
    expect($('layer-terrain').getAttribute('aria-pressed')).toBe('true');
    await type('terrain-margin', '200', false);
    await type('terrain-margin', '300');
    expect($('terrain-margin-value').textContent).toBe('300 m');
    expect((await saved()).terrain.margin).toBe(300);
    await click('undo');
    expect($('terrain-margin-value').textContent).toBe('150 m');
    await click('redo');
    expect($('terrain-margin-value').textContent).toBe('300 m');
    // Back on the track layer, its selection is where it was left.
    press('1');
    await settle();
    await type('point-altitude', '42');
    expect((await saved()).points[0].y).toBe(42);
    await type('point-altitude', '');
    expect($<HTMLInputElement>('point-altitude').value).toBe('42');
  });

  it('lets the name be blank while typing and cleans it on blur', async () => {
    await mountApp();
    await type('project-name', '', false);
    expect($<HTMLInputElement>('project-name').value).toBe('');
    await type('project-name', '  Mon circuit  ', false);
    $('project-name').dispatchEvent(new FocusEvent('blur'));
    await settle();
    expect($<HTMLInputElement>('project-name').value).toBe('Mon circuit');
    expect((await saved()).name).toBe('Mon circuit');
    await click('undo');
    expect($<HTMLInputElement>('project-name').value).toBe('Circuit des Collines');
  });

  it('draws a new track, drags on a 5 m grid, deletes and undoes with the keyboard', async () => {
    await mountApp();
    await click('new-project');
    expect($<HTMLDialogElement>('new-dialog').open).toBe(true);
    document.querySelector<HTMLButtonElement>('[data-template="blank"]')!.click();
    await settle();
    expect($<HTMLDialogElement>('new-dialog').open).toBe(false);
    expect($('empty-canvas')).not.toBeNull();
    await clickPlan({ x: 250, y: 250 });
    await clickPlan({ x: 650, y: 250 });
    expect((await saved()).points).toHaveLength(2);
    press('v');
    await settle();
    const start = screen(stores().project.project.points[0]);
    pointer('pointerdown', start);
    pointer('pointermove', { x: start.x + 40, y: start.y + 30 }, { shiftKey: true });
    pointer('pointerup', { x: start.x + 40, y: start.y + 30 });
    await settle();
    const moved = (await saved()).points[0];
    expect(moved.x % 5).toBeCloseTo(0);
    expect(moved.z % 5).toBeCloseTo(0);
    press('Delete');
    await settle();
    expect((await saved()).points).toHaveLength(1);
    press('z', { ctrlKey: true });
    await settle();
    expect((await saved()).points).toHaveLength(2);
    press('z', { ctrlKey: true });
    await settle();
    expect((await saved()).points[0]).not.toEqual(moved);
    press('s', { ctrlKey: true });
    await settle();
    expect(platform.saved.at(-1)!.name).toMatch(/\.roadbuilder\.json$/);
  });

  it('inserts a point with a double click on the road and picks one on the profile', async () => {
    await mountApp();
    const { project } = stores();
    const at = screen(project.samples[Math.floor(project.samples.length / 4)]);
    $('track-canvas').dispatchEvent(
      new MouseEvent('dblclick', { clientX: at.x, clientY: at.y, bubbles: true }),
    );
    await settle();
    expect((await saved()).points).toHaveLength(10);
    // A click at the very start of the band picks the first point.
    for (const type of ['pointerdown', 'pointerup'])
      $('band-canvas').dispatchEvent(
        new MouseEvent(type, { clientX: 90, clientY: 60, button: 0, bubbles: true }),
      );
    await settle();
    expect($('point-badge').textContent).toBe('POINT 01');
  });

  it('switches to the 3D preview, falls back without WebGL and zooms the plan', async () => {
    const dispose = vi.spyOn(platform, 'dispose');
    await mountApp();
    await click('view-3d');
    await vi.dynamicImportSettled();
    await settle(50);
    expect($('view-3d').getAttribute('aria-pressed')).toBe('true');
    expect($('preview-unavailable')).not.toBeNull();
    // Tools work in the preview too: picking one keeps the 3D view.
    await click('tool-add');
    expect($('view-3d').getAttribute('aria-pressed')).toBe('true');
    await click('view-2d');
    await click('zoom-in');
    expect($('zoom-level').textContent).toBe('125 %');
    await click('fit-view');
    expect($('zoom-level').textContent).toBe('100 %');
    wrapper!.unmount();
    wrapper = null;
    expect(dispose).toHaveBeenCalledOnce();
  });

  it('opens project files and keeps the current project when one is invalid', async () => {
    await mountApp();
    platform.offer(serializeProject(template('mountain')));
    await click('open-project');
    expect($<HTMLInputElement>('project-name').value).toBe('Test mountain');
    platform.offer('{invalid');
    await click('open-project');
    expect($('toast').textContent).toContain('JSON valide');
    expect((await saved()).name).toBe('Test mountain');
    wrapper!.unmount();
    await mountApp();
    expect($<HTMLInputElement>('project-name').value).toBe('Test mountain');
  });

  it('keeps an unreadable save and still lets the user download the project', async () => {
    storage.write(AUTOSAVE_KEY, '{corrupted');
    await mountApp();
    expect($('toast').textContent).toContain('n’a pas pu être relue');
    await click('save-project');
    expect(platform.saved[0].name).toBe('rb_circuit_des_collines.roadbuilder.json');
  });

  it('exports both formats from the dialog and blocks an unusable track', async () => {
    await mountApp();
    await click('export-project');
    await type('export-author', 'Pilote');
    await click('download-export');
    // The export job loads on first use, outside the fake clock.
    await vi.waitFor(() => expect(platform.saved).toHaveLength(1));
    expect(platform.saved.at(-1)!.name).toMatch(/_assetto\.zip$/);
    await click('export-project');
    document.querySelector<HTMLInputElement>('input[value="obj"]')!.click();
    await click('download-export');
    await vi.waitFor(() => expect(platform.saved).toHaveLength(2));
    expect(platform.saved.at(-1)!.name).toMatch(/_obj\.zip$/);
    expect((await saved()).author).toBe('Pilote');
    await click('new-project');
    document.querySelector<HTMLButtonElement>('[data-template="blank"]')!.click();
    await settle();
    await click('export-project');
    expect($<HTMLButtonElement>('download-export').disabled).toBe(true);
  });

  it('flags tight turns, locates them from the export dialog and clears them once fixed', async () => {
    await mountApp();
    platform.offer(serializeProject(tightTurnProject()));
    await click('open-project');
    expect($('validation-status').textContent).toContain('points 3 et 4');
    expect($('point-issues')).toBeNull();
    expect(strokes).toContain('#ec8b7f');
    await click('point-next');
    await click('point-next');
    expect($('point-issues').textContent).toContain('points 3 et 4');
    await click('point-next');
    expect($('point-issues').textContent).toContain('points 4 et 5');

    await click('view-3d');
    await click('export-project');
    expect($<HTMLButtonElement>('download-export').disabled).toBe(true);
    expect(document.querySelectorAll('#export-issues [data-locate]')).toHaveLength(2);
    document.querySelector<HTMLButtonElement>('[data-locate="0"]')!.click();
    await settle();
    expect($<HTMLDialogElement>('export-dialog').open).toBe(false);
    expect($('view-2d').getAttribute('aria-pressed')).toBe('true');
    expect($('point-badge').textContent).toBe('POINT 03');
    expect(document.activeElement).toBe($('track-canvas'));
    const { project } = stores();
    const turn = project.issues.tightTurns[0];
    for (const point of [
      project.samples[turn.sampleIndex],
      ...project.project.points.slice(2, 4),
    ]) {
      const at = screen(point);
      expect(at.x).toBeGreaterThan(0);
      expect(at.x).toBeLessThan(SIZE.width);
      expect(at.y).toBeGreaterThan(0);
      expect(at.y).toBeLessThan(SIZE.height);
    }

    await click('layer-road');
    await type('track-width', '4');
    await click('layer-track');
    strokes = [];
    await settle(40);
    expect(strokes).not.toContain('#ec8b7f');
    expect($('point-issues')).toBeNull();
    expect($('locate-tight-turn')).toBeNull();
    await click('undo');
    expect($('point-issues').textContent).toContain('points 3 et 4');
  });

  it('lays a barrier with two clicks on the road, then selects it on the plan', async () => {
    await mountApp();
    await click('layer-edges');
    expect($('tool-width')).toBeNull();
    await click('tool-barrier');
    expect($('barrier-status').textContent).toContain('début de la barrière');
    strokes = [];
    await clickPlan(roadSide(1, 'right'));
    expect($('barrier-status').textContent).toContain('fin de la barrière');
    pointer('pointermove', roadSide(4, 'right'));
    await settle();
    expect(strokes).toContain('#d3f47d');
    strokes = [];
    await clickPlan(roadSide(4, 'right'));
    expect(strokes).toContain('#c8d3d7');
    const { project } = stores();
    const [barrier] = (await saved()).barriers;
    expect(barrier).toMatchObject({ type: 'guardrail', side: 'right', offset: 1 });
    // The barrier runs from where the first click landed to where the second did.
    const distance = (position: typeof barrier.from) =>
      positionDistance(project.project, project.samples, position)!;
    expect(distance(barrier.from)).toBeCloseTo(pointDistance(project.samples, 1), 0);
    expect(distance(barrier.to)).toBeCloseTo(pointDistance(project.samples, 4), 0);
    expect($('barrier-count').textContent).toContain('01');
    expect($<HTMLInputElement>('barrier-offset').value).toBe('1');

    await click('tool-select');
    // The selection tool stays on the barrier layer: a click away from barriers selects nothing.
    await clickPlan(roadSide(6, 'left'));
    expect($('barrier-editor')).toBeNull();
    const path = barrierPath(project.project, project.samples, project.project.barriers[0]);
    await clickPlan(screen(path[Math.floor(path.length / 2)]));
    expect($('barrier-row-0').classList.contains('active')).toBe(true);
    await type('barrier-offset', '2.5');
    expect($('barrier-offset-value').textContent).toBe('2,5 m');
    await click('barrier-swap');
    expect((await saved()).barriers[0]).toMatchObject({ offset: 2.5, side: 'left' });
    await click('barrier-delete');
    expect($('barrier-empty')).not.toBeNull();
  });

  it('cancels a barrier with Escape, then leaves the tool', async () => {
    await mountApp();
    press('b');
    await settle();
    expect($('tool-barrier').getAttribute('aria-pressed')).toBe('true');
    await clickPlan(roadSide(1, 'right'));
    expect($('barrier-status').textContent).toContain('fin de la barrière');
    press('Escape');
    await settle();
    expect($('barrier-status').textContent).toContain('début de la barrière');
    press('Escape');
    await settle();
    expect($('tool-select').getAttribute('aria-pressed')).toBe('true');
    expect(stores().project.project.barriers).toEqual([]);
  });

  it('draws a pit lane with the P tool and sets its number of cars', async () => {
    await mountApp();
    await click('layer-pits');
    await click('pit-delete');
    expect($('pits-empty')).not.toBeNull();
    press('p');
    await settle();
    expect($('tool-pits').getAttribute('aria-pressed')).toBe('true');
    await clickPlan(trackSpot(400, 'right'));
    expect($('pits-status').textContent).toContain('sortie');
    pointer('pointermove', trackSpot(700, 'right'));
    await settle();
    await clickPlan(trackSpot(700, 'right'));
    expect($('pit-editor')).not.toBeNull();
    await type('pit-cars-count', '6');
    expect($('pit-cars').textContent).toContain('6');
    const { pitLane, cars } = await saved();
    expect(pitLane).toMatchObject({ side: 'right', width: 7 });
    expect(cars).toBe(6);
    await click('layer-track');
    await click('mode-open');
    await click('layer-pits');
    expect($('pits-road')).not.toBeNull();
    expect((await saved()).pitLane).toBeNull();
  });

  it('lays a width zone with the L tool, then adjusts and deletes it', async () => {
    await mountApp();
    press('2');
    await settle();
    expect($('width-status').textContent).toContain('largeur de base');
    press('l');
    await settle();
    expect($('tool-width').getAttribute('aria-pressed')).toBe('true');
    await clickPlan(trackSpot(150, 'left'));
    expect($('width-status').textContent).toContain('fin de la portion');
    pointer('pointermove', trackSpot(350, 'left'));
    await settle();
    strokes = [];
    pointer('pointermove', trackSpot(360, 'left'));
    await settle();
    expect(strokes).toContain('#d3f47d');
    await clickPlan(trackSpot(350, 'left'));
    expect($('width-editor')).not.toBeNull();
    expect($('width-count').textContent).toContain('01');
    expect((await saved()).widthZones).toEqual([expect.objectContaining({ width: 16 })]);
    await type('width-zone-width', '9');
    expect((await saved()).widthZones[0].width).toBe(9);

    await click('tool-select');
    await clickPlan(trackSpot(500, 'left'));
    expect($('width-editor')).toBeNull();
    await clickPlan(trackSpot(250, 'left'));
    expect($('width-row-0').classList.contains('active')).toBe(true);
    await click('width-delete');
    expect((await saved()).widthZones).toEqual([]);
    press('l');
    await settle();
    await clickPlan(trackSpot(150, 'left'));
    press('Escape');
    await settle();
    expect($('width-status').textContent).toContain('début de la portion');
  });

  it('offers one layer at a time, with its tools, its planned tools and its settings', async () => {
    await mountApp();
    expect($('layer-track').getAttribute('aria-pressed')).toBe('true');
    expect($('tool-add')).not.toBeNull();
    expect($('point-badge')).not.toBeNull();
    await click('soon-freehand');
    expect($('toast').textContent).toContain('main levée');
    press('3');
    await settle();
    expect($('tool-add')).toBeNull();
    expect($('tool-barrier')).not.toBeNull();
    expect($('barrier-empty')).not.toBeNull();
    expect($('point-badge')).toBeNull();
    await click('layer-eye-edges');
    expect(stores().editor.hiddenLayers).toEqual(['edges']);
    expect($('layer-eye-edges').getAttribute('aria-pressed')).toBe('false');
    expect($('band-canvas')).not.toBeNull();
    await click('layer-scenery');
    expect($('tool-tree')).not.toBeNull();
    expect($('scenery-empty')).not.toBeNull();
    expect($('band-canvas')).toBeNull();
    // A tool key of another layer moves to that layer.
    press('l');
    await settle();
    expect($('layer-road').getAttribute('aria-pressed')).toBe('true');
    expect($('tool-width').getAttribute('aria-pressed')).toBe('true');
  });

  it('draws straights and arcs on from the selected point, then edits their shape', async () => {
    await mountApp();
    const { project, editor } = stores();
    const count = project.project.points.length;
    const start = editor.drawFrom!;
    press('s');
    await settle();
    expect($('tool-straight').getAttribute('aria-pressed')).toBe('true');
    // Shift keeps the straight on the track heading, to the metre.
    const aim = screen({
      x: start.at.x + start.heading.x * 40.4 - start.heading.z * 3,
      z: start.at.z + start.heading.z * 40.4 + start.heading.x * 3,
    });
    pointer('pointermove', aim, { shiftKey: true });
    await settle();
    const draft = editor.drawDraft;
    expect(draft?.kind === 'straight' && [draft.length, Math.round(draft.turn)]).toEqual([40, 0]);
    pointer('pointerdown', aim, { shiftKey: true });
    pointer('pointerup', aim, { shiftKey: true });
    await settle();
    let points = (await saved()).points;
    expect(points).toHaveLength(count + 1);
    expect(points[0].straight).toBe(true);
    expect(editor.selectedIndex).toBe(1);
    // The new point is rounded from the inspector, and the straight leading to it shows its length.
    await click('point-previous');
    expect($('shape-straight').getAttribute('aria-pressed')).toBe('true');
    expect($<HTMLInputElement>('shape-length').value).toBe('40');
    await type('shape-length', '50');
    await click('point-next');
    await click('shape-round');
    points = (await saved()).points;
    expect(points[1].radius).toBeGreaterThan(0);
    expect($('shape-radius')).not.toBeNull();
    await click('shape-unround');
    expect((await saved()).points[1].radius).toBeUndefined();
    // An arc adds rounded points and ends where it was aimed.
    press('r');
    await settle();
    const from = editor.drawFrom!;
    const end = {
      x: from.at.x + from.heading.x * 30 - from.heading.z * 30,
      z: from.at.z + from.heading.z * 30 + from.heading.x * 30,
    };
    await clickPlan(screen(end));
    points = (await saved()).points;
    expect(points.length).toBe(count + 3);
    expect(points[2].radius).toBeGreaterThan(0);
    expect(points[3].x).toBeCloseTo(end.x, 0);
    expect(points[3].z).toBeCloseTo(end.z, 0);
  });

  it('selects points in a rectangle, moves them together and edits them as a group', async () => {
    await mountApp();
    const { project, editor } = stores();
    const [a, b] = project.project.points.slice(1, 3).map((point) => screen(point));
    const box = {
      left: Math.min(a.x, b.x) - 6,
      top: Math.min(a.y, b.y) - 6,
      right: Math.max(a.x, b.x) + 6,
      bottom: Math.max(a.y, b.y) + 6,
    };
    pointer('pointerdown', { x: box.left, y: box.top });
    pointer('pointermove', { x: box.right, y: box.bottom });
    await settle();
    expect(editor.marquee).not.toBeNull();
    pointer('pointerup', { x: box.right, y: box.bottom });
    await settle();
    const ids = editor.selectedPointIds;
    expect(ids).toEqual(
      expect.arrayContaining(project.project.points.slice(1, 3).map((p) => p.id)),
    );
    expect($('points-editor')).not.toBeNull();

    // Dragging one of them moves the group, in one undo step.
    const before = project.project.points.filter((point) => ids.includes(point.id));
    pointer('pointerdown', a);
    pointer('pointermove', { x: a.x + 30, y: a.y });
    pointer('pointerup', { x: a.x + 30, y: a.y });
    await settle();
    const after = project.project.points.filter((point) => ids.includes(point.id));
    const shifts = after.map((point, i) => point.x - before[i].x);
    expect(shifts.every((shift) => Math.abs(shift - shifts[0]) < 1e-9 && shift > 0)).toBe(true);
    await click('undo');
    expect(project.project.points.filter((point) => ids.includes(point.id))).toEqual(before);

    await click('points-up');
    expect(project.project.points.find((point) => point.id === ids[0])!.y).toBe(before[0].y + 1);
    await click('points-delete');
    expect(project.project.points.some((point) => ids.includes(point.id))).toBe(false);
    expect($('point-empty')).not.toBeNull();
  });

  it('jumps to a corner from the go-to menu or the band, and recentres from the mini map', async () => {
    await mountApp();
    const { project, viewport } = stores();
    const corner = project.corners[2];
    const select = $<HTMLSelectElement>('goto');
    expect(select.querySelectorAll('optgroup option').length).toBeGreaterThanOrEqual(
      project.corners.length,
    );
    const fitted = viewport.projection.camera.scale;
    select.value = 'corner:2';
    select.dispatchEvent(new Event('change'));
    await settle();
    expect(viewport.projection.camera.scale).toBeGreaterThan(fitted);
    const apex = sampleAt(project.samples, corner.apex)!;
    const onScreen = screen(apex);
    expect(onScreen.x).toBeGreaterThan(0);
    expect(onScreen.x).toBeLessThan(SIZE.width);
    expect(select.value).toBe('');

    $('mini-map').dispatchEvent(
      new MouseEvent('click', { clientX: 84, clientY: 56, bubbles: true }),
    );
    await settle();
    expect(viewport.projection.camera.x).not.toBe(apex.x);
  });

  it('picks a stretch in the band, lays a zone on it and stretches the zone by its end', async () => {
    await mountApp();
    await click('layer-road');
    const band = $('band-canvas');
    const at = (type: string, x: number, y: number) =>
      band.dispatchEvent(
        new MouseEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true }),
      );
    // Rows: the width, its zones, the bank, its zones; drag across the width zones row.
    const size = { width: SIZE.width, height: SIZE.band };
    const middle = (id: string) => {
      const row = bandRows('road', size).find((candidate) => candidate.id === id)!;
      return row.y + row.height / 2;
    };
    const y = middle('zones');
    at('pointerdown', 300, y);
    at('pointermove', 420, y);
    at('pointerup', 420, y);
    await settle();
    expect($('range-inspector')).not.toBeNull();
    await click('range-width-zone');
    expect($('range-inspector')).toBeNull();
    const { project, viewport } = stores();
    expect(project.project.widthZones).toHaveLength(1);
    expect($('width-row-0').classList.contains('active')).toBe(true);

    // Stretch the zone by its end, in one undo step.
    const total = trackLength(project.samples);
    const view = { start: 0, end: total };
    const zone = widthZoneRanges(project.project, project.samples)[0];
    const endX = bandX(size, view, zone.start + zone.length);
    at('pointerdown', endX, y);
    at('pointermove', endX + 60, y);
    at('pointermove', endX + 80, y);
    at('pointerup', endX + 80, y);
    await settle();
    const longer = widthZoneRanges(project.project, project.samples)[0];
    expect(longer.length).toBeGreaterThan(zone.length + 20);
    await click('undo');
    expect(widthZoneRanges(project.project, project.samples)[0].length).toBeCloseTo(zone.length, 3);
    expect(viewport.bandView).toBeNull();
  });

  it('lays banking on a corner from the band, raised outside, and adjusts it', async () => {
    await mountApp();
    await click('layer-road');
    const { project } = stores();
    const corner = project.corners[0];
    const size = { width: SIZE.width, height: SIZE.band };
    const view = { start: 0, end: trackLength(project.samples) };
    const row = bandRows('road', size).find((candidate) => candidate.id === 'bankZones')!;
    const y = row.y + row.height / 2;
    const at = (type: string, s: number) =>
      $('band-canvas').dispatchEvent(
        new MouseEvent(type, {
          clientX: bandX(size, view, s),
          clientY: y,
          button: 0,
          bubbles: true,
        }),
      );
    at('pointerdown', corner.start);
    at('pointermove', corner.start + corner.length);
    at('pointerup', corner.start + corner.length);
    await settle();
    await click('range-bank-zone');
    const [zone] = project.project.bankZones;
    expect(zone).toMatchObject({ angle: 8, high: corner.direction === 'left' ? 'right' : 'left' });
    expect($('bank-row-0').classList.contains('active')).toBe(true);
    await type('bank-angle', '12');
    await click(`bank-high-${zone.high === 'left' ? 'right' : 'left'}`);
    expect(project.project.bankZones[0]).toMatchObject({ angle: 12, high: corner.direction });
    await click('bank-delete');
    expect(project.project.bankZones).toEqual([]);
  });

  it('lays earthworks in two clicks beside the track, and edits them', async () => {
    await mountApp();
    await click('layer-terrain');
    expect($('soon-sculpt')).toBeNull();
    expect($('tool-hill')).not.toBeNull();
    expect($('earthwork-empty')).not.toBeNull();
    await click('terrain-ditch');
    expect($('tool-ditch').getAttribute('aria-pressed')).toBe('true');
    await clickPlan(roadSide(1, 'right'));
    strokes = [];
    pointer('pointermove', roadSide(4, 'right'));
    await settle();
    expect(strokes).toContain('#d3f47d');
    await clickPlan(roadSide(4, 'right'));
    const [ditch] = (await saved()).earthworks;
    expect(ditch).toMatchObject({ type: 'ditch', side: 'right', offset: 1, width: 3 });
    expect($('earthwork-row-0').classList.contains('active')).toBe(true);
    expect($('earthwork-offset')).not.toBeNull();
    expect($('earthwork-height-value').textContent).toBe('0,8 m');
    await type('earthwork-height', '2');
    expect((await saved()).earthworks[0].height).toBe(2);
    // Another type starts from its own defaults; a run-off has only a width.
    await click('earthwork-type-runoff');
    expect($('earthwork-offset')).toBeNull();
    expect((await saved()).earthworks[0]).toMatchObject({ type: 'runoff', width: 25 });
    await click('earthwork-swap');
    expect((await saved()).earthworks[0].side).toBe('left');
    press('Delete');
    await settle();
    expect($('earthwork-empty')).not.toBeNull();
    // Escape drops a first click, then leaves the tool.
    await click('tool-embankment');
    await clickPlan(roadSide(1, 'left'));
    expect(stores().editor.earthworkDraft).not.toBeNull();
    press('Escape');
    await settle();
    expect(stores().editor.earthworkDraft).toBeNull();
  });

  it('lays an earthwork on a stretch picked in the band', async () => {
    await mountApp();
    await click('layer-terrain');
    const band = $('band-canvas');
    const at = (type: string, x: number, y: number) =>
      band.dispatchEvent(
        new MouseEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true }),
      );
    const row = bandRows('terrain', { width: SIZE.width, height: SIZE.band })[0];
    const y = row.y + row.height / 2;
    at('pointerdown', 300, y);
    at('pointermove', 420, y);
    at('pointerup', 420, y);
    await settle();
    await click('range-embankment-left');
    expect($('range-inspector')).toBeNull();
    expect(stores().project.project.earthworks).toMatchObject([
      { type: 'embankment', side: 'left', height: 3 },
    ]);
    expect($('earthwork-row-0').classList.contains('active')).toBe(true);
  });

  it('raises a hill on the plan, digs it into a hollow and drags it', async () => {
    await mountApp();
    await click('layer-terrain');
    await click('terrain-hill');
    const { project } = stores();
    // Inside the club circuit, away from the track.
    const centre = { x: -100, z: 60 };
    await clickPlan(screen(centre));
    expect(project.project.hills).toHaveLength(1);
    expect($('hill-editor')).not.toBeNull();
    await type('hill-height', '-5');
    expect($('hill-editor').querySelector('h2')!.textContent).toBe('Cuvette');
    await click('tool-select');
    pointer('pointerdown', screen(centre));
    pointer('pointermove', screen({ x: centre.x + 20, z: centre.z }));
    pointer('pointerup', screen({ x: centre.x + 20, z: centre.z }));
    await settle();
    expect(project.project.hills[0].x).toBeCloseTo(centre.x + 20, 0);
    await click('hill-delete');
    expect($('hill-empty')).not.toBeNull();
  });

  it('switches the whole interface to English and remembers it', async () => {
    await mountApp();
    expect($('locale-fr').getAttribute('aria-pressed')).toBe('true');
    await click('locale-en');
    expect($('new-project').textContent).toContain('New');
    expect($('layer-track').textContent).toContain('Track');
    expect($('validation-status').textContent).toContain('Geometry ready');
    expect(document.documentElement.lang).toBe('en');
    expect(localStorage.getItem('roadbuilder.locale')).toBe('en');
    await click('locale-fr');
    expect($('new-project').textContent).toContain('Nouveau');
  });
});
