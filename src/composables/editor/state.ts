import { computed, reactive, ref, shallowRef, triggerRef } from 'vue';
import { LIMITS } from '../../domain/project/limits';
import { restoreProject } from '../../domain/project/storage';
import type { ProjectStorage } from '../../domain/project/storage';
import { ProjectHistory } from '../../domain/project/history';
import { sampleTrack, trackIssues, trackStats } from '../../domain/track/geometry';
import type { BarrierDraft, BarrierType, ExportFormat, Tool, ViewMode } from '../../domain/types';
import type { ProjectField } from '../../domain/diagnostics';

export type Dialog = 'new' | 'export' | 'help' | null;
/** Numeric fields editable in the interface; the domain validates exactly this set. */
export type NumericField = ProjectField;
export type SaveState = 'saved' | 'pending' | 'unavailable' | 'recovery';
export const NUMERIC_RANGES: Record<NumericField, [number, number]> = {
  width: [4, 24],
  shoulder: [2, 20],
  terrainMargin: [50, 500],
  x: [-LIMITS.coordinate, LIMITS.coordinate],
  z: [-LIMITS.coordinate, LIMITS.coordinate],
  y: [LIMITS.minAltitude, LIMITS.maxAltitude],
  barrierOffset: [0, 10],
};

/** Reactive state of the editor, rebuilt from the last local save when available. */
export function createEditorState() {
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
  const barriers = computed(() => project.value.barriers ?? []);
  const selectedBarrier = ref(-1);
  const barrierDraft = ref<BarrierDraft | null>(null);
  const barrierType = ref<BarrierType>('guardrail');
  const notification = ref({ message: '', error: false });
  const saveState = ref<SaveState>('saved');
  const exportAuthor = ref('');
  const exportFormat = ref<ExportFormat>('ac');
  const exporting = ref(false);
  const refresh = () => triggerRef(project);
  return {
    storage,
    recoveryPending: restored.recoveryPending,
    restoredNotice: restored.notice,
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
    barriers,
    selectedBarrier,
    barrierDraft,
    barrierType,
    notification,
    saveState,
    exportAuthor,
    exportFormat,
    exporting,
    refresh,
  };
}
export type EditorState = ReturnType<typeof createEditorState>;
