import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import type { Id } from '../core/ids';
import type { Vec3 } from '../core/math';
import {
  addBarrier,
  addWidthZone,
  barrierRejection,
  insertPoint,
  opposite,
  pointRejection,
  removeBarrier,
  removePoint,
  removeWidthZone,
  setPitLane,
  updateBarrier,
  widthZoneRejection,
} from '../core/project/edits';
import { RULES } from '../core/project/rules';
import { isCircuit } from '../core/project/schema';
import type { BarrierType, Side } from '../core/project/schema';
import { trackLength } from '../core/track/centerline';
import { LAYOUT } from '../core/track/layout';
import { positionAt } from '../core/track/positions';
import { pointDistance } from '../core/track/positions';
import { rangeBetween, rangeContains } from '../core/track/ranges';
import type { TrackRange } from '../core/track/ranges';
import { LAYERS, layerOfSelection, layerOfTool } from '../editor/layers';
import type { LayerId, Selection } from '../editor/layers';
import { t } from '../i18n';
import { useProjectStore } from './project';
import { useUiStore } from './ui';

export type ToolId = 'select' | 'add' | 'barrier' | 'pits' | 'width' | 'pan';
export type ViewMode = '2d' | '3d';

/** A place on the road and the side it points at, as a track distance. */
export interface RoadSpot {
  s: number;
  side: Side;
}

/** What the user is doing: active layer, tool and view, selection, what is being laid, hover. */
export const useEditorStore = defineStore('editor', () => {
  const store = useProjectStore();
  const ui = useUiStore();

  const layer = ref<LayerId>('track');
  /** Layers hidden on the plan and in the preview. */
  const hiddenLayers = ref<LayerId[]>([]);
  const tool = ref<ToolId>(store.project.points.length ? 'select' : 'add');
  const view = ref<ViewMode>('2d');
  const firstPoint = (): Selection => {
    const first = store.project.points[0];
    return first ? { kind: 'points', ids: [first.id] } : null;
  };
  const selection = ref<Selection>(firstPoint());
  const barrierType = ref<BarrierType>('guardrail');
  /** First click of the barrier being laid: where it starts, on which side. */
  const barrierDraft = ref<RoadSpot | null>(null);
  const hoveredPointId = ref<Id | null>(null);
  /** Track distance where the next barrier click would land. */
  const barrierTarget = ref<number | null>(null);
  /** Entry of the pit lane being laid; the exit click is awaited. */
  const pitDraft = ref<RoadSpot | null>(null);
  const pitTarget = ref<RoadSpot | null>(null);
  /** Track distance under the pointer, on the plan, the band or the preview. */
  const hoverS = ref<number | null>(null);
  /** A stretch picked in the band, waiting for something to be laid on it. */
  const range = ref<TrackRange | null>(null);
  /** Track distance of the first click of the width zone being laid; the second is awaited. */
  const widthDraft = ref<number | null>(null);
  const widthTarget = ref<number | null>(null);

  const selected = <K extends NonNullable<Selection>['kind']>(kind: K) =>
    computed(() => {
      const current = selection.value;
      return current?.kind === kind ? (current as Extract<Selection, { kind: K }>) : null;
    });
  const selectedPoints = selected('points');
  /** The selected control point, when the selection holds points. */
  const selectedPointId = computed(() => selectedPoints.value?.ids[0] ?? null);
  const selectedBarrierId = computed(() => selected('barrier').value?.id ?? null);
  const selectedWidthZoneId = computed(() => selected('widthZone').value?.id ?? null);
  const selectedIndex = computed(() =>
    selectedPointId.value === null ? -1 : (store.pointIndex.get(selectedPointId.value) ?? -1),
  );
  const selectedPoint = computed(() => store.project.points[selectedIndex.value]);
  const selectedBarrier = computed(() =>
    store.project.barriers.find((barrier) => barrier.id === selectedBarrierId.value),
  );
  const selectedWidthZone = computed(() =>
    store.project.widthZones.find((zone) => zone.id === selectedWidthZoneId.value),
  );
  /** Located issues around the selected control point. */
  const selectedIssues = computed(() =>
    store.issues.locations.filter(
      (location) =>
        selectedPointId.value !== null && location.pointIds.includes(selectedPointId.value),
    ),
  );

  /** What is left of a selection in the current project. */
  function stillThere(current: Selection): Selection {
    const project = store.project;
    switch (current?.kind) {
      case 'points': {
        const ids = current.ids.filter((id) => store.pointIndex.has(id));
        return ids.length === current.ids.length
          ? current
          : ids.length
            ? { kind: 'points', ids }
            : null;
      }
      case 'barrier':
        return project.barriers.some((b) => b.id === current.id) ? current : null;
      case 'widthZone':
        return project.widthZones.some((z) => z.id === current.id) ? current : null;
      case 'pitLane':
        return project.pitLane ? current : null;
      case undefined:
        return null;
    }
  }

  // Undo, redo or an opened file can remove what was selected or being laid.
  watch(
    () => store.project,
    (project) => {
      const left = stillThere(selection.value);
      if (left !== selection.value) selection.value = left;
      if (!isCircuit(project)) pitDraft.value = null;
    },
  );

  /** Each layer keeps its selection while another one is edited. */
  const remembered = new Map<LayerId, Selection>();

  function clearDrafts() {
    barrierDraft.value = null;
    barrierTarget.value = null;
    pitDraft.value = null;
    pitTarget.value = null;
    widthDraft.value = null;
    widthTarget.value = null;
  }

  /** Works on another layer: its tools, its elements, and what was selected in it before. */
  function setLayer(next: LayerId) {
    if (layer.value === next) return;
    store.commit();
    remembered.set(layer.value, selection.value);
    layer.value = next;
    selection.value = stillThere(remembered.get(next) ?? null);
    clearDrafts();
    if (layerOfTool(tool.value) !== null) tool.value = 'select';
  }

  function toggleLayer(id: LayerId) {
    hiddenLayers.value = hiddenLayers.value.includes(id)
      ? hiddenLayers.value.filter((hidden) => hidden !== id)
      : [...hiddenLayers.value, id];
  }

  /** Picks a tool; one that belongs to another layer moves to that layer first. */
  function setTool(next: ToolId) {
    if (view.value === '3d' && next !== 'pan') view.value = '2d';
    const home = layerOfTool(next);
    if (home) setLayer(home);
    tool.value = next;
    if (next !== 'barrier') {
      barrierDraft.value = null;
      barrierTarget.value = null;
    }
    if (next !== 'pits') {
      pitDraft.value = null;
      pitTarget.value = null;
    }
    if (next !== 'width') {
      widthDraft.value = null;
      widthTarget.value = null;
    }
  }

  function setView(next: ViewMode) {
    store.commit();
    view.value = next;
  }

  /** Starts a new document: on the track layer, first point selected, the right tool for an empty track. */
  function reset() {
    layer.value = 'track';
    remembered.clear();
    clearDrafts();
    setTool(store.project.points.length ? 'select' : 'add');
    selection.value = firstPoint();
  }

  /** Selects something, moving to its layer if need be; null clears the selection. */
  function select(next: Selection) {
    store.commit();
    const home = layerOfSelection(next);
    if (home) setLayer(home);
    selection.value = next;
    if (next) range.value = null;
  }

  function setRange(next: TrackRange | null) {
    store.commit();
    range.value = next;
  }

  /** Tells why something cannot be laid; returns false for the caller to stop. */
  const refuse = (message: string) => {
    ui.notify(message, true);
    return false;
  };

  /** The two track positions bounding a range. */
  const rangeEnds = (stretch: TrackRange) => ({
    from: positionAt(store.project, store.samples, stretch.start),
    to: positionAt(store.project, store.samples, stretch.start + stretch.length),
  });

  /** Lays a barrier over a stretch and selects it; false when it is refused. */
  function layBarrier(stretch: TrackRange, side: Side): boolean {
    const rejection = barrierRejection(store.project, stretch);
    if (rejection === 'too-short')
      return refuse(t('toast.barrierTooShort', { min: RULES.rangeLength }));
    if (rejection === 'barriers-limit')
      return refuse(t('toast.barriersLimit', { max: RULES.barriers.max }));
    const id = store.edit((project) =>
      addBarrier(project, { type: barrierType.value, side, ...rangeEnds(stretch) }),
    );
    selection.value = { kind: 'barrier', id };
    return true;
  }

  /** Lays a width zone over a stretch and selects it; false when it is refused. */
  function layWidthZone(stretch: TrackRange): boolean {
    const rejection = widthZoneRejection(store.project, store.samples, stretch);
    if (rejection === 'width-zones-limit')
      return refuse(t('toast.widthZonesLimit', { max: RULES.widthZones.max }));
    if (rejection === 'too-short')
      return refuse(t('toast.widthZoneTooShort', { min: RULES.rangeLength }));
    if (rejection === 'overlap') return refuse(t('toast.widthZoneOverlap'));
    const id = store.edit((project) => addWidthZone(project, rangeEnds(stretch)));
    selection.value = { kind: 'widthZone', id };
    return true;
  }

  /** Lays the pit lane over a stretch, entry first; false when it is refused. */
  function layPitLane(stretch: TrackRange, side: Side): boolean {
    if (!isCircuit(store.project)) return refuse(t('pits.roadOnly'));
    if (stretch.length < 2 * LAYOUT.pitLane.taper) return refuse(t('toast.pitLaneSamePlace'));
    const ends = rangeEnds(stretch);
    store.edit((project) => setPitLane(project, { side, entry: ends.from, exit: ends.to }));
    selection.value = { kind: 'pitLane' };
    return true;
  }

  /** Selects the control points inside the picked stretch. */
  function selectPointsInRange() {
    const stretch = range.value;
    if (!stretch) return;
    const total = trackLength(store.samples);
    const ids = store.project.points
      .filter((_, i) => rangeContains(stretch, total, pointDistance(store.samples, i)))
      .map((point) => point.id);
    select(ids.length ? { kind: 'points', ids } : null);
  }

  function widthZoneOnRange() {
    if (range.value && layWidthZone(range.value)) {
      range.value = null;
      ui.notify(t('toast.widthZoneAdded'));
    }
  }

  function barriersOnRange(sides: Side[]) {
    const stretch = range.value;
    if (stretch && sides.every((side) => layBarrier(stretch, side))) {
      range.value = null;
      ui.notify(t('toast.barrierAdded'));
    }
  }

  function pitLaneOnRange() {
    if (range.value && layPitLane(range.value, store.project.pitLane?.side ?? 'right')) {
      range.value = null;
      ui.notify(t('toast.pitLaneAdded'));
    }
  }

  const selectPoint = (id: Id | null) => select(id ? { kind: 'points', ids: [id] } : null);

  /** Selects the control point at a position in the track (clamped). */
  function selectPointAt(index: number) {
    const points = store.project.points;
    if (points.length) selectPoint(points[Math.max(0, Math.min(points.length - 1, index))].id);
  }

  const selectBarrier = (id: Id | null) => select(id ? { kind: 'barrier', id } : null);
  const selectWidthZone = (id: Id | null) => select(id ? { kind: 'widthZone', id } : null);

  /** Adds a control point after `index` (by default after the selection) and selects it. */
  function addPoint(at: Pick<Vec3, 'x' | 'z'> & { y?: number }, after = selectedIndex.value) {
    const rejection = pointRejection(store.project, at);
    if (rejection === 'points-limit')
      return ui.notify(t('toast.pointsLimit', { max: RULES.points.max }), true);
    if (rejection === 'too-close')
      return ui.notify(t('toast.pointTooClose', { min: RULES.pointSpacing }), true);
    const y = at.y ?? selectedPoint.value?.y ?? 0;
    const id = store.edit((draft) => insertPoint(draft, after + 1, { ...at, y }));
    selection.value = { kind: 'points', ids: [id] };
  }

  function deleteSelectedPoint() {
    const id = selectedPointId.value;
    if (id === null || !selectedPoint.value) return;
    const index = selectedIndex.value;
    store.edit((draft) => removePoint(draft, id));
    const points = store.project.points;
    const next = points[Math.min(index, points.length - 1)];
    selection.value = next ? { kind: 'points', ids: [next.id] } : null;
    if (!points.length) setTool('add');
  }

  function beginBarrier(spot: RoadSpot) {
    barrierDraft.value = spot;
  }

  function cancelBarrier() {
    barrierDraft.value = null;
  }

  /** Second click: the other end. The barrier covers the stretch between the two clicks. */
  function completeBarrier(s: number) {
    const draft = barrierDraft.value;
    if (!draft) return;
    if (!layBarrier(rangeBetween(store.project, store.samples, draft.s, s), draft.side)) return;
    barrierDraft.value = null;
    barrierTarget.value = null;
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
    if (!layPitLane({ start: draft.s, length }, draft.side)) return;
    pitDraft.value = null;
    setTool('select');
    ui.notify(t('toast.pitLaneAdded'));
  }

  /** First click of a width zone: one end. */
  function beginWidthZone(s: number) {
    widthDraft.value = s;
  }

  function cancelWidthZone() {
    widthDraft.value = null;
  }

  /** Second click: the other end. The zone covers the stretch between the two clicks. */
  function completeWidthZone(s: number) {
    const first = widthDraft.value;
    if (first === null) return;
    if (!layWidthZone(rangeBetween(store.project, store.samples, first, s))) return;
    widthDraft.value = null;
    widthTarget.value = null;
    ui.notify(t('toast.widthZoneAdded'));
  }

  function deleteSelectedWidthZone() {
    const zone = selectedWidthZone.value;
    if (!zone) return;
    const zones = store.project.widthZones;
    const index = zones.indexOf(zone);
    store.edit((draft) => removeWidthZone(draft, zone.id));
    selectWidthZone(store.project.widthZones[Math.min(index, zones.length - 2)]?.id ?? null);
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
    selectBarrier(store.project.barriers[Math.min(index, barriers.length - 2)]?.id ?? null);
  }

  return {
    layer,
    hiddenLayers,
    layers: LAYERS,
    hoverS,
    range,
    tool,
    view,
    selection,
    selectedPoints,
    selectedPointId,
    selectedBarrierId,
    barrierType,
    barrierDraft,
    hoveredPointId,
    barrierTarget,
    pitDraft,
    pitTarget,
    selectedWidthZoneId,
    widthDraft,
    widthTarget,
    selectedIndex,
    selectedPoint,
    selectedBarrier,
    selectedWidthZone,
    selectedIssues,
    setLayer,
    toggleLayer,
    setTool,
    setView,
    reset,
    select,
    setRange,
    selectPointsInRange,
    widthZoneOnRange,
    barriersOnRange,
    pitLaneOnRange,
    selectPoint,
    selectPointAt,
    selectBarrier,
    selectWidthZone,
    addPoint,
    deleteSelectedPoint,
    beginBarrier,
    cancelBarrier,
    completeBarrier,
    beginPitLane,
    cancelPitLane,
    completePitLane,
    beginWidthZone,
    cancelWidthZone,
    completeWidthZone,
    deleteSelectedWidthZone,
    setBarrierType,
    swapSelectedBarrierSide,
    deleteSelectedBarrier,
  };
});
