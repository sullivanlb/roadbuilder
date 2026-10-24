import { defineStore } from 'pinia';
import { computed, ref, shallowRef, watch } from 'vue';
import type { Id } from '../core/ids';
import type { PlanPoint, Vec3 } from '../core/math';
import {
  addArc,
  addHill,
  addScenery,
  arcRejection,
  duplicateScenery,
  hillRejection,
  insertPoint,
  opposite,
  pointRejection,
  sceneryRejection,
  setAltitude,
  shiftAltitude,
  setStraight,
  updateBarrier,
  updateEarthwork,
  updateScenery,
  clearSculpt,
  setSculpt,
} from '../core/project/edits';
import { RULES } from '../core/project/rules';
import { facingTrack, newScenery } from '../core/project/scenery';
import { EARTHWORK_TYPES, isCircuit, SCENERY_KINDS } from '../core/project/schema';
import type {
  BankZone,
  Barrier,
  BarrierType,
  Earthwork,
  EarthworkType,
  Hill,
  SceneryItem,
  SceneryKind,
  Side,
  WidthZone,
} from '../core/project/schema';
import { HILL_DEFAULTS } from '../core/project/terrain';
import { SculptField } from '../core/project/sculpt';
import type { BrushMode } from '../core/project/sculpt';
import { trackLength } from '../core/track/centerline';
import { pointDistance } from '../core/track/positions';
import { rangeContains } from '../core/track/ranges';
import type { TrackRange } from '../core/track/ranges';
import { arcDraft, drawStart, straightDraft } from '../core/track/drawing';
import type { DrawDraft } from '../core/track/drawing';
import { LAYERS, layerOfTool } from '../editor/layers';
import type { LayerId } from '../editor/layers';
import { laidExtent, laidKindOfTool, lay } from '../editor/laying';
import type { LaidKind, Laying, RoadSpot } from '../editor/laying';
import { deletion, layerOfSelection, selectedItems, stillSelected } from '../editor/selection';
import type { Selection } from '../editor/selection';
import { BrushStroke } from '../editor/stroke';
import { SNAP_GRID } from '../editor/tools/tool';
import { hasBand } from '../rendering/band';
import type { Editing, LayingView } from '../rendering/editing';
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

/** How far the turn shortcuts turn scenery, in degrees: three steps of the heading. */
export const TURN_STEP = 3 * RULES.heading.step;
export type ViewMode = '2d' | '3d';

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
  /** The first click of what is being laid along the track; the second is awaited. */
  const laying = ref<Laying | null>(null);
  /** Where the second click would land, under the pointer. */
  const layingTarget = ref<RoadSpot | null>(null);
  const hoveredPointId = ref<Id | null>(null);
  /** Track distance under the pointer, on the plan, the band or the preview. */
  const hoverS = ref<number | null>(null);
  /** A stretch picked in the band, waiting for something to be laid on it. */
  const range = ref<TrackRange | null>(null);
  /** Where the pointer aims the straight or the arc being drawn, and whether Shift snaps it. */
  const drawPointer = ref<{ at: PlanPoint; snap: boolean } | null>(null);
  /** Where the next scenery item would be placed, under the pointer. */
  const sceneryPointer = ref<PlanPoint | null>(null);
  const hoveredSceneryId = ref<Id | null>(null);
  /** Where the next hill would be raised, under the pointer. */
  const hillPointer = ref<PlanPoint | null>(null);
  /** How the brush paints, how far it reaches and how fast. */
  const brushMode = ref<BrushMode>('raise');
  const brushRadius = ref(20);
  const brushStrength = ref(3);
  /** Where the brush is on the ground, under the pointer; `y` is known in 3D. */
  const brushPointer = ref<(PlanPoint & { y?: number }) | null>(null);
  /** The stroke being painted, and a count that moves on each time it paints. */
  const stroke = shallowRef<BrushStroke | null>(null);
  const strokeSteps = ref(0);

  const selectedPoints = computed(() =>
    selection.value?.kind === 'points' ? selection.value : null,
  );
  const selectedPointIds = computed(() => selectedPoints.value?.ids ?? []);
  /** Rectangle being dragged on the plan to select points, in screen pixels. */
  const marquee = ref<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  /** The selected control point, when the selection holds points. */
  const selectedPointId = computed(() => selectedPoints.value?.ids[0] ?? null);
  const selectedIndex = computed(() =>
    selectedPointId.value === null ? -1 : (store.pointIndex.get(selectedPointId.value) ?? -1),
  );
  const selectedPoint = computed(() => store.project.points[selectedIndex.value]);
  const selectedScenery = computed(() =>
    selectedItems<SceneryItem>(store.project, selection.value, 'scenery'),
  );
  const selectedSceneryIds = computed(() => selectedScenery.value.map((item) => item.id));
  const selectedOne = <T extends { id: Id }>(
    kind: 'barrier' | 'widthZone' | 'bankZone' | 'earthwork' | 'hill',
  ) => computed(() => selectedItems<T>(store.project, selection.value, kind)[0]);
  const selectedBarrier = selectedOne<Barrier>('barrier');
  const selectedWidthZone = selectedOne<WidthZone>('widthZone');
  const selectedBankZone = selectedOne<BankZone>('bankZone');
  const selectedEarthwork = selectedOne<Earthwork>('earthwork');
  const selectedHill = selectedOne<Hill>('hill');
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
  /** The type of earthwork the active tool lays. */
  const earthworkType = computed(() => (isEarthworkTool(tool.value) ? tool.value : 'embankment'));
  /** What is being laid along the track, with the stretch it would cover up to the pointer. */
  const layingView = computed<LayingView | null>(() => {
    const current = laying.value,
      target = layingTarget.value;
    if (!current) return null;
    return {
      kind: current.kind,
      from: current.from,
      range: target
        ? laidExtent(current.kind, store.project, store.samples, current.from.s, target.s)
        : null,
      earthworkType: earthworkType.value,
    };
  });
  /** The editing under way, the same for the plan, the band and the preview. */
  const editing = computed<Editing>(() => ({
    layer: layer.value,
    hiddenLayers: hiddenLayers.value,
    selection: selection.value,
    laying: layingView.value,
    range: range.value,
    hoverS: hoverS.value,
    brush:
      tool.value === 'sculpt' && brushPointer.value
        ? { ...brushPointer.value, radius: brushRadius.value }
        : null,
  }));
  const paintedRelief = computed(() => new SculptField(store.project.sculpt));
  /**
   * The painted relief as it shows: the stroke's while one is painted. A new
   * value each time the stroke paints, for the plan to draw it again.
   */
  const relief = computed(() => {
    const current = stroke.value;
    return current && strokeSteps.value
      ? { field: current.relief, step: strokeSteps.value }
      : { field: paintedRelief.value, step: 0 };
  });

  // Undo, redo or an opened file can remove what was selected or being laid.
  watch(
    () => store.project,
    (project) => {
      const left = stillSelected(project, selection.value);
      if (left !== selection.value) selection.value = left;
      if (laying.value?.kind === 'pitLane' && !isCircuit(project)) cancelLaying();
    },
  );

  /** Each layer keeps its selection while another one is edited. */
  const remembered = new Map<LayerId, Selection>();

  function clearDrafts() {
    endStroke();
    brushPointer.value = null;
    cancelLaying();
    drawPointer.value = null;
    sceneryPointer.value = null;
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
    selection.value = stillSelected(store.project, remembered.get(next) ?? null);
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
    // What is being laid carries on with a tool laying the same kind: an
    // earthwork of another type, say.
    if (laidKindOfTool(next) !== laying.value?.kind) cancelLaying();
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

  /** Tells why something cannot be done; returns false for the caller to stop. */
  const refuse = (message: string) => {
    ui.notify(message, true);
    return false;
  };

  /** Lays something of a kind over a stretch, on a side, and selects it; false when it is refused. */
  function layOver(kind: LaidKind, stretch: TrackRange, side: Side, type = earthworkType.value) {
    const laid = lay(kind, store.project, store.samples, stretch, {
      side,
      barrierType: barrierType.value,
      earthworkType: type,
    });
    if ('refusal' in laid) return void refuse(laid.refusal);
    selection.value = store.edit(laid.recipe);
    return laid;
  }

  /** First click of what the active tool lays along the track: where it starts, on which side. */
  function beginLaying(spot: RoadSpot) {
    const kind = laidKindOfTool(tool.value);
    if (!kind) return;
    if (kind === 'pitLane' && !isCircuit(store.project)) return void refuse(t('pits.roadOnly'));
    laying.value = { kind, from: spot };
    layingTarget.value = null;
  }

  /** The pointer moved over the road, or off it, while something is being laid. */
  function aimLaying(spot: RoadSpot | null) {
    if (laying.value) layingTarget.value = spot;
  }

  function cancelLaying() {
    laying.value = null;
    layingTarget.value = null;
  }

  /** Second click, at track distance `s`: what is being laid covers the stretch between the clicks. */
  function completeLaying(s: number) {
    const current = laying.value;
    if (!current) return;
    const stretch = laidExtent(current.kind, store.project, store.samples, current.from.s, s);
    const laid = layOver(current.kind, stretch, current.from.side);
    if (!laid) return;
    cancelLaying();
    if (laid.single) setTool('select');
    ui.notify(laid.added);
  }

  /**
   * Lays something of a kind on the stretch picked in the band, once on each
   * side; the stretch is kept when it is refused. A pit lane keeps its side.
   */
  function layOnRange(kind: LaidKind, sides?: readonly Side[], type?: EarthworkType) {
    const stretch = range.value;
    if (!stretch) return;
    const on = sides ?? [kind === 'pitLane' ? (store.project.pitLane?.side ?? 'right') : 'right'];
    let added = '';
    for (const side of on) {
      const laid = layOver(kind, stretch, side, type);
      if (!laid) return;
      added = laid.added;
    }
    range.value = null;
    ui.notify(added);
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

  /**
   * Deletes what is selected. After a single control point, zone, barrier or
   * earthwork, the one taking its place is selected; a track left without points
   * gets the tool that adds them.
   */
  function deleteSelection() {
    const removal = deletion(store.project, selection.value);
    if (!removal) return;
    const kind = selection.value?.kind;
    store.edit(removal.recipe);
    selection.value = removal.next(store.project);
    if (kind === 'points' && !store.project.points.length) setTool('add');
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

  function swapSelectedEarthworkSide() {
    const earthwork = selectedEarthwork.value;
    if (earthwork)
      store.edit((draft) =>
        updateEarthwork(draft, earthwork.id, { side: opposite(earthwork.side) }),
      );
  }

  /**
   * Starts painting with the brush at `at`, and keeps painting there as long as
   * it is held, even still (docs/adr/0016). `invert` swaps raising and lowering.
   */
  function beginStroke(at: PlanPoint, invert = false) {
    endStroke();
    store.commit();
    strokeSteps.value = 0;
    stroke.value = new BrushStroke(
      store.project,
      store.samples,
      () => ({ mode: brushMode.value, radius: brushRadius.value, strength: brushStrength.value }),
      at,
      invert,
      {
        painted: () => strokeSteps.value++,
        full: () => refuse(t('toast.sculptLimit', { max: RULES.sculptTiles.max })),
      },
    );
  }

  function strokeTo(at: PlanPoint) {
    stroke.value?.moveTo(at);
  }

  /** Ends the stroke: what it painted becomes one step of the history. */
  function endStroke() {
    const done = stroke.value;
    if (!done) return;
    stroke.value = null;
    const field = done.end();
    store.edit((draft) => setSculpt(draft, field));
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

  /** Chooses the type of the next barrier, and of the selected one if any. */
  function setBarrierType(type: BarrierType) {
    barrierType.value = type;
    const barrier = selectedBarrier.value;
    if (laying.value?.kind !== 'barrier' && barrier && barrier.type !== type)
      store.edit((draft) => updateBarrier(draft, barrier.id, { type }));
  }

  function swapSelectedBarrierSide() {
    const barrier = selectedBarrier.value;
    if (barrier)
      store.edit((draft) => updateBarrier(draft, barrier.id, { side: opposite(barrier.side) }));
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
    barrierType,
    laying,
    layingTarget,
    hoveredPointId,
    drawPointer,
    sceneryPointer,
    hoveredSceneryId,
    sceneryGhost,
    hillPointer,
    hillGhost,
    brushMode,
    brushRadius,
    brushStrength,
    brushPointer,
    stroke,
    relief,
    editing,
    selectedEarthwork,
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
    layOnRange,
    beginLaying,
    aimLaying,
    cancelLaying,
    completeLaying,
    selectPoint,
    togglePoint,
    shiftSelectedAltitude,
    flattenSelected,
    selectPointAt,
    addPoint,
    drawStraight,
    drawArc,
    deleteSelection,
    setBarrierType,
    swapSelectedBarrierSide,
    placeScenery,
    selectScenery,
    toggleScenery,
    turnSelectedScenery,
    duplicateSelectedScenery,
    swapSelectedEarthworkSide,
    placeHill,
    beginStroke,
    strokeTo,
    endStroke,
    clearPaintedRelief,
  };
});
