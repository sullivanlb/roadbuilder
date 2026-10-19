import { useManualRefHistory } from '@vueuse/core';
import { produce } from 'immer';
import type { Draft } from 'immer';
import { defineStore } from 'pinia';
import { computed, shallowRef } from 'vue';
import { createProject } from '../core/project/factory';
import type { Project } from '../core/project/schema';
import { sampleTrack, trackStats } from '../core/track/centerline';
import { trackIssues } from '../core/track/issues';
import { t } from '../i18n';

/** Undo steps kept for the session. */
const HISTORY_CAPACITY = 100;

/**
 * The project being edited and its undo history. The project is immutable:
 * edit() produces a new value and history entries are plain references, so a
 * change is detected by identity (see docs/adr/0002).
 */
export const useProjectStore = defineStore('project', () => {
  const project = shallowRef<Project>(createProject('club', t('template.club')));
  const history = useManualRefHistory(project, { capacity: HISTORY_CAPACITY });

  // Derived geometry, recomputed only when the project reference changes.
  const samples = computed(() => sampleTrack(project.value));
  const stats = computed(() => trackStats(samples.value));
  const issues = computed(() => trackIssues(project.value, samples.value));
  /** Position of each control point in the track, by ID. */
  const pointIndex = computed(
    () => new Map(project.value.points.map((point, index) => [point.id, index])),
  );

  const dirty = () => project.value !== history.last.value.snapshot;

  /** Records the changes made since the last commit as one undo step. */
  function commit() {
    if (dirty()) history.commit();
  }

  /**
   * Applies an editing operation. Continuous gestures (dragging, typing) pass
   * `commit: false` and call commit() once they end, so they undo in one step.
   */
  function edit<R>(recipe: (draft: Draft<Project>) => R, options: { commit?: boolean } = {}): R {
    let result!: R;
    project.value = produce(project.value, (draft) => {
      result = recipe(draft);
    });
    if (options.commit !== false) commit();
    return result;
  }

  /** Replaces the whole project as an undoable step (new project, opened file). */
  function replace(next: Project) {
    commit();
    project.value = next;
    commit();
  }

  /** Starts over from a project with an empty history (restored session). */
  function load(next: Project) {
    project.value = next;
    history.commit();
    history.clear();
  }

  function undo() {
    commit();
    history.undo();
  }

  function redo() {
    commit();
    history.redo();
  }

  return {
    project: computed(() => project.value),
    samples,
    stats,
    issues,
    pointIndex,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    edit,
    commit,
    replace,
    load,
    undo,
    redo,
  };
});
