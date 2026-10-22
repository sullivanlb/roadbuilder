import { defineStore } from 'pinia';
import { computed, ref, shallowRef, watch } from 'vue';
import type { Id } from '../core/ids';
import type { PlanPoint, Vec3 } from '../core/math';
import {
  addArc,
  addBankZone,
  addBarrier,
  addEarthwork,
  addHill,
  addScenery,
  arcRejection,
  addWidthZone,
  bankZoneRejection,
  barrierRejection,
  duplicateScenery,
  earthworkRejection,
  hillRejection,
  insertPoint,
  opposite,
  pointRejection,
  removeBankZone,
  removeBarrier,
  removeEarthwork,
  removeHill,
  removePoint,
  removePoints,
  removeScenery,
  sceneryRejection,
  setAltitude,
  shiftAltitude,
  removeWidthZone,
  setPitLane,
  setStraight,
  updateBarrier,
  updateEarthwork,
  updateScenery,
  widthZoneRejection,
  clearSculpt,
  setSculpt,
} from '../core/project/edits';
import { RULES } from '../core/project/rules';
import { facingTrack, newScenery } from '../core/project/scenery';
import { EARTHWORK_TYPES, isCircuit, SCENERY_KINDS } from '../core/project/schema';
import type {
  BarrierType,
  EarthworkType,
  Hill,
  SceneryItem,
  SceneryKind,
  Side,
} from '../core/project/schema';
import { HILL_DEFAULTS } from '../core/project/terrain';
import { SculptField } from '../core/project/sculpt';
import type { BrushMode } from '../core/project/sculpt';
import { groundModel } from '../core/scene/ground';
import type { GroundModel } from '../core/scene/ground';
import { outsideOf } from '../core/track/bank';
import { trackLength } from '../core/track/centerline';
import { LAYOUT } from '../core/track/layout';
import { positionAt } from '../core/track/positions';
import { pointDistance } from '../core/track/positions';
import { rangeBetween, rangeContains, rangeSamples } from '../core/track/ranges';
import type { TrackRange } from '../core/track/ranges';
import { arcDraft, drawStart, straightDraft } from '../core/track/drawing';
import type { DrawDraft } from '../core/track/drawing';
import { LAYERS, layerOfSelection, layerOfTool } from '../editor/layers';
import { hasBand } from '../rendering/band';
import type { LayerId, Selection } from '../editor/layers';
import { SNAP_GRID } from '../editor/tools/tool';
import { t } from '../i18n';
import { useProjectStore } from './project';
import { useUiStore } from './ui';

export type ToolId =
  | 'select'
  | 'add'
  | 'straight'
  | 'arc'
  | 'barrier'
  | 'pits'
  | 'width'
  | 'bank'
  | SceneryKind
  | 'hill'
  | 'sculpt'
  | EarthworkType
  | 'pan';

/** Whether a tool places scenery: each kind of scenery is placed by its own tool. */
export const isSceneryTool = (tool: ToolId): tool is SceneryKind =>
  (SCENERY_KINDS as readonly ToolId[]).includes(tool);

/** Whether a tool lays an earthwork: each type is laid by its own tool. */
export const isEarthworkTool = (tool: ToolId): tool is EarthworkType =>
  (EARTHWORK_TYPES as readonly ToolId[]).includes(tool);

/** How often a held brush paints, in seconds. */
export const BRUSH_STEP = 1 / 30;

/**
 * A brush stroke under way: the relief it paints, the relief before it and the
 * ground it paints on, with the extent it has covered so far.
 */
export interface SculptStroke {
  field: SculptField;
  before: SculptField;
  ground: GroundModel;
  covered: { minX: number; maxX: number; minZ: number; maxZ: number };
}

/** How far the turn shortcuts turn scenery, in degrees: three steps of the heading. */
export const TURN_STEP = 3 * RULES.heading.step;
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
  /** Track distance of the first click of the bank zone being laid; the second is awaited. */
  const bankDraft = ref<number | null>(null);
  const bankTarget = ref<number | null>(null);
  /** Where the pointer aims the straight or the arc being drawn, and whether Shift snaps it. */
  const drawPointer = ref<{ at: PlanPoint; snap: boolean } | null>(null);
  /** Where the next scenery item would be placed, under the pointer. */
  const sceneryPointer = ref<PlanPoint | null>(null);
  const hoveredSceneryId = ref<Id | null>(null);
  /** First click of the earthwork being laid: where it starts, on which side. */
  const earthworkDraft = ref<RoadSpot | null>(null);
  /** Track distance where the next earthwork click would land. */
  const earthworkTarget = ref<number | null>(null);
  /** Where the next hill would be raised, under the pointer. */
  const hillPointer = ref<PlanPoint | null>(null);
  /** How the brush paints, how far it reaches and how fast. */
  const brushMode = ref<BrushMode>('raise');
  const brushRadius = ref(20);
  const brushStrength = ref(3);
  /** Where the brush is on the ground, under the pointer; `y` is known in 3D. */
  const brushPointer = ref<(PlanPoint & { y?: number }) | null>(null);
  /** The stroke being painted, and a count that moves on each time it paints. */
  const stroke = shallowRef<SculptStroke | null>(null);
  const strokeVersion = ref(0);
  let strokeTimer: ReturnType<typeof setInterval> | null = null;
  /** Moves where the next steps of the stroke paint. */
  let strokeTarget: ((at: PlanPoint) => void) | null = null;

  const selected = <K extends NonNullable<Selection>['kind']>(kind: K) =>
    computed(() => {
      const current = selection.value;
      return current?.kind === kind ? (current as Extract<Selection, { kind: K }>) : null;
    });
  const selectedPoints = selected('points');
  const selectedPointIds = computed(() => selectedPoints.value?.ids ?? []);
  /** Rectangle being dragged on the plan to select points, in screen pixels. */
  const marquee = ref<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  /** The selected control point, when the selection holds points. */
  const selectedPointId = computed(() => selectedPoints.value?.ids[0] ?? null);
  const selectedBarrierId = computed(() => selected('barrier').value?.id ?? null);
  const selectedWidthZoneId = computed(() => selected('widthZone').value?.id ?? null);
  const selectedBankZoneId = computed(() => selected('bankZone').value?.id ?? null);
  const selectedSceneryIds = computed(() => selected('scenery').value?.ids ?? []);
  const selectedEarthworkId = computed(() => selected('earthwork').value?.id ?? null);
  const selectedHillId = computed(() => selected('hill').value?.id ?? null);
  const selectedEarthwork = computed(() =>
    store.project.earthworks.find((earthwork) => earthwork.id === selectedEarthworkId.value),
  );
  const selectedHill = computed(() =>
    store.project.hills.find((hill) => hill.id === selectedHillId.value),
  );
  const selectedScenery = computed(() =>
    store.project.scenery.filter((item) => selectedSceneryIds.value.includes(item.id)),
  );
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
  const selectedBankZone = computed(() =>
    store.project.bankZones.find((zone) => zone.id === selectedBankZoneId.value),
  );
  /** The point straights and arcs are drawn on from: the selected one, or the last. */
  const drawFrom = computed(() =>
    drawStart(
      store.project,
      store.samples,
      selectedIndex.value >= 0 ? selectedIndex.value : store.project.points.length - 1,
    ),
  );
  /** The straight or the arc the next click would draw. */
  const drawDraft = computed<DrawDraft | null>(() => {
    const start = drawFrom.value,
      pointer = drawPointer.value;
    if (!start || !pointer) return null;
    if (tool.value === 'straight') return straightDraft(start, pointer.at, pointer.snap);
    if (tool.value === 'arc' && store.project.points.length > 1)
      return arcDraft(start, pointer.at, pointer.snap);
    return null;
  });
  /** The item the active scenery tool would place under the pointer, to show it beforehand. */
  const sceneryGhost = computed<SceneryItem | null>(() => {
    const kind = tool.value,
      at = sceneryPointer.value;
    if (!isSceneryTool(kind) || !at) return null;
    return newScenery('ghost', kind, at, facingTrack(store.samples, at));
  });
  /** The hill the hill tool would raise under the pointer, to show it beforehand. */
  const hillGhost = computed<Hill | null>(() => {
    const at = hillPointer.value;
    return tool.value === 'hill' && at
      ? { id: 'ghost', x: at.x, z: at.z, heading: 0, ...HILL_DEFAULTS }
      : null;
  });
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
      case 'bankZone':
        return project.bankZones.some((z) => z.id === current.id) ? current : null;
      case 'pitLane':
        return project.pitLane ? current : null;
      case 'earthwork':
        return project.earthworks.some((e) => e.id === current.id) ? current : null;
      case 'hill':
        return project.hills.some((h) => h.id === current.id) ? current : null;
      case 'scenery': {
        const ids = current.ids.filter((id) => project.scenery.some((item) => item.id === id));
        return ids.length === current.ids.length
          ? current
          : ids.length
            ? { kind: 'scenery', ids }
            : null;
      }
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
    endStroke();
    brushPointer.value = null;
    barrierDraft.value = null;
    barrierTarget.value = null;
    pitDraft.value = null;
    pitTarget.value = null;
    widthDraft.value = null;
    widthTarget.value = null;
    bankDraft.value = null;
    bankTarget.value = null;
    drawPointer.value = null;
    sceneryPointer.value = null;
    earthworkDraft.value = null;
    earthworkTarget.value = null;
    hillPointer.value = null;
  }

  /** Works on another layer: its tools, its elements, and what was selected in it before. */
  function setLayer(next: LayerId) {
    if (layer.value === next) return;
    store.commit();
    remembered.set(layer.value, selection.value);
    layer.value = next;
    // A stretch is picked in the band, which a layer without rows does not show.
    if (!hasBand(next)) range.value = null;
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
    if (next !== 'bank') {
      bankDraft.value = null;
      bankTarget.value = null;
    }
    // A draft carries on from one earthwork type to another: its type is the tool's.
    if (!isEarthworkTool(next)) {
      earthworkDraft.value = null;
      earthworkTarget.value = null;
    }
    drawPointer.value = null;
    sceneryPointer.value = null;
    hillPointer.value = null;
    if (next !== 'sculpt') {
      endStroke();
      brushPointer.value = null;
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

  /**
   * Lays a bank zone over a stretch, raised on the outside of its bend, and
   * selects it; false when it is refused.
   */
  function layBankZone(stretch: TrackRange): boolean {
    const rejection = bankZoneRejection(store.project, store.samples, stretch);
    if (rejection === 'bank-zones-limit')
      return refuse(t('toast.bankZonesLimit', { max: RULES.bankZones.max }));
    if (rejection === 'too-short')
      return refuse(t('toast.bankZoneTooShort', { min: RULES.rangeLength }));
    if (rejection === 'overlap') return refuse(t('toast.bankZoneOverlap'));
    const high = outsideOf(rangeSamples(store.samples, stretch));
    const id = store.edit((project) => addBankZone(project, { ...rangeEnds(stretch), high }));
    selection.value = { kind: 'bankZone', id };
    return true;
  }

  /** Lays an earthwork of a type over a stretch, on a side, and selects it; false when it is refused. */
  function layEarthwork(stretch: TrackRange, side: Side, type: EarthworkType): boolean {
    const rejection = earthworkRejection(store.project, stretch);
    if (rejection === 'too-short')
      return refuse(t('toast.earthworkTooShort', { min: RULES.rangeLength }));
    if (rejection === 'earthworks-limit')
      return refuse(t('toast.earthworksLimit', { max: RULES.earthworks.max }));
    const id = store.edit((project) =>
      addEarthwork(project, { type, side, ...rangeEnds(stretch) }),
    );
    selection.value = { kind: 'earthwork', id };
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

  function bankZoneOnRange() {
    if (range.value && layBankZone(range.value)) {
      range.value = null;
      ui.notify(t('toast.bankZoneAdded'));
    }
  }

  function barriersOnRange(sides: Side[]) {
    const stretch = range.value;
    if (stretch && sides.every((side) => layBarrier(stretch, side))) {
      range.value = null;
      ui.notify(t('toast.barrierAdded'));
    }
  }

  function earthworksOnRange(type: EarthworkType, sides: Side[]) {
    const stretch = range.value;
    if (stretch && sides.every((side) => layEarthwork(stretch, side, type))) {
      range.value = null;
      ui.notify(t('toast.earthworkAdded'));
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

  /** Adds a control point to the selection, or takes it out. */
  function togglePoint(id: Id) {
    const ids = selectedPointIds.value;
    const next = ids.includes(id) ? ids.filter((other) => other !== id) : [...ids, id];
    select(next.length ? { kind: 'points', ids: next } : null);
  }

  const selectBarrier = (id: Id | null) => select(id ? { kind: 'barrier', id } : null);
  const selectWidthZone = (id: Id | null) => select(id ? { kind: 'widthZone', id } : null);
  const selectBankZone = (id: Id | null) => select(id ? { kind: 'bankZone', id } : null);

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

  /**
   * Draws a straight from the selected point, or the last one, to `at`; Shift
   * keeps it on the track heading. The new point is selected to draw on from it.
   */
  function drawStraight(at: PlanPoint, snap: boolean) {
    const start = drawFrom.value;
    if (!start) return addPoint(at);
    const draft = straightDraft(start, at, snap);
    const rejection = pointRejection(store.project, draft.to);
    if (rejection === 'points-limit')
      return ui.notify(t('toast.pointsLimit', { max: RULES.points.max }), true);
    if (rejection === 'too-close')
      return ui.notify(t('toast.pointTooClose', { min: RULES.pointSpacing }), true);
    const from = store.project.points[start.index].id;
    const id = store.edit((project) => {
      const added = insertPoint(project, start.index + 1, { ...draft.to, y: start.y });
      setStraight(project, from, true);
      return added;
    });
    selection.value = { kind: 'points', ids: [id] };
  }

  /** Draws an arc from the selected point, or the last one, ending at `at`; Shift rounds it. */
  function drawArc(at: PlanPoint, snap: boolean) {
    const start = drawFrom.value;
    if (!start || store.project.points.length < 2) return ui.notify(t('toast.arcNeedsTrack'), true);
    const draft = arcDraft(start, at, snap);
    if (!draft) return ui.notify(t('toast.arcStraight'), true);
    const rejection = arcRejection(store.project, start.at, draft.shape);
    if (rejection === 'points-limit')
      return ui.notify(t('toast.pointsLimit', { max: RULES.points.max }), true);
    if (rejection === 'too-small')
      return ui.notify(t('toast.arcTooSmall', { min: RULES.radius.min }), true);
    if (rejection === 'too-close')
      return ui.notify(t('toast.pointTooClose', { min: RULES.pointSpacing }), true);
    const id = store.edit((project) =>
      addArc(project, start.index, start.at, draft.shape, start.y),
    );
    selection.value = { kind: 'points', ids: [id] };
  }

  /** Deletes the selected control points; after a single one, its neighbour is selected. */
  function deleteSelectedPoint() {
    const ids = selectedPointIds.value;
    if (ids.length > 1) {
      store.edit((draft) => removePoints(draft, ids));
      selection.value = null;
      if (!store.project.points.length) setTool('add');
      return;
    }
    const id = selectedPointId.value;
    if (id === null || !selectedPoint.value) return;
    const index = selectedIndex.value;
    store.edit((draft) => removePoint(draft, id));
    const points = store.project.points;
    const next = points[Math.min(index, points.length - 1)];
    selection.value = next ? { kind: 'points', ids: [next.id] } : null;
    if (!points.length) setTool('add');
  }

  /** Raises or lowers every selected control point. */
  function shiftSelectedAltitude(dy: number) {
    const ids = selectedPointIds.value;
    if (ids.length) store.edit((draft) => shiftAltitude(draft, ids, dy));
  }

  /** Puts the selected control points at their average altitude, to the half metre. */
  function flattenSelected() {
    const ids = selectedPointIds.value;
    const points = store.project.points.filter((point) => ids.includes(point.id));
    if (!points.length) return;
    const average = points.reduce((sum, point) => sum + point.y, 0) / points.length;
    store.edit((draft) => setAltitude(draft, ids, Math.round(average * 2) / 2));
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

  /** First click of a bank zone: one end. */
  function beginBankZone(s: number) {
    bankDraft.value = s;
  }

  function cancelBankZone() {
    bankDraft.value = null;
  }

  /** Second click: the other end. The zone covers the stretch between the two clicks. */
  function completeBankZone(s: number) {
    const first = bankDraft.value;
    if (first === null) return;
    if (!layBankZone(rangeBetween(store.project, store.samples, first, s))) return;
    bankDraft.value = null;
    bankTarget.value = null;
    ui.notify(t('toast.bankZoneAdded'));
  }

  function deleteSelectedBankZone() {
    const zone = selectedBankZone.value;
    if (!zone) return;
    const zones = store.project.bankZones;
    const index = zones.indexOf(zone);
    store.edit((draft) => removeBankZone(draft, zone.id));
    selectBankZone(store.project.bankZones[Math.min(index, zones.length - 2)]?.id ?? null);
  }

  /** Places a scenery item at `at`, facing the track, and selects it. */
  function placeScenery(kind: SceneryKind, at: PlanPoint) {
    if (sceneryRejection(store.project))
      return void refuse(t('toast.sceneryLimit', { max: RULES.scenery.max }));
    const heading = facingTrack(store.samples, at);
    const id = store.edit((draft) => addScenery(draft, kind, at, heading));
    selection.value = { kind: 'scenery', ids: [id] };
  }

  const selectScenery = (id: Id | null) => select(id ? { kind: 'scenery', ids: [id] } : null);

  /** Adds a scenery item to the selection, or takes it out. */
  function toggleScenery(id: Id) {
    const ids = selectedSceneryIds.value;
    const next = ids.includes(id) ? ids.filter((other) => other !== id) : [...ids, id];
    select(next.length ? { kind: 'scenery', ids: next } : null);
  }

  function deleteSelectedScenery() {
    const ids = selectedSceneryIds.value;
    if (!ids.length) return;
    store.edit((draft) => removeScenery(draft, ids));
    selection.value = null;
  }

  /** Turns every selected scenery item about itself by `degrees`, clockwise on the plan. */
  function turnSelectedScenery(degrees: number) {
    const items = selectedScenery.value;
    if (items.length)
      store.edit((draft) => {
        for (const item of items)
          updateScenery(draft, item.id, { heading: item.heading + degrees });
      });
  }

  /** Copies the selected scenery items a few metres aside and selects the copies. */
  function duplicateSelectedScenery() {
    const ids = selectedSceneryIds.value;
    if (!ids.length) return;
    if (sceneryRejection(store.project, ids.length))
      return void refuse(t('toast.sceneryLimit', { max: RULES.scenery.max }));
    // One grid step aside, so a copy snapped to the grid lands on the next node.
    const aside = { x: SNAP_GRID, z: SNAP_GRID };
    const copies = store.edit((draft) => duplicateScenery(draft, ids, aside));
    selection.value = { kind: 'scenery', ids: copies };
  }

  /** Deletes what is selected, when it can be deleted from the keyboard: points, scenery, earthworks or hills. */
  function deleteSelection() {
    const kind = selection.value?.kind;
    if (kind === 'scenery') deleteSelectedScenery();
    else if (kind === 'earthwork') deleteSelectedEarthwork();
    else if (kind === 'hill') deleteSelectedHill();
    else deleteSelectedPoint();
  }

  function beginEarthwork(spot: RoadSpot) {
    earthworkDraft.value = spot;
  }

  function cancelEarthwork() {
    earthworkDraft.value = null;
  }

  /**
   * Second click: the other end. The earthwork, of the type of the active tool,
   * covers the stretch between the two clicks.
   */
  function completeEarthwork(s: number) {
    const draft = earthworkDraft.value;
    if (!draft) return;
    const type = isEarthworkTool(tool.value) ? tool.value : 'embankment';
    const stretch = rangeBetween(store.project, store.samples, draft.s, s);
    if (!layEarthwork(stretch, draft.side, type)) return;
    earthworkDraft.value = null;
    earthworkTarget.value = null;
    ui.notify(t('toast.earthworkAdded'));
  }

  const selectEarthwork = (id: Id | null) => select(id ? { kind: 'earthwork', id } : null);
  const selectHill = (id: Id | null) => select(id ? { kind: 'hill', id } : null);

  function swapSelectedEarthworkSide() {
    const earthwork = selectedEarthwork.value;
    if (earthwork)
      store.edit((draft) =>
        updateEarthwork(draft, earthwork.id, { side: opposite(earthwork.side) }),
      );
  }

  function deleteSelectedEarthwork() {
    const earthwork = selectedEarthwork.value;
    if (!earthwork) return;
    const earthworks = store.project.earthworks;
    const index = earthworks.indexOf(earthwork);
    store.edit((draft) => removeEarthwork(draft, earthwork.id));
    selectEarthwork(store.project.earthworks[Math.min(index, earthworks.length - 2)]?.id ?? null);
  }

  /**
   * Starts painting with the brush at `at`, and keeps painting there as long as
   * it is held, even still. `invert` swaps raising and lowering. Flattening
   * levels the ground to its height under the pointer when the stroke starts.
   */
  function beginStroke(at: PlanPoint, invert = false) {
    endStroke();
    store.commit();
    const swap: Partial<Record<BrushMode, BrushMode>> = { raise: 'lower', lower: 'raise' };
    const mode = (invert && swap[brushMode.value]) || brushMode.value;
    const ground = groundModel(store.project, store.samples);
    const target = mode === 'flatten' ? ground.height(at) : 0;
    const current: SculptStroke = {
      field: new SculptField(store.project.sculpt),
      before: new SculptField(store.project.sculpt),
      ground,
      covered: { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity },
    };
    let point = { x: at.x, z: at.z },
      warned = false;
    const paint = () => {
      const brush = { mode, radius: brushRadius.value, strength: brushStrength.value };
      if (!current.field.paint(brush, point, BRUSH_STEP, ground, target) && !warned) {
        warned = true;
        refuse(t('toast.sculptLimit', { max: RULES.sculptTiles.max }));
      }
      const box = current.covered,
        reach = brush.radius;
      box.minX = Math.min(box.minX, point.x - reach);
      box.maxX = Math.max(box.maxX, point.x + reach);
      box.minZ = Math.min(box.minZ, point.z - reach);
      box.maxZ = Math.max(box.maxZ, point.z + reach);
      strokeVersion.value++;
    };
    stroke.value = current;
    strokeTarget = (next) => (point = { x: next.x, z: next.z });
    paint();
    strokeTimer = setInterval(paint, BRUSH_STEP * 1000);
  }

  function strokeTo(at: PlanPoint) {
    strokeTarget?.(at);
  }

  /** Ends the stroke: what it painted becomes one step of the history. */
  function endStroke() {
    if (strokeTimer !== null) clearInterval(strokeTimer);
    strokeTimer = null;
    strokeTarget = null;
    const done = stroke.value;
    if (!done) return;
    stroke.value = null;
    store.edit((draft) => setSculpt(draft, done.field));
  }

  /** Removes all the relief painted with the brush. */
  function clearPaintedRelief() {
    store.edit(clearSculpt);
  }

  /** Raises a hill of the default size at `at` and selects it. */
  function placeHill(at: PlanPoint) {
    if (hillRejection(store.project))
      return void refuse(t('toast.hillsLimit', { max: RULES.hills.max }));
    const id = store.edit((draft) => addHill(draft, at));
    selection.value = { kind: 'hill', id };
  }

  function deleteSelectedHill() {
    const hill = selectedHill.value;
    if (!hill) return;
    store.edit((draft) => removeHill(draft, hill.id));
    selection.value = null;
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
    selectedPointIds,
    marquee,
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
    selectedBankZoneId,
    bankDraft,
    bankTarget,
    drawPointer,
    sceneryPointer,
    hoveredSceneryId,
    sceneryGhost,
    earthworkDraft,
    earthworkTarget,
    hillPointer,
    hillGhost,
    brushMode,
    brushRadius,
    brushStrength,
    brushPointer,
    stroke,
    strokeVersion,
    selectedEarthworkId,
    selectedEarthwork,
    selectedHillId,
    selectedHill,
    selectedSceneryIds,
    selectedScenery,
    drawFrom,
    drawDraft,
    selectedIndex,
    selectedPoint,
    selectedBarrier,
    selectedWidthZone,
    selectedBankZone,
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
    bankZoneOnRange,
    barriersOnRange,
    pitLaneOnRange,
    earthworksOnRange,
    selectPoint,
    togglePoint,
    shiftSelectedAltitude,
    flattenSelected,
    selectPointAt,
    selectBarrier,
    selectWidthZone,
    selectBankZone,
    addPoint,
    drawStraight,
    drawArc,
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
    beginBankZone,
    cancelBankZone,
    completeBankZone,
    deleteSelectedBankZone,
    setBarrierType,
    swapSelectedBarrierSide,
    deleteSelectedBarrier,
    placeScenery,
    selectScenery,
    toggleScenery,
    deleteSelectedScenery,
    turnSelectedScenery,
    duplicateSelectedScenery,
    deleteSelection,
    beginEarthwork,
    cancelEarthwork,
    completeEarthwork,
    selectEarthwork,
    selectHill,
    swapSelectedEarthworkSide,
    deleteSelectedEarthwork,
    placeHill,
    deleteSelectedHill,
    beginStroke,
    strokeTo,
    endStroke,
    clearPaintedRelief,
  };
});
