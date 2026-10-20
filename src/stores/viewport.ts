import { createEventHook } from '@vueuse/core';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { bounds } from '../core/math';
import type { PlanPoint } from '../core/math';
import type { IssueLocation } from '../core/track/issues';
import { issueLayer } from '../editor/layers';
import { terrainBounds } from '../core/track/layout';
import { rangeSamples } from '../core/track/ranges';
import type { TrackRange } from '../core/track/ranges';
import { frameCamera, PlanProjection, zoomCamera } from '../rendering/plan/projection';
import type { PlanCamera, ScreenPoint, ViewportSize } from '../rendering/plan/projection';
import { useEditorStore } from './editor';
import { useProjectStore } from './project';
import { useUiStore } from './ui';

/** A request the 3D preview handles with its own camera. */
export type PreviewCommand =
  | { type: 'fit' }
  | { type: 'zoom'; factor: number }
  | { type: 'focus'; points: readonly PlanPoint[] }
  | { type: 'center'; at: PlanPoint };

/**
 * Where the user is looking. The plan camera lives here so the plan, its hit
 * tests and the zoom controls share it; the 3D preview keeps its own orbit
 * camera and receives fit and zoom requests.
 */
export const useViewportStore = defineStore('viewport', () => {
  const store = useProjectStore();
  const editor = useEditorStore();
  const ui = useUiStore();

  const size = ref<ViewportSize>({ width: 800, height: 500 });
  const camera = ref<PlanCamera>({ x: 0, z: 0, scale: 1 });
  /** Scale of the last full framing: the 100 % of the zoom indicator. */
  const fittedScale = ref(1);
  const fitted = ref(false);
  const preview = createEventHook<PreviewCommand>();
  /** Bumped when the plan canvas should take the keyboard focus. */
  const focusRequest = ref(0);

  const projection = computed(() => new PlanProjection(camera.value, size.value));
  const zoomPercent = computed(() => Math.round((camera.value.scale / fittedScale.value) * 100));

  /** Frames the whole terrain, or the control points while there is no track yet. */
  function fit() {
    const samples = store.samples;
    const area =
      samples.length > 1 ? terrainBounds(store.project, samples) : bounds(store.project.points, 18);
    camera.value = frameCamera(area, size.value);
    fittedScale.value = camera.value.scale;
    fitted.value = true;
    if (editor.view === '3d') void preview.trigger({ type: 'fit' });
  }

  /** Frames a few positions closely, e.g. a tight turn and its control points. */
  function focus(points: readonly PlanPoint[]) {
    if (!points.length) return;
    camera.value = frameCamera(
      bounds(points, Math.max(20, store.project.road.width * 2)),
      size.value,
    );
  }

  /** Frames a stretch of track, e.g. a corner. */
  function focusRange(range: TrackRange) {
    const points = rangeSamples(store.samples, range);
    focus(points);
    if (editor.view === '3d') void preview.trigger({ type: 'focus', points });
  }

  /** Centres the plan, or the preview, on a place, keeping the zoom. */
  function centerOn(at: PlanPoint) {
    camera.value = { ...camera.value, x: at.x, z: at.z };
    if (editor.view === '3d') void preview.trigger({ type: 'center', at });
  }

  function zoom(factor: number, at?: ScreenPoint) {
    if (editor.view === '3d') return void preview.trigger({ type: 'zoom', factor });
    const center = at ?? { x: size.value.width / 2, y: size.value.height / 2 };
    camera.value = zoomCamera(camera.value, size.value, factor, center);
  }

  function pan(camera0: PlanCamera, dx: number, dy: number) {
    camera.value = {
      ...camera0,
      x: camera0.x - dx / camera0.scale,
      z: camera0.z - dy / camera0.scale,
    };
  }

  /** Shows a located issue on the plan: closes any dialog, frames the spot and selects its first point. */
  function focusIssue(location: IssueLocation) {
    ui.closeDialog();
    editor.setView('2d');
    editor.setTool('select');
    editor.setLayer(issueLayer(location.issue));
    if (location.pointIds[0] && editor.layer === 'track') editor.selectPoint(location.pointIds[0]);
    const points = store.project.points.filter((point) => location.pointIds.includes(point.id));
    focus([store.samples[location.sampleIndex], ...points]);
    focusRequest.value++;
  }

  /** Track distances shown in the band; null shows the whole track. */
  const bandView = ref<{ start: number; end: number } | null>(null);

  /** Zooms or scrolls the band, kept on the track and at least 100 m wide. */
  function setBandView(next: { start: number; end: number } | null, total: number) {
    if (!next || next.end - next.start >= total) return void (bandView.value = null);
    const width = Math.max(100, next.end - next.start);
    const start = Math.min(Math.max(0, next.start), total - width);
    bandView.value = { start, end: start + width };
  }

  function resize(next: ViewportSize) {
    size.value = next;
    if (!fitted.value) fit();
  }

  return {
    size,
    camera,
    projection,
    zoomPercent,
    focusRequest,
    onPreviewCommand: preview.on,
    fit,
    focus,
    focusIssue,
    focusRange,
    centerOn,
    bandView,
    setBandView,
    zoom,
    pan,
    resize,
  };
});
