import { computed, onBeforeUnmount, onMounted, ref, watchEffect } from 'vue';
import type { Ref } from 'vue';
import { clamp } from '../domain/math';
import { LIMITS } from '../domain/project/limits';
import type { Point } from '../domain/types';
import { TrackRenderer } from '../rendering/TrackRenderer';
import { number, useEditor } from './useEditor';

type Drag =
  | { type: 'pan'; x: number; y: number; cameraX: number; cameraZ: number }
  | { type: 'orbit'; x: number; y: number; yaw: number; pitch: number }
  | { type: 'point'; x: number; y: number; index: number; before: string; origin: Point };

export function useCanvas(
  canvas: Ref<HTMLCanvasElement | null>,
  elevation: () => HTMLCanvasElement | null,
) {
  const e = useEditor();
  let renderer: TrackRenderer | null = null;
  let drag: Drag | null = null;
  const dragging = ref(false),
    space = ref(false),
    hover = ref(-1);
  const zoomLevel = ref(100),
    scaleWidth = ref(70),
    scaleLabel = ref('100 m');
  const cursor = computed(() =>
    dragging.value
      ? 'grabbing'
      : e.view === '3d' || space.value || e.tool === 'pan'
        ? 'grab'
        : e.tool === 'add' || e.tool === 'barrier'
          ? 'crosshair'
          : hover.value >= 0
            ? 'grab'
            : 'default',
  );
  const hint = computed(() =>
    e.view === '3d'
      ? 'Glissez pour tourner · Molette pour zoomer · Retour au plan 2D pour modifier'
      : e.tool === 'barrier'
        ? e.barrierDraft
          ? 'Cliquez le point d’arrivée du tronçon · Échap annule le tracé'
          : 'Cliquez le point de départ du tronçon · Échap quitte l’outil'
        : e.tool === 'add'
          ? 'Cliquez pour ajouter après le point sélectionné · Échap pour terminer'
          : e.tool === 'pan'
            ? 'Glissez pour déplacer le plan · Molette pour zoomer'
            : 'Glissez un point · Molette pour zoomer · Espace + glisser pour naviguer',
  );
  function position(event: MouseEvent) {
    const rect = canvas.value!.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
  function pointerDown(event: PointerEvent) {
    if (!renderer || (event.button !== 0 && event.button !== 1)) return;
    canvas.value!.focus({ preventScroll: true });
    e.flushEdit();
    const pos = position(event);
    canvas.value!.setPointerCapture(event.pointerId);
    if (e.view === '3d')
      drag = { type: 'orbit', ...pos, yaw: renderer.camera.yaw, pitch: renderer.camera.pitch };
    else if (space.value || event.button === 1 || e.tool === 'pan') {
      drag = { type: 'pan', ...pos, cameraX: renderer.camera.x, cameraZ: renderer.camera.z };
      event.preventDefault();
    } else if (e.tool === 'barrier') {
      const hit = renderer.hitRoadPoint(pos.x, pos.y);
      if (hit) {
        if (e.barrierDraft) e.completeBarrier(hit.index);
        else e.beginBarrier(hit.index, hit.side);
      }
    } else {
      const hit = renderer.hitPoint(pos.x, pos.y);
      if (hit >= 0 && e.tool !== 'add') {
        e.selectPoint(hit);
        e.selectBarrier(-1);
        drag = {
          type: 'point',
          before: e.snapshot(),
          index: hit,
          ...pos,
          origin: { ...e.project.points[hit] },
        };
      } else if (e.tool === 'add' || !e.project.points.length)
        e.addPoint(renderer.world(pos.x, pos.y));
      else {
        const barrier = renderer.hitBarrier(pos.x, pos.y);
        if (barrier >= 0) e.selectBarrier(barrier);
        else {
          e.selectPoint(-1);
          e.selectBarrier(-1);
        }
      }
    }
    dragging.value = !!drag;
  }
  function pointerMove(event: PointerEvent) {
    if (!renderer) return;
    const pos = position(event);
    if (!drag) {
      if (e.view === '2d' && e.tool === 'barrier') {
        const hit = renderer.hitRoadPoint(pos.x, pos.y),
          previous = renderer.barrierHover;
        const unchanged =
          (hit && previous && hit.index === previous.index && hit.side === previous.side) ||
          (!hit && !previous);
        if (!unchanged) {
          renderer.barrierHover = hit;
          renderer.requestDraw();
        }
        return;
      }
      if (e.view === '2d' && e.tool === 'select') {
        hover.value = renderer.hitPoint(pos.x, pos.y);
        if (hover.value !== renderer.hover) {
          renderer.hover = hover.value;
          renderer.requestDraw();
        }
      }
      return;
    }
    if (drag.type === 'pan') {
      renderer.camera.x = drag.cameraX - (pos.x - drag.x) / renderer.camera.scale;
      renderer.camera.z = drag.cameraZ - (pos.y - drag.y) / renderer.camera.scale;
      renderer.requestDraw();
    } else if (drag.type === 'orbit') {
      renderer.camera.yaw = drag.yaw + (pos.x - drag.x) * 0.006;
      renderer.camera.pitch = clamp(drag.pitch + (pos.y - drag.y) * 0.004, 0.15, 1.5);
      renderer.requestDraw();
    } else {
      const point = e.project.points[drag.index];
      if (!point) {
        endDrag();
        return;
      }
      point.x = clamp(
        drag.origin.x + (pos.x - drag.x) / renderer.camera.scale,
        -LIMITS.coordinate,
        LIMITS.coordinate,
      );
      point.z = clamp(
        drag.origin.z + (pos.y - drag.y) / renderer.camera.scale,
        -LIMITS.coordinate,
        LIMITS.coordinate,
      );
      if (event.shiftKey) {
        point.x = Math.round(point.x / 5) * 5;
        point.z = Math.round(point.z / 5) * 5;
      }
      e.refresh();
    }
  }
  function endDrag() {
    if (drag?.type === 'point') e.remember(drag.before);
    drag = null;
    dragging.value = false;
  }
  function doubleClick(event: MouseEvent) {
    if (!renderer || e.view !== '2d' || e.tool !== 'select' || space.value) return;
    const pos = position(event);
    if (renderer.hitPoint(pos.x, pos.y) >= 0) return;
    const road = renderer.hitRoad(pos.x, pos.y);
    if (road) e.addPoint(road, road.segment);
  }
  function wheel(event: WheelEvent) {
    const pos = position(event);
    renderer?.zoom(Math.exp(-clamp(event.deltaY, -150, 150) * 0.002), pos.x, pos.y);
  }
  function profileClick(event: MouseEvent) {
    if (!e.samples.length) return;
    const rect = elevation()!.getBoundingClientRect(),
      target = clamp((event.clientX - rect.left) / rect.width, 0, 1) * e.samples.at(-1)!.s;
    let best = 0,
      bestDistance = Infinity;
    e.project.points.forEach((_, i) => {
      const sample = e.samples.find((p) => p.segment === i && p.t === 0) || e.samples.at(-1)!;
      if (Math.abs(sample.s - target) < bestDistance) {
        bestDistance = Math.abs(sample.s - target);
        best = i;
      }
    });
    e.selectPoint(best);
  }
  function onKeydown(event: KeyboardEvent) {
    if (
      event.code !== 'Space' ||
      e.dialog ||
      ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(document.activeElement?.tagName ?? '')
    )
      return;
    event.preventDefault();
    space.value = true;
  }
  function onKeyup(event: KeyboardEvent) {
    if (event.code === 'Space') space.value = false;
  }
  function finish() {
    space.value = false;
    endDrag();
  }
  watchEffect(() => {
    // Touch every reactive input so any editor change re-syncs the renderer.
    void e.project;
    void e.selected;
    void e.selectedBarrier;
    void e.barrierDraft;
    e.syncRenderer();
  });
  onMounted(() => {
    const profile = elevation();
    if (!canvas.value || !profile) return;
    renderer = new TrackRenderer(canvas.value, profile);
    renderer.onDraw = () => {
      if (!renderer) return;
      zoomLevel.value = Math.round((renderer.camera.scale / (renderer.baseScale || 1)) * 100);
      const ideal = 70 / renderer.camera.scale,
        magnitude = 10 ** Math.floor(Math.log10(ideal));
      const units = [1, 2, 5, 10]
        .map((n) => n * magnitude)
        .reduce((best, n) => (Math.abs(n - ideal) < Math.abs(best - ideal) ? n : best));
      scaleWidth.value = units * renderer.camera.scale;
      scaleLabel.value = units >= 1000 ? `${number(units / 1000)} km` : `${number(units)} m`;
    };
    e.attachRenderer(renderer, finish);
    document.addEventListener('keydown', onKeydown);
    document.addEventListener('keyup', onKeyup);
  });
  onBeforeUnmount(() => {
    finish();
    e.attachRenderer(null);
    renderer?.dispose();
    renderer = null;
    document.removeEventListener('keydown', onKeydown);
    document.removeEventListener('keyup', onKeyup);
  });
  return {
    cursor,
    hint,
    zoomLevel,
    scaleWidth,
    scaleLabel,
    pointerDown,
    pointerMove,
    endDrag,
    doubleClick,
    wheel,
    profileClick,
  };
}
