import { sampleAt } from '../core/track/centerline';
import type { TrackHit } from '../rendering/plan/hitTest';
import { t } from '../i18n';
import { isEarthworkTool, isSceneryTool } from '../stores/editor';
import type { useUiStore } from '../stores/ui';
import { pickInLayer } from './layers';
import type { ToolContext } from './tools';

type PreviewContext = Omit<ToolContext, 'viewport'> & { ui: ReturnType<typeof useUiStore> };

/**
 * A click in the 3D preview, resolved into what lies under it. The active tool
 * and layer act on it as they would on the plan; control points are selected
 * there but only dragged on the plan.
 */
export function previewClick(
  { project, editor, ui }: PreviewContext,
  hit: TrackHit,
  shiftKey: boolean,
) {
  const road = hit.road;
  if (isSceneryTool(editor.tool)) return editor.placeScenery(editor.tool, hit.ground);
  if (editor.tool === 'hill') return editor.placeHill(hit.ground);
  if (isEarthworkTool(editor.tool)) {
    if (!road) return;
    if (editor.earthworkDraft) editor.completeEarthwork(road.s);
    else editor.beginEarthwork(road);
    return;
  }
  switch (editor.tool) {
    case 'barrier':
      if (!road) return;
      if (editor.barrierDraft) editor.completeBarrier(road.s);
      else editor.beginBarrier(road);
      return;
    case 'width':
      if (!road) return;
      if (editor.widthDraft !== null) editor.completeWidthZone(road.s);
      else editor.beginWidthZone(road.s);
      return;
    case 'bank':
      if (!road) return;
      if (editor.bankDraft !== null) editor.completeBankZone(road.s);
      else editor.beginBankZone(road.s);
      return;
    case 'pits':
      if (!road) return;
      if (editor.pitDraft) editor.completePitLane(road.s);
      else editor.beginPitLane(road);
      return;
    case 'add': {
      if (!road) return ui.notify(t('preview.addOnRoad'), true);
      const sample = sampleAt(project.samples, road.s)!;
      editor.addPoint(sample, sample.segment);
      return;
    }
    case 'straight':
    case 'arc':
      return ui.notify(t('preview.drawOnPlan'), true);
    case 'select':
      if (editor.layer === 'track' && hit.pointId) {
        if (shiftKey) editor.togglePoint(hit.pointId);
        else editor.selectPoint(hit.pointId);
        return;
      }
      if (editor.layer === 'scenery' && hit.sceneryId && shiftKey)
        return editor.toggleScenery(hit.sceneryId);
      editor.select(
        pickInLayer(editor.layer, hit, project.project, project.samples, editor.selection),
      );
      return;
    case 'pan':
      return;
    // The brush paints while held, from the preview itself.
    case 'sculpt':
      return;
  }
}

/** The pointer moving over the preview: the band follows it, and so does a stretch being laid. */
export function previewHover(
  { editor }: Pick<PreviewContext, 'editor'>,
  hit: Pick<TrackHit, 'road'>,
) {
  const road = hit.road;
  editor.hoverS = road?.s ?? null;
  if (editor.barrierDraft) editor.barrierTarget = road?.s ?? null;
  if (editor.widthDraft !== null) editor.widthTarget = road?.s ?? null;
  if (editor.bankDraft !== null) editor.bankTarget = road?.s ?? null;
  if (editor.pitDraft) editor.pitTarget = road;
  if (editor.earthworkDraft) editor.earthworkTarget = road?.s ?? null;
}
