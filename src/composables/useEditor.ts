import { inject, onBeforeUnmount, onMounted, provide, reactive } from 'vue';
import type { InjectionKey } from 'vue';
import { createActions } from './editor/actions';
import { createKeyboardHandler } from './editor/keyboard';
import { createSession } from './editor/session';
import { createEditorState } from './editor/state';

export type { Dialog, NumericField } from './editor/state';

export const formatNumber = (value: number, digits = 0) =>
  value.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export function createEditor() {
  const state = createEditorState();
  const session = createSession(state);
  const actions = createActions(state, session);
  const onKeydown = createKeyboardHandler(state, session, actions);

  function onBlur() {
    session.finishGesture();
    session.flushEdit();
    session.saveLocal();
  }
  function onBeforeUnload(event: BeforeUnloadEvent) {
    onBlur();
    if (state.saveState.value === 'unavailable' || state.saveState.value === 'recovery') {
      event.preventDefault();
      event.returnValue = '';
    }
  }
  onMounted(() => {
    document.addEventListener('keydown', onKeydown);
    window.addEventListener('blur', onBlur);
    window.addEventListener('pagehide', onBlur);
    window.addEventListener('beforeunload', onBeforeUnload);
    session.saveLocal();
    if (state.restoredMessage) session.toast(state.restoredMessage, true);
  });
  onBeforeUnmount(() => {
    session.markDisposed();
    onBlur();
    session.dispose();
    document.removeEventListener('keydown', onKeydown);
    window.removeEventListener('blur', onBlur);
    window.removeEventListener('pagehide', onBlur);
    window.removeEventListener('beforeunload', onBeforeUnload);
    actions.disposeDownloads();
  });
  return reactive({
    project: state.project,
    selected: state.selected,
    tool: state.tool,
    view: state.view,
    dialog: state.dialog,
    history: state.history,
    samples: state.samples,
    stats: state.stats,
    issues: state.issues,
    point: state.point,
    selectedTightTurns: state.selectedTightTurns,
    barriers: state.barriers,
    selectedBarrier: state.selectedBarrier,
    barrierDraft: state.barrierDraft,
    barrierType: state.barrierType,
    notification: state.notification,
    saveState: state.saveState,
    exportAuthor: state.exportAuthor,
    exportFormat: state.exportFormat,
    exporting: state.exporting,
    snapshot: session.snapshot,
    refresh: state.refresh,
    remember: session.remember,
    beginEdit: session.beginEdit,
    flushEdit: session.flushEdit,
    change: session.change,
    undo: session.undo,
    setNumeric: actions.setNumeric,
    setName: actions.setName,
    selectPoint: actions.selectPoint,
    selectBarrier: actions.selectBarrier,
    setBarrierType: actions.setBarrierType,
    beginBarrier: actions.beginBarrier,
    cancelBarrier: actions.cancelBarrier,
    completeBarrier: actions.completeBarrier,
    swapBarrierSide: actions.swapBarrierSide,
    deleteBarrier: actions.deleteBarrier,
    setTool: actions.setTool,
    setView: actions.setView,
    reverseTrack: actions.reverseTrack,
    deletePoint: actions.deletePoint,
    addPoint: actions.addPoint,
    downloadProject: actions.downloadProject,
    importProject: actions.importProject,
    newProject: actions.newProject,
    openDialog: actions.openDialog,
    focusTightTurn: actions.focusTightTurn,
    exportProject: actions.exportProject,
    attachRenderer: actions.attachRenderer,
    syncRenderer: actions.syncRenderer,
    toast: session.toast,
    zoom: actions.zoom,
    fit: actions.fit,
    setClosed: actions.setClosed,
    setKerbs: actions.setKerbs,
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
