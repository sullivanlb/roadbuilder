import { TREE_MODELS } from '../../../assets/scenery';
import type { SceneryModel } from '../../../assets/scenery';
import { clamp } from '../../math';
import type { PlanPoint } from '../../math';
import type { SceneryItem } from '../../project/schema';
import { groveTrees } from './grove';
import { itemPlace, turnedPlace } from './kit';
import type { ItemFrame, Parts } from './kit';

const spreads = new Map<SceneryModel, number>();

/** How wide a model's crown spreads, from its trunk out to its farthest point and back. */
function spread(model: SceneryModel) {
  let found = spreads.get(model);
  if (found === undefined) {
    found = 0;
    for (const part of model.parts)
      for (let i = 0; i < part.positions.length; i += 3)
        found = Math.max(found, 2 * Math.hypot(part.positions[i], part.positions[i + 1]));
    spreads.set(model, found);
  }
  return found;
}

/**
 * The trees of an item, each on the ground under it, scaled to its height. Its
 * crown follows the width asked within reason: a tree is never squeezed or
 * spread to more than half again its natural shape.
 */
export function trees(
  parts: Parts,
  frame: ItemFrame,
  item: SceneryItem,
  heightAt: (p: PlanPoint) => number,
) {
  const model = TREE_MODELS[item.variant === 'conifer' ? 'conifer' : 'leafy'];
  const place = itemPlace(frame);
  for (const tree of groveTrees(item)) {
    const [x, , z] = place(tree.u, tree.v, 0);
    const foot = itemPlace({ ...frame, x, z, y: heightAt({ x, z }) });
    const up = tree.height / model.height;
    const across = clamp(tree.crown / spread(model), up / 1.5, up * 1.5);
    parts.model(model, turnedPlace(foot, tree.turn), [across, across, up]);
    if (item.solid) parts.block(foot, 0, 0, 0, 0);
  }
}
