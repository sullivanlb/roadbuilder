import { useEventListener } from '@vueuse/core';
import { useEditorStore } from '../stores/editor';
import type { ToolId } from '../stores/editor';
import { useFilesStore } from '../stores/files';
import { useProjectStore } from '../stores/project';
import { useUiStore } from '../stores/ui';
import { useViewportStore } from '../stores/viewport';
import { isTyping } from './focus';

interface Shortcut {
  key: string;
  /** Ctrl, or Cmd on macOS. */
  mod?: boolean;
  /** Whether Shift must be held; `any` ignores it (keys typed with Shift on some layouts). */
  shift?: boolean | 'any';
  /** Also active while typing in a field. */
  global?: boolean;
  run(): void;
}

/** Keyboard shortcuts of the editor, ignored while a dialog is open. */
export function useShortcuts() {
  const project = useProjectStore();
  const editor = useEditorStore();
  const viewport = useViewportStore();
  const files = useFilesStore();
  const ui = useUiStore();
  const tool = (id: ToolId) => () => editor.setTool(id);

  const shortcuts: Shortcut[] = [
    { key: 's', mod: true, global: true, run: () => void files.saveProject() },
    { key: 'z', mod: true, run: project.undo },
    { key: 'z', mod: true, shift: true, run: project.redo },
    { key: 'y', mod: true, run: project.redo },
    { key: 'v', run: tool('select') },
    { key: 'a', run: tool('add') },
    { key: 'b', run: tool('barrier') },
    { key: 'p', run: tool('pits') },
    { key: 'l', run: tool('width') },
    { key: 'h', run: tool('pan') },
    { key: 'f', run: viewport.fit },
    { key: 'delete', run: editor.deleteSelectedPoint },
    { key: 'backspace', run: editor.deleteSelectedPoint },
    {
      key: 'escape',
      run: () => {
        if (editor.barrierDraft) editor.cancelBarrier();
        else if (editor.pitDraft) editor.cancelPitLane();
        else if (editor.widthDraft !== null) editor.cancelWidthZone();
        else editor.setTool('select');
      },
    },
    { key: '?', shift: 'any', run: () => ui.openDialog('help') },
  ];

  useEventListener(document, 'keydown', (event: KeyboardEvent) => {
    if (ui.dialog) return;
    const key = event.key.toLowerCase(),
      mod = event.ctrlKey || event.metaKey;
    const shortcut = shortcuts.find(
      (candidate) =>
        candidate.key === key &&
        !!candidate.mod === mod &&
        (candidate.shift === 'any' || (candidate.shift ?? false) === event.shiftKey) &&
        (candidate.global || !isTyping()),
    );
    if (!shortcut) return;
    event.preventDefault();
    shortcut.run();
  });
}
