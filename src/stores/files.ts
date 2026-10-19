import { defineStore } from 'pinia';
import { onScopeDispose, ref, watch } from 'vue';
import { ProjectError } from '../core/project/errors';
import { createProject, slugify } from '../core/project/factory';
import { MAX_PROJECT_FILE_BYTES } from '../core/project/rules';
import { parseProjectFile, serializeProject } from '../core/project/schema';
import type { Template } from '../core/project/templates';
import { formatProjectError, t } from '../i18n';
import { usePlatform } from '../platform/platform';
import { useEditorStore } from './editor';
import { useProjectStore } from './project';
import { useUiStore } from './ui';
import { useViewportStore } from './viewport';

export const AUTOSAVE_KEY = 'roadbuilder.project.v2';
/** Delay between the last change and the automatic save. */
const AUTOSAVE_DELAY = 300;
const PROJECT_FILE_TYPES = ['.json', 'application/json'];

/**
 * - saved: the automatic save is up to date;
 * - pending: a save is scheduled;
 * - unavailable: the device refuses to store the project;
 * - recovery: an unreadable save could not be set aside, so it is never overwritten.
 */
export type SaveState = 'saved' | 'pending' | 'unavailable' | 'recovery';

/** Automatic save on the device, and the project files the user creates, opens and saves. */
export const useFilesStore = defineStore('files', () => {
  const platform = usePlatform();
  const store = useProjectStore();
  const editor = useEditorStore();
  const viewport = useViewportStore();
  const ui = useUiStore();
  const storage = platform.storage;

  const saveState = ref<SaveState>(storage ? 'saved' : 'unavailable');
  /** The previous automatic save existed but could not be read. */
  const restoreFailed = ref(false);
  let recoveryPending = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  /** Bumped by every document switch, so a slow file read cannot land on a newer document. */
  let generation = 0;

  // An unreadable save is copied aside before anything can overwrite it.
  let raw: string | null = null;
  try {
    raw = storage?.read(AUTOSAVE_KEY) ?? null;
    if (raw !== null) store.load(parseProjectFile(raw));
  } catch {
    restoreFailed.value = true;
    try {
      if (raw !== null) storage?.write(`${AUTOSAVE_KEY}.recovery.${Date.now()}`, raw);
    } catch {
      recoveryPending = true;
      saveState.value = 'recovery';
    }
  }
  editor.reset();

  function saveNow() {
    clearTimeout(timer);
    if (recoveryPending) return;
    try {
      if (!storage) throw new Error('No storage on this device.');
      storage.write(AUTOSAVE_KEY, serializeProject(store.project));
      saveState.value = 'saved';
    } catch {
      saveState.value = 'unavailable';
    }
  }

  watch(
    () => store.project,
    () => {
      if (recoveryPending) return;
      clearTimeout(timer);
      saveState.value = 'pending';
      timer = setTimeout(saveNow, AUTOSAVE_DELAY);
    },
  );
  onScopeDispose(() => clearTimeout(timer));

  /** Commits pending edits and saves right away, before the page goes away or loses focus. */
  function flush() {
    store.commit();
    if (saveState.value === 'pending') saveNow();
  }

  /** Shows a project that just replaced the previous one. */
  function present() {
    editor.reset();
    editor.setView('2d');
    viewport.fit();
  }

  function newProject(template: Template) {
    generation++;
    store.replace(createProject(template, t(`template.${template}`)));
    ui.closeDialog();
    present();
    ui.notify(t('toast.newProject'));
  }

  async function openProject() {
    store.commit();
    const file = await platform.pickFile(PROJECT_FILE_TYPES);
    if (!file) return;
    const current = ++generation;
    try {
      if (file.size > MAX_PROJECT_FILE_BYTES)
        throw new ProjectError({ code: 'file-too-large', maxBytes: MAX_PROJECT_FILE_BYTES });
      const project = parseProjectFile(await file.text());
      if (current !== generation) return;
      store.replace(project);
      present();
      ui.notify(t('toast.projectOpened', { name: project.name }));
    } catch (error) {
      if (current !== generation) return;
      if (!(error instanceof ProjectError)) throw error;
      ui.notify(formatProjectError(error.detail), true);
    }
  }

  async function saveProject() {
    store.commit();
    await platform.saveFile({
      name: `${slugify(store.project.name)}.roadbuilder.json`,
      type: 'application/json',
      data: serializeProject(store.project),
    });
    saveNow();
    ui.notify(t('toast.projectDownloaded'));
  }

  return { saveState, restoreFailed, flush, newProject, openProject, saveProject };
});
