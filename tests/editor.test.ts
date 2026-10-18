// @vitest-environment jsdom
import { Blob as NodeBlob } from 'node:buffer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, nextTick } from 'vue';
import type { App as VueApp } from 'vue';
import App from '../src/App.vue';
import { createProject } from '../src/domain/project';
import { barrierPath } from '../src/domain/barriers';
import { STORAGE_KEY } from '../src/domain/storage';
import { TrackRenderer } from '../src/rendering/TrackRenderer';
import type { Project } from '../src/domain/types';
import tightTurnFixture from './fixtures/tight-turn.roadbuilder.json';

let app: VueApp | null;
let errors: unknown[];
let downloads: { name: string; blob: NodeBlob }[];
let renderer: TrackRenderer;
let drawCalls: number;
let strokeColors: string[];
const disconnect = vi.fn();
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const flush = async () => {
  await nextTick();
  await vi.advanceTimersByTimeAsync(20);
  await nextTick();
};
async function click(id: string) {
  $(id).click();
  await flush();
}
async function input(id: string, value: string, finish = true) {
  const el = $<HTMLInputElement>(id);
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  await nextTick();
  if (finish) el.dispatchEvent(new Event('change', { bubbles: true }));
  await flush();
}
function key(value: string, extra: KeyboardEventInit = {}) {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, ...extra }));
}
async function saved(): Promise<Project> {
  await vi.advanceTimersByTimeAsync(350);
  return JSON.parse(localStorage.getItem(STORAGE_KEY)!) as Project;
}
async function openFile(value: unknown, size?: number) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  Object.defineProperty($('file-input'), 'files', {
    configurable: true,
    value: [{ size: size ?? text.length, text: () => Promise.resolve(text) }],
  });
  $('file-input').dispatchEvent(new Event('change', { bubbles: true }));
  await flush();
}
function pointer(type: string, x: number, y: number, extra: MouseEventInit = {}) {
  $('track-canvas').dispatchEvent(
    new MouseEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true, ...extra }),
  );
}
/** Clic sur la chaussée, à 2 m du point de contrôle, du côté demandé. */
function roadClick(type: string, index: number, side: 'left' | 'right') {
  const point = renderer.project.points[index];
  const sample = renderer.samples.find((s) => s.segment === index && s.t === 0)!;
  const sign = side === 'right' ? 1 : -1;
  const target = {
    x: point.x + sample.nx * 2 * sign,
    y: point.y,
    z: point.z + sample.nz * 2 * sign,
  };
  const screen = renderer.screen(target);
  pointer(type, screen.x, screen.y);
}
async function traceBarrier(from: number, to: number, side: 'left' | 'right' = 'right') {
  roadClick('pointerdown', from, side);
  roadClick('pointerup', from, side);
  await flush();
  roadClick('pointermove', to, side);
  await flush();
  roadClick('pointerdown', to, side);
  roadClick('pointerup', to, side);
  await flush();
}
async function mount() {
  const spy = vi.spyOn(TrackRenderer.prototype, 'setProject');
  document.body.innerHTML = '<div id="app"></div>';
  app = createApp(App);
  app.config.errorHandler = (error) => errors.push(error);
  app.mount('#app');
  renderer = spy.mock.contexts.at(-1)! as TrackRenderer;
  await flush();
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  errors = [];
  downloads = [];
  drawCalls = 0;
  strokeColors = [];
  disconnect.mockClear();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect = disconnect;
    },
  );
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
    setTimeout(() => callback(performance.now()), 16),
  );
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
  vi.stubGlobal('Blob', NodeBlob);
  const blobs = new Map<string, NodeBlob>();
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL(blob: unknown) {
        const key = `blob:roadbuilder/${blobs.size}`;
        blobs.set(key, blob as NodeBlob);
        return key;
      }
      static revokeObjectURL(key: string) {
        blobs.delete(key);
      }
    },
  );
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    downloads.push({ name: this.download, blob: blobs.get(this.href)! });
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLCanvasElement,
  ) {
    return {
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 900,
      bottom: 550,
      width: 900,
      height: this.id === 'elevation-canvas' ? 69 : 550,
      toJSON() {},
    };
  });
  Object.defineProperty(HTMLCanvasElement.prototype, 'setPointerCapture', {
    configurable: true,
    value() {},
  });
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value() {
      const state: Record<string, unknown> = {};
      return new Proxy(state, {
        get(target, key: string) {
          if (key in target) return target[key];
          if (key === 'createLinearGradient' || key === 'createRadialGradient')
            return () => ({ addColorStop() {} });
          return (...args: unknown[]) => {
            for (const arg of args)
              if (typeof arg === 'number' && !Number.isFinite(arg))
                throw new Error(`${key}: valeur non finie`);
            if (key === 'stroke') strokeColors.push(String(target.strokeStyle));
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
  app?.unmount();
  app = null;
  expect(errors).toEqual([]);
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('interface Vue (DOM et canvas simulés)', () => {
  it('affiche les valeurs initiales, actualise le rendu et groupe les réglages dans l’historique', async () => {
    await mount();
    expect($('point-count').textContent).toBe('09 POINTS');
    expect(drawCalls).toBeGreaterThan(0);
    await input('terrain-margin', '200', false);
    await input('terrain-margin', '300');
    expect($('terrain-value').textContent).toBe('300 m');
    expect((await saved()).terrainMargin).toBe(300);
    expect(renderer.project.terrainMargin).toBe(300);
    await click('undo');
    expect($('terrain-value').textContent).toBe('150 m');
    await click('redo');
    expect($('terrain-value').textContent).toBe('300 m');
    await input('point-altitude', '42');
    expect((await saved()).points[0].y).toBe(42);
    await input('point-altitude', '');
    expect((await saved()).points[0].y).toBe(42);
    expect($<HTMLInputElement>('point-altitude').value).toBe('42');
  });
  it('laisse saisir un nom vide ou avec espaces avant de le normaliser à la sortie du champ', async () => {
    await mount();
    await input('project-name', '');
    expect($<HTMLInputElement>('project-name').value).toBe('');
    await input('project-name', '  Mon circuit  ');
    expect($<HTMLInputElement>('project-name').value).toBe('  Mon circuit  ');
    $('project-name').dispatchEvent(new FocusEvent('blur'));
    await flush();
    expect($<HTMLInputElement>('project-name').value).toBe('Mon circuit');
    expect((await saved()).name).toBe('Mon circuit');
    await click('undo');
    expect($<HTMLInputElement>('project-name').value).toBe('Circuit des Collines');
  });

  it('gère la page blanche, les gestes, la grille, la suppression et les raccourcis', async () => {
    await mount();
    await click('new-project');
    expect($<HTMLDialogElement>('new-dialog').open).toBe(true);
    (document.querySelector('[data-template="blank"]') as HTMLButtonElement).click();
    await flush();
    expect($('empty-canvas')).not.toBeNull();
    pointer('pointerdown', 250, 250);
    pointer('pointerup', 250, 250);
    await flush();
    pointer('pointerdown', 650, 250);
    pointer('pointerup', 650, 250);
    await flush();
    expect((await saved()).points).toHaveLength(2);
    key('v');
    await flush();
    const point = renderer.screen(renderer.project.points[0]);
    pointer('pointerdown', point.x, point.y);
    pointer('pointermove', point.x + 40, point.y + 30, { shiftKey: true });
    pointer('pointerup', point.x + 40, point.y + 30);
    await flush();
    const moved = (await saved()).points[0];
    expect(moved.x % 5).toBeCloseTo(0);
    expect(moved.z % 5).toBeCloseTo(0);
    key('Delete');
    await flush();
    expect((await saved()).points).toHaveLength(1);
    key('z', { ctrlKey: true });
    await flush();
    expect((await saved()).points).toHaveLength(2);
    key('z', { ctrlKey: true });
    await flush();
    expect((await saved()).points[0]).not.toEqual(moved);
    key('s', { ctrlKey: true });
    await flush();
    expect(downloads.at(-1)!.name).toMatch(/\.roadbuilder\.json$/);
  });
  it('insère un point sur la route par double-clic et permet de choisir un point par le profil', async () => {
    await mount();
    const sample = renderer.samples[Math.floor(renderer.samples.length / 4)],
      p = renderer.screen(sample);
    $('track-canvas').dispatchEvent(
      new MouseEvent('dblclick', { clientX: p.x, clientY: p.y, bubbles: true }),
    );
    await flush();
    expect((await saved()).points).toHaveLength(10);
    $('elevation-canvas').dispatchEvent(new MouseEvent('click', { clientX: 0, bubbles: true }));
    await flush();
    expect($('point-badge').textContent).toBe('POINT 01');
  });
  it('change de vue, tourne, zoome et nettoie les ressources au démontage', async () => {
    await mount();
    await click('view-3d');
    expect($('view-3d').getAttribute('aria-pressed')).toBe('true');
    const before = renderer.camera.yaw;
    pointer('pointerdown', 300, 300);
    pointer('pointermove', 400, 320);
    pointer('pointerup', 400, 320);
    await flush();
    expect(renderer.camera.yaw).not.toBe(before);
    await click('zoom-in');
    expect($('zoom-level').textContent).toBe('125 %');
    await click('fit-view');
    expect($('zoom-level').textContent).toBe('100 %');
    await click('tool-add');
    expect($('view-2d').getAttribute('aria-pressed')).toBe('true');
    app!.unmount();
    app = null;
    expect(disconnect).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('importe les anciens projets, conserve le projet en cas d’erreur et restaure au remontage', async () => {
    await mount();
    const { terrainMargin: _, ...legacy } = createProject('mountain');
    await openFile(legacy);
    expect((await saved()).terrainMargin).toBe(150);
    expect($<HTMLInputElement>('project-name').value).toBe(legacy.name);
    await openFile('{invalid');
    expect($('toast').textContent).toContain('JSON valide');
    expect((await saved()).name).toBe(legacy.name);
    await openFile(legacy, 2 * 1024 * 1024);
    expect($('toast').textContent).toContain('dépasse 1 Mo');
    app!.unmount();
    app = null;
    await mount();
    expect($<HTMLInputElement>('project-name').value).toBe(legacy.name);
  });
  it('préserve la sauvegarde corrompue et permet de télécharger sans stockage', async () => {
    localStorage.setItem(STORAGE_KEY, '{corrompu');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    await mount();
    expect($('save-status').textContent).toContain('Ancienne sauvegarde préservée');
    await input('project-name', 'Mon nouveau tracé');
    await vi.advanceTimersByTimeAsync(350);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('{corrompu');
    await click('save-project');
    const savedProject = JSON.parse(await downloads[0].blob.text()) as Project;
    expect(savedProject.name).toBe('Mon nouveau tracé');
  });
  it('exporte les deux formats via les dialogues et bloque une géométrie invalide', async () => {
    await mount();
    await click('export-project');
    await input('export-author', 'Pilote');
    await click('download-export');
    await vi.advanceTimersByTimeAsync(60);
    await flush();
    expect(downloads.at(-1)!.name).toMatch(/_assetto.zip$/);
    await click('export-project');
    (document.querySelector('input[value="obj"]') as HTMLInputElement).click();
    await flush();
    await click('download-export');
    await vi.advanceTimersByTimeAsync(60);
    await flush();
    expect(downloads.at(-1)!.name).toMatch(/_sources.zip$/);
    expect((await saved()).author).toBe('Pilote');
    await click('new-project');
    (document.querySelector('[data-template="blank"]') as HTMLButtonElement).click();
    await flush();
    await click('export-project');
    expect($<HTMLButtonElement>('download-export').disabled).toBe(true);
  });
  it('montre les portions trop serrées avant l’export, permet de les retrouver et actualise tous les diagnostics après correction', async () => {
    await mount();
    await openFile(tightTurnFixture);
    expect($('validation-status').textContent).toContain('points 3 et 4');
    expect($('point-issues')).toBeNull(); // The initially selected point is on the straight.
    expect(strokeColors).toContain('#ec8b7f');
    expect(renderer.tightTurns.map((turn) => turn.pointIndices)).toEqual([
      [2, 3],
      [3, 4],
    ]);
    await click('point-next');
    await click('point-next');
    expect($('point-issues').textContent).toContain('points 3 et 4');
    await click('point-next');
    expect($('point-issues').textContent).toContain('points 3 et 4');
    expect($('point-issues').textContent).toContain('points 4 et 5');
    await click('point-next');
    expect($('point-issues').textContent).toContain('points 4 et 5');

    await click('view-3d');
    await click('export-project');
    expect($<HTMLButtonElement>('download-export').disabled).toBe(true);
    expect(document.querySelectorAll('#export-issues [data-tight-turn]')).toHaveLength(2);
    const turn = renderer.tightTurns[0];
    for (const issue of renderer.tightTurns)
      expect($('export-issues').textContent).toContain(issue.message);
    (document.querySelector('[data-tight-turn="2"]') as HTMLButtonElement).click();
    await flush();
    expect($<HTMLDialogElement>('export-dialog').open).toBe(false);
    expect($('view-2d').getAttribute('aria-pressed')).toBe('true');
    expect($('point-badge').textContent).toBe('POINT 03');
    expect(document.activeElement).toBe($('track-canvas'));
    for (const point of [
      renderer.samples[turn.sampleIndex],
      ...turn.pointIndices.map((index) => renderer.project.points[index]),
    ]) {
      const screen = renderer.screen(point);
      expect(screen.x).toBeGreaterThan(0);
      expect(screen.x).toBeLessThan(renderer.width);
      expect(screen.y).toBeGreaterThan(0);
      expect(screen.y).toBeLessThan(renderer.height);
    }

    strokeColors = [];
    await input('track-width', '4');
    expect(renderer.tightTurns).toEqual([]);
    expect(strokeColors).not.toContain('#ec8b7f');
    expect($('point-issues')).toBeNull();
    expect($('locate-tight-turn')).toBeNull();
    await click('export-project');
    expect($('export-issues').textContent).not.toContain('trop serré');
    expect($<HTMLButtonElement>('download-export').disabled).toBe(false);
    (document.querySelector('[data-close="export-dialog"]') as HTMLButtonElement).click();
    await flush();
    await click('undo');
    expect(renderer.tightTurns).toHaveLength(2);
    expect($('point-issues').textContent).toContain('points 3 et 4');
    await click('redo');
    expect(renderer.tightTurns).toEqual([]);
    expect($('point-issues')).toBeNull();
  });

  it('localise la fermeture d’un circuit depuis l’export et retire ses repères lors d’un autre import', async () => {
    await mount();
    await openFile({ ...tightTurnFixture, closed: true });
    await click('export-project');
    (document.querySelector('[data-tight-turn="6"]') as HTMLButtonElement).click();
    await flush();
    expect($('point-badge').textContent).toBe('POINT 07');
    expect($('point-issues').textContent).toContain('points 7 et 1');
    await openFile(createProject('club'));
    expect(renderer.tightTurns).toEqual([]);
    expect($('point-issues')).toBeNull();
    expect($('locate-tight-turn')).toBeNull();
  });

  it('ignore le résultat d’un import en cours lorsqu’un nouveau projet le remplace', async () => {
    await mount();
    let resolve!: (value: string) => void;
    Object.defineProperty($('file-input'), 'files', {
      configurable: true,
      value: [
        {
          size: 100,
          text: () =>
            new Promise<string>((done) => {
              resolve = done;
            }),
        },
      ],
    });
    $('file-input').dispatchEvent(new Event('change', { bubbles: true }));
    await click('new-project');
    (document.querySelector('[data-template="blank"]') as HTMLButtonElement).click();
    await flush();
    resolve(JSON.stringify(createProject('kart')));
    await flush();
    expect((await saved()).name).toBe('Mon nouveau tracé');
  });

  it('trace une barrière en deux clics, l’affiche, la sélectionne et la persiste', async () => {
    await mount();
    await click('tool-barrier');
    expect($('tool-barrier').getAttribute('aria-pressed')).toBe('true');
    expect($('barrier-status').textContent).toContain('point de départ');
    strokeColors = [];
    roadClick('pointerdown', 1, 'right');
    roadClick('pointerup', 1, 'right');
    await flush();
    expect($('barrier-status').textContent).toContain('point d’arrivée');
    expect(strokeColors).toContain('#d3f47d');
    roadClick('pointermove', 4, 'right');
    await flush();
    strokeColors = [];
    roadClick('pointerdown', 4, 'right');
    roadClick('pointerup', 4, 'right');
    await flush();
    expect(strokeColors).toContain('#c8d3d7');
    const project = await saved();
    expect(project.barriers).toEqual([
      { type: 'guardrail', side: 'right', from: 1, to: 4, offset: 1 },
    ]);
    expect($('barrier-count').textContent).toContain('01');
    expect($('barrier-row-0')).not.toBeNull();
    expect($('barrier-editor')).not.toBeNull();
    expect($<HTMLInputElement>('barrier-offset').value).toBe('1');

    await click('tool-select');
    expect($('barrier-status').textContent).toContain('sélectionné');
    roadClick('pointerdown', 1, 'right');
    roadClick('pointerup', 1, 'right');
    await flush();
    expect($('barrier-editor')).toBeNull();
    const path = barrierPath(renderer.project, renderer.samples, renderer.project.barriers![0]);
    const mid = renderer.screen(path[Math.floor(path.length / 2)]);
    pointer('pointerdown', mid.x, mid.y);
    pointer('pointerup', mid.x, mid.y);
    await flush();
    expect($('barrier-row-0').classList.contains('active')).toBe(true);
    expect($('barrier-editor')).not.toBeNull();
    await click('view-3d');
    expect(drawCalls).toBeGreaterThan(0);
  });

  it('refuse un tronçon qui démarre et s’arrête sur le même point', async () => {
    await mount();
    await click('barrier-draw');
    roadClick('pointerdown', 2, 'right');
    roadClick('pointerup', 2, 'right');
    await flush();
    roadClick('pointerdown', 2, 'right');
    roadClick('pointerup', 2, 'right');
    await flush();
    expect($('toast').textContent).toContain('différent');
    expect((await saved()).barriers ?? []).toEqual([]);
    expect($('barrier-empty')).not.toBeNull();
  });

  it('modifie, inverse, supprime et répare les tronçons avec l’historique', async () => {
    await mount();
    await click('tool-barrier');
    await traceBarrier(1, 4);
    await click('barrier-type-wall');
    expect((await saved()).barriers![0].type).toBe('wall');
    expect($('barrier-type-note').textContent).toContain('Le tronçon sélectionné');
    await input('barrier-offset', '2.5');
    expect((await saved()).barriers![0].offset).toBe(2.5);
    expect($('barrier-offset-value').textContent).toContain('2,5 m');
    await click('barrier-swap');
    expect((await saved()).barriers![0].side).toBe('left');
    await click('undo');
    expect((await saved()).barriers![0].side).toBe('right');
    await click('redo');
    expect((await saved()).barriers![0].side).toBe('left');
    await click('barrier-delete');
    expect((await saved()).barriers).toEqual([]);
    expect($('barrier-empty')).not.toBeNull();
    await click('undo');
    expect((await saved()).barriers).toHaveLength(1);

    await click('barrier-row-0');
    await click('point-next');
    await click('point-next');
    expect($('point-badge').textContent).toBe('POINT 03');
    await click('delete-point');
    expect((await saved()).barriers).toEqual([
      { type: 'wall', side: 'left', from: 1, to: 3, offset: 2.5 },
    ]);
    await click('undo');
    await click('point-previous');
    expect($('point-badge').textContent).toBe('POINT 02');
    await click('delete-point');
    expect((await saved()).barriers).toEqual([]);
  });

  it('rejoue les barrières à l’envers et les scinde au passage en route ouverte', async () => {
    await mount();
    await openFile({
      ...createProject('club'),
      barriers: [{ type: 'wall', side: 'left', from: 7, to: 2, offset: 2 }],
    });
    expect(renderer.project.barriers).toHaveLength(1);
    expect($('barrier-count').textContent).toContain('01');
    await click('reverse-track');
    expect((await saved()).barriers).toEqual([
      { type: 'wall', side: 'right', from: 7, to: 2, offset: 2 },
    ]);
    await click('undo');
    await click('mode-open');
    expect((await saved()).barriers).toEqual([
      { type: 'wall', side: 'left', from: 7, to: 8, offset: 2 },
      { type: 'wall', side: 'left', from: 0, to: 2, offset: 2 },
    ]);
  });

  it('trace au clavier, annule le tracé en cours puis quitte l’outil avec Échap', async () => {
    await mount();
    key('b');
    await flush();
    expect($('tool-barrier').getAttribute('aria-pressed')).toBe('true');
    roadClick('pointerdown', 1, 'right');
    roadClick('pointerup', 1, 'right');
    await flush();
    expect($('barrier-status').textContent).toContain('point d’arrivée');
    key('Escape');
    await flush();
    expect($('barrier-status').textContent).toContain('point de départ');
    expect($('tool-barrier').getAttribute('aria-pressed')).toBe('true');
    key('Escape');
    await flush();
    expect($('tool-select').getAttribute('aria-pressed')).toBe('true');
    expect((await saved()).barriers ?? []).toEqual([]);
  });

  it('ouvre un projet ancien sans barrières, normalise le sens de tracé et retrouve les tronçons au remontage', async () => {
    await mount();
    await openFile(createProject('mountain'));
    expect($('barrier-empty')).not.toBeNull();
    await click('tool-barrier');
    await traceBarrier(0, 3);
    await traceBarrier(5, 2);
    expect((await saved()).barriers).toEqual([
      { type: 'guardrail', side: 'right', from: 0, to: 3, offset: 1 },
      { type: 'guardrail', side: 'right', from: 2, to: 5, offset: 1 },
    ]);
    app!.unmount();
    app = null;
    await mount();
    expect(renderer.project.barriers).toHaveLength(2);
    expect($('barrier-row-0')).not.toBeNull();
    expect($('barrier-row-1')).not.toBeNull();
  });
});
