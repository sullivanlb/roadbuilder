import type { EditorActions } from './actions';
import type { EditorSession } from './session';
import type { EditorState } from './state';

/** Global shortcuts; ignored while a form control or a dialog has focus. */
export function createKeyboardHandler(
  state: EditorState,
  session: EditorSession,
  actions: EditorActions,
) {
  return function onKeydown(event: KeyboardEvent) {
    const editing =
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName ?? '') ||
      (document.activeElement instanceof HTMLElement && document.activeElement.isContentEditable);
    const key = event.key.toLowerCase(),
      modifier = event.ctrlKey || event.metaKey;
    if (modifier && key === 's' && !state.dialog.value) {
      event.preventDefault();
      actions.downloadProject();
      return;
    }
    if (editing || state.dialog.value) return;
    if (modifier && key === 'z') {
      event.preventDefault();
      session.undo(event.shiftKey);
    } else if (modifier && key === 'y') {
      event.preventDefault();
      session.undo(true);
    } else if (!modifier && key === 'v') actions.setTool('select');
    else if (!modifier && key === 'a') actions.setTool('add');
    else if (!modifier && key === 'b') actions.setTool('barrier');
    else if (!modifier && key === 'h') actions.setTool('pan');
    else if (!modifier && key === 'f') actions.fit();
    else if (key === 'delete' || key === 'backspace') {
      event.preventDefault();
      actions.deletePoint();
    } else if (key === 'escape') {
      if (state.barrierDraft.value) actions.cancelBarrier();
      else actions.setTool('select');
    } else if (key === '?') actions.openDialog('help');
  };
}
