import { persistProject } from '../../domain/project/storage';
import { validateProject } from '../../domain/project/validation';
import type { EditorState } from './state';

type Timer = ReturnType<typeof setTimeout>;

/**
 * Editing session: undo history, debounced autosave and transient notifications.
 * Import generations let asynchronous imports drop their result when the
 * document moved on (undo, another import, a new project, unmount).
 */
export function createSession(state: EditorState) {
  let inputBefore: string | null = null;
  let autosaveTimer: Timer | undefined;
  let toastTimer: Timer | undefined;
  let generation = 0;
  let disposed = false;
  let endGesture: (() => void) | null = null;
  const snapshot = () => JSON.stringify(state.project.value);

  function toast(message: string, error = false) {
    clearTimeout(toastTimer);
    state.notification.value = { message, error };
    toastTimer = setTimeout(
      () => {
        state.notification.value.message = '';
      },
      error ? 9000 : 4500,
    );
  }
  function saveLocal() {
    clearTimeout(autosaveTimer);
    state.saveState.value = persistProject(
      state.storage,
      state.project.value,
      state.recoveryPending,
    );
  }
  function queueSave() {
    clearTimeout(autosaveTimer);
    state.saveState.value = 'pending';
    autosaveTimer = setTimeout(saveLocal, 300);
  }
  function clampBarrierSelection() {
    state.selectedBarrier.value = Math.min(
      state.selectedBarrier.value,
      (state.project.value.barriers?.length ?? 0) - 1,
    );
  }
  function remember(before: string) {
    state.history.remember(before, snapshot());
    if (before !== snapshot()) queueSave();
  }
  function beginEdit() {
    if (inputBefore === null) inputBefore = snapshot();
  }
  function flushEdit() {
    if (inputBefore === null) return;
    const before = inputBefore;
    inputBefore = null;
    remember(before);
  }
  function change(action: () => void) {
    flushEdit();
    const before = snapshot();
    action();
    state.refresh();
    remember(before);
  }
  function undo(redo = false) {
    finishGesture();
    flushEdit();
    const next = redo ? state.history.redo(snapshot()) : state.history.undo(snapshot());
    if (next === undefined) return;
    ++generation;
    state.project.value = validateProject(JSON.parse(next));
    state.selected.value = Math.min(state.selected.value, state.project.value.points.length - 1);
    state.barrierDraft.value = null;
    clampBarrierSelection();
    queueSave();
  }
  function finishGesture() {
    endGesture?.();
  }
  function bumpGeneration() {
    return ++generation;
  }
  function isStale(edit: number) {
    return disposed || edit !== generation;
  }
  function isDisposed() {
    return disposed;
  }
  function markDisposed() {
    disposed = true;
    ++generation;
  }
  function dispose() {
    clearTimeout(autosaveTimer);
    clearTimeout(toastTimer);
  }
  return {
    snapshot,
    toast,
    saveLocal,
    queueSave,
    remember,
    beginEdit,
    flushEdit,
    change,
    undo,
    clampBarrierSelection,
    setEndGesture: (finish: (() => void) | null) => {
      endGesture = finish;
    },
    finishGesture,
    bumpGeneration,
    isStale,
    isDisposed,
    markDisposed,
    dispose,
  };
}
export type EditorSession = ReturnType<typeof createSession>;
