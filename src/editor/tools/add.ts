import { sampleAt } from '../../core/track/centerline';
import { t } from '../../i18n';
import type { Tool } from './tool';

/**
 * Adds a control point after the selected one at each click on the plan. In the
 * 3D preview, where the ground hides the plan, it inserts one where the road is
 * clicked instead.
 */
export const addTool: Tool = {
  cursor: () => 'crosshair',
  hint: () => 'canvas.hintAdd',
  press({ project, editor, ui }, { hit, screen }) {
    if (screen) return editor.addPoint({ x: hit.ground.x, z: hit.ground.z });
    if (!hit.road) return ui.notify(t('preview.addOnRoad'), true);
    const sample = sampleAt(project.samples, hit.road.s)!;
    editor.addPoint(sample, sample.segment);
  },
};
