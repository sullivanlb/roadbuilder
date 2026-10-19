import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import type { Id } from '../core/ids';
import type { Vec3 } from '../core/math';
import {
  addBarrier,
  barrierRejection,
  insertPoint,
  opposite,
  pointRejection,
  removeBarrier,
  removePoint,
  setPitLane,
  updateBarrier,
} from '../core/project/edits';
import { RULES } from '../core/project/rules';
import { isCircuit } from '../core/project/schema';
import type { BarrierType, Side } from '../core/project/schema';
import { trackLength } from '../core/track/centerline';
import { LAYOUT } from '../core/track/layout';
import { positionAt } from '../core/track/positions';
import { t } from '../i18n';
import { useProjectStore } from './project';
import { useUiStore } from './ui';

export type ToolId = 'select' | 'add' | 'barrier' | 'pits' | 'pan';
export type ViewMode = '2d' | '3d';

/** A barrier being laid: its first click is done, the second is awaited. */
export interface BarrierDraft {
  from: Id;
  side: Side;
}

/** Where the pointer rests on the roadway while laying a barrier. */
export interface RoadTarget {
  pointId: Id;
  side: Side;
}

/** A place on the road and the side it points at, as a track distance. */
export interface RoadSpot {
  s: number;
  side: Side;
}

/** What the user is doing: active tool and view, selection, barrier being laid, hover. */
export const useEditorStore = defineStore('editor', () => {
  const store = useProjectStore();
  const ui = useUiStore();

  const tool = ref<ToolId>(store.project.points.length ? 'select' : 'add');
  const view = ref<ViewMode>('2d');
  const selectedPointId = ref<Id | null>(store.project.points[0]?.id ?? null);
  const selectedBarrierId = ref<Id | null>(null);
  const barrierType = ref<BarrierType>('guardrail');
  const barrierDraft = ref<BarrierDraft | null>(null);
  const hoveredPointId = ref<Id | null>(null);
  const roadTarget = ref<RoadTarget | null>(null);
  /** Entry of the pit lane being laid; the exit click is awaited. */
  const pitDraft = ref<RoadSpot | null>(null);
  const pitTarget = ref<RoadSpot | null>(null);

  const selectedIndex = computed(() =>
    selectedPointId.value === null ? -1 : (store.pointIndex.get(selectedPointId.value) ?? -1),
  );
  const selectedPoint = computed(() => store.project.points[selectedIndex.value]);
  const selectedBarrier = computed(() =>
    store.project.barriers.find((barrier) => barrier.id === selectedBarrierId.value),
  );
  /** Located issues around the selected control point. */
  const selectedIssues = computed(() =>
    store.issues.locations.filter(
      (location) =>
        selectedPointId.value !== null && location.pointIds.includes(selectedPointId.value),
    ),
  );

  // Undo, redo or an opened file can remove what was selected or being laid.
  watch(
    () => store.project,
    (project) => {
      const exists = (id: Id | null) => id !== null && store.pointIndex.has(id);
      if (selectedPointId.value !== null && !exists(selectedPointId.value))
        selectedPointId.value = null;
      if (!project.barriers.some((barrier) => barrier.id === selectedBarrierId.value))
        selectedBarrierId.value = null;
      if (barrierDraft.value && !exists(barrierDraft.value.from)) barrierDraft.value = null;
      if (!isCircuit(project)) pitDraft.value = null;
    },
  );

  function setTool(next: ToolId) {
    if (view.value === '3d' && next !== 'pan') view.value = '2d';
    tool.value = next;
    if (next !== 'barrier') {
      barrierDraft.value = null;
      roadTarget.value = null;
    }
    if (next !== 'pits') {
      pitDraft.value = null;
      pitTarget.value = null;
    }
  }

  function setView(next: ViewMode) {
    store.commit();
    view.value = next;
  }

  /** Starts a new document: first point selected, the right tool for an empty track. */
  function reset() {
    selectedPointId.value = store.project.points[0]?.id ?? null;
    selectedBarrierId.value = null;
    barrierDraft.value = null;
    pitDraft.value = null;
    setTool(store.project.points.length ? 'select' : 'add');
  }

  function selectPoint(id: Id | null) {
    store.commit();
    selectedPointId.value = id;
  }

  /** Selects the control point at a position in the track (clamped). */
  function selectPointAt(index: number) {
    const points = store.project.points;
    if (points.length) selectPoint(points[Math.max(0, Math.min(points.length - 1, index))].id);
  }

  function selectBarrier(id: Id | null) {
    store.commit();
    selectedBarrierId.value = id;
  }

  /** Adds a control point after `index` (by default after the selection) and selects it. */
  function addPoint(at: Pick<Vec3, 'x' | 'z'> & { y?: number }, after = selectedIndex.value) {
    const rejection = pointRejection(store.project, at);
    if (rejection === 'points-limit')
      return ui.notify(t('toast.pointsLimit', { max: RULES.points.max }), true);
    if (rejection === 'too-close')
      return ui.notify(t('toast.pointTooClose', { min: RULES.pointSpacing }), true);
    const y = at.y ?? selectedPoint.value?.y ?? 0;
    selectedPointId.value = store.edit((draft) => insertPoint(draft, after + 1, { ...at, y }));
  }

  function deleteSelectedPoint() {
    const id = selectedPointId.value;
    if (id === null || !selectedPoint.value) return;
    const index = selectedIndex.value;
    store.edit((draft) => removePoint(draft, id));
    const points = store.project.points;
    selectedPointId.value = points[Math.min(index, points.length - 1)]?.id ?? null;
    if (!points.length) setTool('add');
  }

  function beginBarrier(target: RoadTarget) {
    barrierDraft.value = { from: target.pointId, side: target.side };
  }

  function cancelBarrier() {
    barrierDraft.value = null;
  }

  function completeBarrier(to: Id) {
    const draft = barrierDraft.value;
    if (!draft) return;
    const rejection = barrierRejection(store.project, draft.from, to);
    if (rejection === 'same-point') return ui.notify(t('toast.barrierSamePoint'), true);
    if (rejection === 'barriers-limit')
      return ui.notify(t('toast.barriersLimit', { max: RULES.barriers.max }), true);
    selectedBarrierId.value = store.edit((project) =>
      addBarrier(project, { type: barrierType.value, side: draft.side, from: draft.from, to }),
    );
    barrierDraft.value = null;
    ui.notify(t('toast.barrierAdded'));
  }

  /** First click of the pit lane: its entry. Pits only exist on circuits. */
  function beginPitLane(spot: RoadSpot) {
    if (!isCircuit(store.project)) return ui.notify(t('pits.roadOnly'), true);
    pitDraft.value = spot;
  }

  function cancelPitLane() {
    pitDraft.value = null;
  }

  /** Second click: the exit. The lane runs from the entry to the exit in track direction. */
  function completePitLane(exit: number) {
    const draft = pitDraft.value;
    if (!draft) return;
    const total = trackLength(store.samples);
    const length = (((exit - draft.s) % total) + total) % total;
    if (length < 2 * LAYOUT.pitLane.taper) return ui.notify(t('toast.pitLaneSamePlace'), true);
    store.edit((project) =>
      setPitLane(project, {
        side: draft.side,
        entry: positionAt(store.project, store.samples, draft.s),
        exit: positionAt(store.project, store.samples, exit),
      }),
    );
    pitDraft.value = null;
    setTool('select');
    ui.notify(t('toast.pitLaneAdded'));
  }

  /** Chooses the type of the next barrier, and of the selected one if any. */
  function setBarrierType(type: BarrierType) {
    barrierType.value = type;
    const barrier = selectedBarrier.value;
    if (!barrierDraft.value && barrier && barrier.type !== type)
      store.edit((draft) => updateBarrier(draft, barrier.id, { type }));
  }

  function swapSelectedBarrierSide() {
    const barrier = selectedBarrier.value;
    if (barrier)
      store.edit((draft) => updateBarrier(draft, barrier.id, { side: opposite(barrier.side) }));
  }

  function deleteSelectedBarrier() {
    const barrier = selectedBarrier.value;
    if (!barrier) return;
    const barriers = store.project.barriers;
    const index = barriers.indexOf(barrier);
    store.edit((draft) => removeBarrier(draft, barrier.id));
    selectedBarrierId.value =
      store.project.barriers[Math.min(index, barriers.length - 2)]?.id ?? null;
  }

  return {
    tool,
    view,
    selectedPointId,
    selectedBarrierId,
    barrierType,
    barrierDraft,
    hoveredPointId,
    roadTarget,
    pitDraft,
    pitTarget,
    selectedIndex,
    selectedPoint,
    selectedBarrier,
    selectedIssues,
    setTool,
    setView,
    reset,
    selectPoint,
    selectPointAt,
    selectBarrier,
    addPoint,
    deleteSelectedPoint,
    beginBarrier,
    cancelBarrier,
    completeBarrier,
    beginPitLane,
    cancelPitLane,
    completePitLane,
    setBarrierType,
    swapSelectedBarrierSide,
    deleteSelectedBarrier,
  };
});
