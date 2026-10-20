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
import { controlPointSample, sampleAt } from '../src/core/track/centerline';
import { pointDistance, positionDistance } from '../src/core/track/positions';
import { i18n, setLocale } from '../src/i18n';
import { installPlatform } from '../src/platform/platform';
import { useEditorStore } from '../src/stores/editor';
import { AUTOSAVE_KEY } from '../src/stores/files';
import { useProjectStore } from '../src/stores/project';
import { useViewportStore } from '../src/stores/viewport';
import { memoryStorage, template, testPlatform, tightTurnProject } from './helpers';
import type { MemoryStorage, TestPlatform } from './helpers';

const SIZE = { width: 900, height: 550, profile: 69 };

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
        const height = target.id === 'elevation-canvas' ? SIZE.profile : SIZE.height;
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
    $('elevation-canvas').dispatchEvent(new MouseEvent('click', { clientX: 0, bubbles: true }));
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
    await click('tool-add');
    expect($('view-2d').getAttribute('aria-pressed')).toBe('true');
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
    await settle(60);
    expect(platform.saved.at(-1)!.name).toMatch(/_assetto\.zip$/);
    await click('export-project');
    document.querySelector<HTMLInputElement>('input[value="obj"]')!.click();
    await click('download-export');
    await settle(60);
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
    await click('soon-arc');
    expect($('toast').textContent).toContain('rayon réglable');
    press('3');
    await settle();
    expect($('tool-add')).toBeNull();
    expect($('tool-barrier')).not.toBeNull();
    expect($('barrier-empty')).not.toBeNull();
    expect($('point-badge')).toBeNull();
    await click('layer-eye-edges');
    expect(stores().editor.hiddenLayers).toEqual(['edges']);
    expect($('layer-eye-edges').getAttribute('aria-pressed')).toBe('false');
    await click('layer-decor');
    expect($('inspector-planned')).not.toBeNull();
    // A tool key of another layer moves to that layer.
    press('l');
    await settle();
    expect($('layer-road').getAttribute('aria-pressed')).toBe('true');
    expect($('tool-width').getAttribute('aria-pressed')).toBe('true');
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
