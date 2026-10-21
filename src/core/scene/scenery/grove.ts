import { clamp } from '../../math';
import type { SceneryItem } from '../../project/schema';
import { random } from './kit';

/** One tree of a grove: where it stands in the frame of its item, its size and how it is turned. */
export interface GroveTree {
  u: number;
  v: number;
  height: number;
  crown: number;
  /** Turn about its trunk, in radians, so trees of a grove do not look alike. */
  turn: number;
}

/**
 * The trees of a grove, spread evenly over its width on a sunflower spiral and
 * shaken a little from its ID, so the same item always grows the same trees.
 */
export function groveTrees(item: SceneryItem): GroveTree[] {
  const count = item.count ?? 1;
  const next = random(item.id);
  if (count === 1)
    return [{ u: 0, v: 0, height: item.height, crown: item.width, turn: next() * 2 * Math.PI }];
  const crown = clamp((item.width / Math.sqrt(count)) * 1.25, 2, item.width / 2);
  const reach = Math.max(0, item.width / 2 - crown / 2);
  return Array.from({ length: count }, (_, i) => {
    const radius = reach * Math.sqrt((i + 0.5 + (next() - 0.5) * 0.6) / count);
    const angle = i * 2.399963 + (next() - 0.5) * 0.8;
    return {
      u: Math.cos(angle) * radius,
      v: Math.sin(angle) * radius,
      height: item.height * (0.8 + next() * 0.35),
      crown: crown * (0.85 + next() * 0.3),
      turn: next() * 2 * Math.PI,
    };
  });
}
