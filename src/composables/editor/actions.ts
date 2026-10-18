import { nextTick } from 'vue';
import type { BarrierSide, BarrierType, Point, Template, Tool, ViewMode } from '../../domain/types';
import { clamp } from '../../domain/math';
import { LIMITS } from '../../domain/project/limits';
import { createProject, slugify } from '../../domain/project/factory';
import { validateProject } from '../../domain/project/validation';
import {
  DEFAULT_BARRIER_OFFSET,
  insertBarrierPoint,
  removeBarrierPoint,
  reverseBarriers,
  splitWrappingBarriers,
} from '../../domain/track/barriers';
import { buildExport } from '../../export/trackExport';
import type { TrackRenderer } from '../../rendering/TrackRenderer';
import { createDownloads } from './downloads';
import { NUMERIC_RANGES } from './state';
import type { Dialog, EditorState, NumericField } from './state';
import type { EditorSession } from './session';

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Everything the interface can ask the editor to do. */
export function createActions(state: EditorState, session: EditorSession) {
  const downloads = createDownloads();
  let renderer: TrackRenderer | null = null;

  function syncRenderer() {
    renderer?.setProject(
      state.project.value,
      state.samples.value,
      state.selected.value,
      state.issues.value.tightTurns,
      state.selectedBarrier.value,
      state.barrierDraft.value,
    );
  }
  function setTool(next: Tool) {
    if (state.view.value === '3d' && next !== 'pan') setView('2d');
    state.tool.value = next;
    if (next !== 'barrier') {
      state.barrierDraft.value = null;
      if (renderer) renderer.barrierHover = null;
    }
  }
  function setView(mode: ViewMode) {
    session.finishGesture();
    state.view.value = mode;
    renderer?.setMode(mode);
  }
  function attachRenderer(next: TrackRenderer | null, finish: (() => void) | null = null) {
    renderer = next;
    session.setEndGesture(finish);
    syncRenderer();
  }
  function focusTightTurn(segment: number) {
    const turn = state.issues.value.tightTurns.find((turn) => turn.segment === segment);
    if (!turn) return;
    openDialog(null);
    setView('2d');
    setTool('select');
    selectPoint(turn.pointIndices[0]);
    syncRenderer();
    renderer?.focus([
      state.samples.value[turn.sampleIndex],
      ...turn.pointIndices.map((index) => state.project.value.points[index]),
    ]);
    // Native dialogs restore focus when closing; focus the editor afterwards.
    void nextTick(() => renderer?.canvas.focus({ preventScroll: true }));
  }
  function setNumeric(field: NumericField, value: number) {
    if (!Number.isFinite(value)) return;
    session.beginEdit();
    const [min, max] = NUMERIC_RANGES[field];
    if (field === 'x' || field === 'y' || field === 'z') {
      if (!state.point.value) return;
      state.point.value[field] = clamp(value, min, max);
    } else if (field === 'barrierOffset') {
      const barrier = state.barriers.value[state.selectedBarrier.value];
      if (barrier) barrier.offset = clamp(value, min, max);
    } else state.project.value[field] = clamp(value, min, max);
    state.refresh();
    session.queueSave();
  }
  function setName(value: string) {
    session.beginEdit();
    state.project.value.name = value.trim().slice(0, 80) || 'Mon tracé';
    state.refresh();
    session.queueSave();
  }
  function selectPoint(index: number) {
    session.flushEdit();
    state.selected.value = clamp(index, -1, state.project.value.points.length - 1);
  }
  function selectBarrier(index: number) {
    session.flushEdit();
    state.selectedBarrier.value = clamp(index, -1, state.barriers.value.length - 1);
  }
  function setBarrierType(type: BarrierType) {
    state.barrierType.value = type;
    if (state.barrierDraft.value) {
      state.barrierDraft.value.type = type;
      return;
    }
    const barrier = state.barriers.value[state.selectedBarrier.value];
    if (barrier && barrier.type !== type)
      session.change(() => {
        barrier.type = type;
      });
  }
  function beginBarrier(index: number, side: BarrierSide) {
    if (index < 0 || index >= state.project.value.points.length) return;
    state.barrierDraft.value = { from: index, side, type: state.barrierType.value };
  }
  function cancelBarrier() {
    state.barrierDraft.value = null;
    renderer?.requestDraw();
  }
  function completeBarrier(to: number) {
    const draft = state.barrierDraft.value;
    if (!draft) return;
    if (to === draft.from) {
      session.toast('Choisissez un point d’arrivée différent du point de départ.', true);
      return;
    }
    if (state.barriers.value.length >= LIMITS.barriers) {
      session.toast(`Maximum ${LIMITS.barriers} tronçons de barrière.`, true);
      return;
    }
    let from = draft.from;
    if (!state.project.value.closed && from > to) [from, to] = [to, from];
    session.change(() => {
      const list = state.project.value.barriers ?? (state.project.value.barriers = []);
      list.push({ type: draft.type, side: draft.side, from, to, offset: DEFAULT_BARRIER_OFFSET });
      state.selectedBarrier.value = list.length - 1;
    });
    state.barrierDraft.value = null;
    session.toast('Barrière ajoutée. Échap pour terminer le tracé.');
  }
  function swapBarrierSide() {
    const barrier = state.barriers.value[state.selectedBarrier.value];
    if (!barrier) return;
    session.change(() => {
      barrier.side = barrier.side === 'right' ? 'left' : 'right';
    });
  }
  function deleteBarrier() {
    const list = state.project.value.barriers;
    const index = state.selectedBarrier.value;
    if (!list || !list[index]) return;
    session.change(() => {
      list.splice(index, 1);
    });
    state.selectedBarrier.value = Math.min(index, list.length - 1);
  }
  function reverseTrack() {
    session.change(() => {
      const current = state.point.value;
      if (state.project.value.closed && state.project.value.points.length)
        state.project.value.points = [
          state.project.value.points[0],
          ...state.project.value.points.slice(1).reverse(),
        ];
      else state.project.value.points.reverse();
      const list = state.project.value.barriers;
      if (list?.length)
        state.project.value.barriers = reverseBarriers(
          list,
          state.project.value.points.length,
          state.project.value.closed,
        );
      state.selected.value = current ? state.project.value.points.indexOf(current) : -1;
    });
  }
  function deletePoint() {
    if (!state.point.value) return;
    session.change(() => {
      const index = state.selected.value;
      state.project.value.points.splice(index, 1);
      const list = state.project.value.barriers;
      if (list?.length)
        state.project.value.barriers = removeBarrierPoint(list, index, state.project.value.closed);
      state.selected.value = Math.min(state.selected.value, state.project.value.points.length - 1);
    });
    session.clampBarrierSelection();
    if (!state.project.value.points.length) setTool('add');
  }
  function addPoint(p: Pick<Point, 'x' | 'z'> & { y?: number }, after = state.selected.value) {
    if (state.project.value.points.length >= LIMITS.points) {
      session.toast(`Maximum ${LIMITS.points} points par tracé.`, true);
      return;
    }
    const next = {
      x: clamp(p.x, -LIMITS.coordinate, LIMITS.coordinate),
      y: clamp(p.y ?? state.point.value?.y ?? 0, LIMITS.minAltitude, LIMITS.maxAltitude),
      z: clamp(p.z, -LIMITS.coordinate, LIMITS.coordinate),
    };
    if (state.project.value.points.some((p) => Math.hypot(p.x - next.x, p.z - next.z) < 2)) {
      session.toast('Placez ce point à au moins 2 mètres des autres.', true);
      return;
    }
    session.change(() => {
      const index = clamp(after + 1, 0, state.project.value.points.length);
      state.project.value.points.splice(index, 0, next);
      const list = state.project.value.barriers;
      if (list?.length) state.project.value.barriers = insertBarrierPoint(list, index);
      state.selected.value = index;
    });
  }
  function downloadProject() {
    session.finishGesture();
    session.flushEdit();
    downloads.download(
      JSON.stringify(state.project.value, null, 2),
      `${slugify(state.project.value.name)}.roadbuilder.json`,
      'application/json',
    );
    session.saveLocal();
    session.toast('Projet téléchargé. Gardez ce fichier pour reprendre votre travail.');
  }
  async function importProject(file: File) {
    session.finishGesture();
    session.flushEdit();
    const edit = session.bumpGeneration();
    try {
      if (file.size > 1024 * 1024)
        throw new Error('Ce fichier dépasse 1 Mo. Choisissez un projet Roadbuilder JSON.');
      const loaded = validateProject(JSON.parse(await file.text()));
      if (session.isStale(edit)) return;
      session.change(() => {
        state.project.value = loaded;
        state.selected.value = loaded.points.length ? 0 : -1;
        state.selectedBarrier.value = -1;
        state.barrierDraft.value = null;
      });
      syncRenderer();
      renderer?.fit();
      setTool(loaded.points.length ? 'select' : 'add');
      session.toast(`« ${loaded.name} » est ouvert.`);
    } catch (error) {
      if (session.isStale(edit)) return;
      session.toast(
        error instanceof SyntaxError
          ? 'Le fichier n’est pas un JSON valide. Votre projet actuel est conservé.'
          : errorMessage(error),
        true,
      );
    }
  }
  function newProject(template: Template) {
    session.bumpGeneration();
    session.change(() => {
      state.project.value = createProject(template);
      state.selected.value = state.project.value.points.length ? 0 : -1;
      state.selectedBarrier.value = -1;
      state.barrierDraft.value = null;
    });
    state.dialog.value = null;
    syncRenderer();
    setView('2d');
    renderer?.fit();
    setTool(state.project.value.points.length ? 'select' : 'add');
    session.toast('Nouveau tracé. Ctrl+Z permet de retrouver le précédent.');
  }
  function openDialog(next: Dialog) {
    session.finishGesture();
    session.flushEdit();
    if (next === 'export') state.exportAuthor.value = state.project.value.author;
    state.dialog.value = next;
  }
  async function exportProject() {
    if (state.exporting.value || state.issues.value.errors.length) return;
    state.exporting.value = true;
    try {
      await new Promise((resolve) => setTimeout(resolve, 40));
      if (session.isDisposed()) return;
      const author = state.exportAuthor.value.trim().slice(0, 80);
      if (state.project.value.author !== author)
        session.change(() => {
          state.project.value.author = author;
        });
      const output = buildExport(state.project.value, state.exportFormat.value);
      downloads.download(output.bytes, output.filename, 'application/zip');
      state.dialog.value = null;
      session.toast(
        state.exportFormat.value === 'ac'
          ? 'Archive téléchargée. Le guide d’installation est dans le ZIP.'
          : 'Sources 3D téléchargées : OBJ, matériaux et textures.',
      );
    } catch (error) {
      session.toast(`Export impossible : ${errorMessage(error)}`, true);
    } finally {
      state.exporting.value = false;
    }
  }
  function setClosed(closed: boolean) {
    session.change(() => {
      state.project.value.closed = closed;
      const list = state.project.value.barriers;
      if (!closed && list?.length)
        state.project.value.barriers = splitWrappingBarriers(
          list,
          state.project.value.points.length,
        );
    });
  }
  function setKerbs(kerbs: boolean) {
    session.change(() => {
      state.project.value.kerbs = kerbs;
    });
  }
  return {
    syncRenderer,
    setTool,
    setView,
    attachRenderer,
    focusTightTurn,
    setNumeric,
    setName,
    selectPoint,
    selectBarrier,
    setBarrierType,
    beginBarrier,
    cancelBarrier,
    completeBarrier,
    swapBarrierSide,
    deleteBarrier,
    reverseTrack,
    deletePoint,
    addPoint,
    downloadProject,
    importProject,
    newProject,
    openDialog,
    exportProject,
    setClosed,
    setKerbs,
    zoom: (factor: number) => renderer?.zoom(factor),
    fit: () => renderer?.fit(),
    disposeDownloads: downloads.dispose,
  };
}
export type EditorActions = ReturnType<typeof createActions>;
