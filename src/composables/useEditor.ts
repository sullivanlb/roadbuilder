import {
  computed,
  inject,
  nextTick,
  onBeforeUnmount,
  onMounted,
  provide,
  reactive,
  ref,
  shallowRef,
  triggerRef,
} from 'vue';
import type { InjectionKey } from 'vue';
import type { ExportFormat, Point, Template, Tool, ViewMode } from '../domain/types';
import { clamp, LIMITS, slugify, validateProject, createProject } from '../domain/project';
import { sampleTrack, trackIssues, trackStats } from '../domain/geometry';
import { ProjectHistory } from '../domain/history';
import { persistProject, restoreProject } from '../domain/storage';
import type { ProjectStorage } from '../domain/storage';
import { buildExport } from '../export/trackExport';
import type { TrackRenderer } from '../rendering/TrackRenderer';

export const number = (value: number, digits = 0) =>
  value.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
export type Dialog = 'new' | 'export' | 'help' | null;
export type NumericField = 'width' | 'shoulder' | 'terrainMargin' | 'x' | 'y' | 'z';
const ranges: Record<NumericField, [number, number]> = {
  width: [4, 24],
  shoulder: [2, 20],
  terrainMargin: [50, 500],
  x: [-LIMITS.coordinate, LIMITS.coordinate],
  z: [-LIMITS.coordinate, LIMITS.coordinate],
  y: [LIMITS.minAltitude, LIMITS.maxAltitude],
};
const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

export function createEditor() {
  let storage: ProjectStorage | null = null;
  try {
    storage = window.localStorage;
  } catch {
    /* Manual downloads remain available. */
  }
  const restored = restoreProject(storage);
  // Large sampled meshes remain ordinary objects; only editable state is reactive.
  const project = shallowRef(restored.project);
  const selected = ref(project.value.points.length ? 0 : -1);
  const tool = ref<Tool>(project.value.points.length ? 'select' : 'add');
  const view = ref<ViewMode>('2d');
  const dialog = ref<Dialog>(null);
  const history = reactive(new ProjectHistory());
  const samples = computed(() => sampleTrack(project.value));
  const stats = computed(() => trackStats(samples.value));
  const issues = computed(() => trackIssues(project.value, samples.value));
  const point = computed(() => project.value.points[selected.value]);
  const selectedTightTurns = computed(() =>
    issues.value.tightTurns.filter((turn) => turn.pointIndices.includes(selected.value)),
  );
  const notification = ref({ message: '', error: false });
  const saveState = ref<'saved' | 'pending' | 'unavailable' | 'recovery'>('saved');
  const exportAuthor = ref('');
  const exportFormat = ref<ExportFormat>('ac');
  const exporting = ref(false);
  let renderer: TrackRenderer | null = null;
  let inputBefore: string | null = null;
  let autosaveTimer: ReturnType<typeof setTimeout> | undefined;
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  let importGeneration = 0;
  let disposed = false;
  let endGesture: (() => void) | null = null;
  const downloads = new Map<string, ReturnType<typeof setTimeout>>();
  const snapshot = () => JSON.stringify(project.value);
  const refresh = () => triggerRef(project);

  function toast(message: string, error = false) {
    clearTimeout(toastTimer);
    notification.value = { message, error };
    toastTimer = setTimeout(
      () => {
        notification.value.message = '';
      },
      error ? 9000 : 4500,
    );
  }
  function saveLocal() {
    clearTimeout(autosaveTimer);
    saveState.value = persistProject(storage, project.value, restored.recoveryPending);
  }
  function queueSave() {
    clearTimeout(autosaveTimer);
    saveState.value = 'pending';
    autosaveTimer = setTimeout(saveLocal, 300);
  }
  function remember(before: string) {
    history.remember(before, snapshot());
    if (before !== snapshot()) queueSave();
  }
  function flushEdit() {
    if (inputBefore === null) return;
    const before = inputBefore;
    inputBefore = null;
    remember(before);
  }
  function beginEdit() {
    if (inputBefore === null) inputBefore = snapshot();
  }
  function change(action: () => void) {
    flushEdit();
    const before = snapshot();
    action();
    refresh();
    remember(before);
  }
  function undo(redo = false) {
    endGesture?.();
    flushEdit();
    const next = redo ? history.redo(snapshot()) : history.undo(snapshot());
    if (next === undefined) return;
    ++importGeneration;
    project.value = validateProject(JSON.parse(next));
    selected.value = Math.min(selected.value, project.value.points.length - 1);
    queueSave();
  }
  function setNumeric(field: NumericField, value: number) {
    if (!Number.isFinite(value)) return;
    beginEdit();
    const [min, max] = ranges[field];
    if (field === 'x' || field === 'y' || field === 'z') {
      if (!point.value) return;
      point.value[field] = clamp(value, min, max);
    } else project.value[field] = clamp(value, min, max);
    refresh();
    queueSave();
  }
  function setName(value: string) {
    beginEdit();
    project.value.name = value.trim().slice(0, 80) || 'Mon tracé';
    refresh();
    queueSave();
  }
  function selectPoint(index: number) {
    flushEdit();
    selected.value = clamp(index, -1, project.value.points.length - 1);
  }
  function setTool(next: Tool) {
    if (view.value === '3d' && next !== 'pan') setView('2d');
    tool.value = next;
  }
  function setView(mode: ViewMode) {
    endGesture?.();
    view.value = mode;
    renderer?.setMode(mode);
  }
  function reverseTrack() {
    change(() => {
      const current = point.value;
      if (project.value.closed && project.value.points.length)
        project.value.points = [
          project.value.points[0],
          ...project.value.points.slice(1).reverse(),
        ];
      else project.value.points.reverse();
      selected.value = current ? project.value.points.indexOf(current) : -1;
    });
  }
  function deletePoint() {
    if (!point.value) return;
    change(() => {
      project.value.points.splice(selected.value, 1);
      selected.value = Math.min(selected.value, project.value.points.length - 1);
    });
    if (!project.value.points.length) setTool('add');
  }
  function addPoint(p: Pick<Point, 'x' | 'z'> & { y?: number }, after = selected.value) {
    if (project.value.points.length >= LIMITS.points) {
      toast(`Maximum ${LIMITS.points} points par tracé.`, true);
      return;
    }
    const next = {
      x: clamp(p.x, -LIMITS.coordinate, LIMITS.coordinate),
      y: clamp(p.y ?? point.value?.y ?? 0, LIMITS.minAltitude, LIMITS.maxAltitude),
      z: clamp(p.z, -LIMITS.coordinate, LIMITS.coordinate),
    };
    if (project.value.points.some((p) => Math.hypot(p.x - next.x, p.z - next.z) < 2)) {
      toast('Placez ce point à au moins 2 mètres des autres.', true);
      return;
    }
    change(() => {
      const index = clamp(after + 1, 0, project.value.points.length);
      project.value.points.splice(index, 0, next);
      selected.value = index;
    });
  }
  function download(data: string | Uint8Array, filename: string, type: string) {
    const content = typeof data === 'string' ? data : new Uint8Array(data);
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    downloads.set(
      url,
      setTimeout(() => {
        URL.revokeObjectURL(url);
        downloads.delete(url);
      }, 30000),
    );
  }
  function downloadProject() {
    endGesture?.();
    flushEdit();
    download(
      JSON.stringify(project.value, null, 2),
      `${slugify(project.value.name)}.roadbuilder.json`,
      'application/json',
    );
    saveLocal();
    toast('Projet téléchargé. Gardez ce fichier pour reprendre votre travail.');
  }
  async function importProject(file: File) {
    endGesture?.();
    flushEdit();
    const generation = ++importGeneration;
    try {
      if (file.size > 1024 * 1024)
        throw new Error('Ce fichier dépasse 1 Mo. Choisissez un projet Roadbuilder JSON.');
      const loaded = validateProject(JSON.parse(await file.text()));
      if (disposed || generation !== importGeneration) return;
      change(() => {
        project.value = loaded;
        selected.value = loaded.points.length ? 0 : -1;
      });
      syncRenderer();
      renderer?.fit();
      setTool(loaded.points.length ? 'select' : 'add');
      toast(`« ${loaded.name} » est ouvert.`);
    } catch (error) {
      if (disposed || generation !== importGeneration) return;
      toast(
        error instanceof SyntaxError
          ? 'Le fichier n’est pas un JSON valide. Votre projet actuel est conservé.'
          : errorMessage(error),
        true,
      );
    }
  }
  function newProject(template: Template) {
    ++importGeneration;
    change(() => {
      project.value = createProject(template);
      selected.value = project.value.points.length ? 0 : -1;
    });
    dialog.value = null;
    syncRenderer();
    setView('2d');
    renderer?.fit();
    setTool(project.value.points.length ? 'select' : 'add');
    toast('Nouveau tracé. Ctrl+Z permet de retrouver le précédent.');
  }
  function openDialog(next: Dialog) {
    endGesture?.();
    flushEdit();
    if (next === 'export') exportAuthor.value = project.value.author;
    dialog.value = next;
  }
  async function exportProject() {
    if (exporting.value || issues.value.errors.length) return;
    exporting.value = true;
    try {
      await new Promise((resolve) => setTimeout(resolve, 40));
      if (disposed) return;
      const author = exportAuthor.value.trim().slice(0, 80);
      if (project.value.author !== author)
        change(() => {
          project.value.author = author;
        });
      const output = buildExport(project.value, exportFormat.value);
      download(output.bytes, output.filename, 'application/zip');
      dialog.value = null;
      toast(
        exportFormat.value === 'ac'
          ? 'Archive téléchargée. Le guide d’installation est dans le ZIP.'
          : 'Sources 3D téléchargées : OBJ, matériaux et textures.',
      );
    } catch (error) {
      toast(`Export impossible : ${errorMessage(error)}`, true);
    } finally {
      exporting.value = false;
    }
  }
  function syncRenderer() {
    renderer?.setProject(project.value, samples.value, selected.value, issues.value.tightTurns);
  }
  function focusTightTurn(segment: number) {
    const turn = issues.value.tightTurns.find((turn) => turn.segment === segment);
    if (!turn) return;
    openDialog(null);
    setView('2d');
    setTool('select');
    selectPoint(turn.pointIndices[0]);
    syncRenderer();
    renderer?.focus([
      samples.value[turn.sampleIndex],
      ...turn.pointIndices.map((index) => project.value.points[index]),
    ]);
    // Native dialogs restore focus when closing; focus the editor afterwards.
    void nextTick(() => renderer?.canvas.focus({ preventScroll: true }));
  }
  function attachRenderer(next: TrackRenderer | null, finish: (() => void) | null = null) {
    renderer = next;
    endGesture = finish;
    syncRenderer();
  }
  function onKeydown(event: KeyboardEvent) {
    const editing =
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName ?? '') ||
      (document.activeElement instanceof HTMLElement && document.activeElement.isContentEditable);
    const key = event.key.toLowerCase(),
      modifier = event.ctrlKey || event.metaKey;
    if (modifier && key === 's' && !dialog.value) {
      event.preventDefault();
      downloadProject();
      return;
    }
    if (editing || dialog.value) return;
    if (modifier && key === 'z') {
      event.preventDefault();
      undo(event.shiftKey);
    } else if (modifier && key === 'y') {
      event.preventDefault();
      undo(true);
    } else if (!modifier && key === 'v') setTool('select');
    else if (!modifier && key === 'a') setTool('add');
    else if (!modifier && key === 'h') setTool('pan');
    else if (!modifier && key === 'f') renderer?.fit();
    else if (key === 'delete' || key === 'backspace') {
      event.preventDefault();
      deletePoint();
    } else if (key === 'escape') setTool('select');
    else if (key === '?') openDialog('help');
  }
  function onBlur() {
    endGesture?.();
    flushEdit();
    saveLocal();
  }
  function onBeforeUnload(event: BeforeUnloadEvent) {
    onBlur();
    if (saveState.value === 'unavailable' || saveState.value === 'recovery') {
      event.preventDefault();
      event.returnValue = '';
    }
  }
  onMounted(() => {
    document.addEventListener('keydown', onKeydown);
    window.addEventListener('blur', onBlur);
    window.addEventListener('pagehide', onBlur);
    window.addEventListener('beforeunload', onBeforeUnload);
    saveLocal();
    if (restored.message) toast(restored.message, true);
  });
  onBeforeUnmount(() => {
    disposed = true;
    ++importGeneration;
    onBlur();
    clearTimeout(autosaveTimer);
    clearTimeout(toastTimer);
    document.removeEventListener('keydown', onKeydown);
    window.removeEventListener('blur', onBlur);
    window.removeEventListener('pagehide', onBlur);
    window.removeEventListener('beforeunload', onBeforeUnload);
    for (const [url, timer] of downloads) {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
    }
    downloads.clear();
  });
  return reactive({
    project,
    selected,
    tool,
    view,
    dialog,
    history,
    samples,
    stats,
    issues,
    point,
    selectedTightTurns,
    notification,
    saveState,
    exportAuthor,
    exportFormat,
    exporting,
    snapshot,
    refresh,
    remember,
    beginEdit,
    flushEdit,
    change,
    undo,
    setNumeric,
    setName,
    selectPoint,
    setTool,
    setView,
    reverseTrack,
    deletePoint,
    addPoint,
    downloadProject,
    importProject,
    newProject,
    openDialog,
    focusTightTurn,
    exportProject,
    attachRenderer,
    syncRenderer,
    toast,
    zoom: (factor: number) => renderer?.zoom(factor),
    fit: () => renderer?.fit(),
    setClosed: (closed: boolean) =>
      change(() => {
        project.value.closed = closed;
      }),
    setKerbs: (kerbs: boolean) =>
      change(() => {
        project.value.kerbs = kerbs;
      }),
  });
}
export type Editor = ReturnType<typeof createEditor>;
const editorKey: InjectionKey<Editor> = Symbol('roadbuilder-editor');
export function provideEditor() {
  const editor = createEditor();
  provide(editorKey, editor);
  return editor;
}
export function useEditor() {
  const editor = inject(editorKey);
  if (!editor) throw new Error('Éditeur non initialisé.');
  return editor;
}
