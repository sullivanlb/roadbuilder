import type { Id } from '../core/ids';
import type { Project } from '../core/project/schema';
import type { Sample } from '../core/track/centerline';
import type { TrackIssue } from '../core/track/issues';
import { bankZoneAt } from '../core/track/bank';
import { pitLaneLayout } from '../core/track/pitLane';
import { widthZoneAt } from '../core/track/width';
import type { MessageKey } from '../i18n';
import type { LayerId } from '../rendering/layers';
import type { TrackHit } from '../rendering/plan/hitTest';
import type { ToolId } from '../stores/editor';

export type { LayerId, TrackHit };

// The editor works on one layer at a time (docs/adr/0009). The active layer
// decides what a click picks and which tools are offered; the others stay
// visible, dimmed, or can be hidden.

/** A tool planned for a layer: shown dashed, a click tells what it will do. */
export interface SoonTool {
  id: string;
  label: MessageKey;
  note: MessageKey;
}

export interface Layer {
  id: LayerId;
  /** Keyboard shortcut. */
  key: string;
  /** Tools of this layer, besides the selection and the hand, offered everywhere. */
  tools: readonly ToolId[];
  soon: readonly SoonTool[];
  /** A layer not built yet: shown dashed in the list. */
  planned?: true;
}

const soon = (id: string): SoonTool => ({
  id,
  label: `soon.${id}` as MessageKey,
  note: `soon.${id}Note` as MessageKey,
});

export const LAYERS: readonly Layer[] = [
  {
    id: 'track',
    key: '1',
    tools: ['add', 'straight', 'arc'],
    soon: [soon('freehand')],
  },
  { id: 'road', key: '2', tools: ['width', 'bank'], soon: [soon('surface')] },
  { id: 'edges', key: '3', tools: ['barrier'], soon: [soon('runoff')] },
  { id: 'pits', key: '4', tools: ['pits'], soon: [soon('sectors')] },
  { id: 'terrain', key: '5', tools: [], soon: [soon('sculpt')] },
  { id: 'decor', key: '6', tools: [], soon: [soon('trees'), soon('grandstands')], planned: true },
];

/** The layer a tool belongs to, or null for the tools offered on every layer. */
export const layerOfTool = (tool: ToolId): LayerId | null =>
  LAYERS.find((layer) => layer.tools.includes(tool))?.id ?? null;

/** What one editor selection holds; a single kind at a time. */
export type Selection =
  | { kind: 'points'; ids: readonly Id[] }
  | { kind: 'barrier'; id: Id }
  | { kind: 'widthZone'; id: Id }
  | { kind: 'bankZone'; id: Id }
  | { kind: 'pitLane' }
  | null;

const SELECTION_LAYER: Record<NonNullable<Selection>['kind'], LayerId> = {
  points: 'track',
  widthZone: 'road',
  bankZone: 'road',
  barrier: 'edges',
  pitLane: 'pits',
};

/** The layer whose elements a selection holds. */
export const layerOfSelection = (selection: Selection): LayerId | null =>
  selection ? SELECTION_LAYER[selection.kind] : null;

/**
 * What a click on `hit` selects in a layer: only that layer's elements answer.
 * Where a width zone and a bank zone share the road, the click keeps to the kind
 * of the `current` selection, and a click on what is already selected takes the
 * other one.
 */
export function pickInLayer(
  layer: LayerId,
  hit: TrackHit,
  project: Project,
  samples: readonly Sample[],
  current: Selection = null,
): Selection {
  switch (layer) {
    case 'track':
      return hit.pointId ? { kind: 'points', ids: [hit.pointId] } : null;
    case 'road': {
      if (!hit.road) return null;
      const width = widthZoneAt(project, samples, hit.road.s),
        bank = bankZoneAt(project, samples, hit.road.s);
      const found = [
        ...(width ? [{ kind: 'widthZone', id: width.id } as const] : []),
        ...(bank ? [{ kind: 'bankZone', id: bank.id } as const] : []),
      ];
      if (current?.kind === 'bankZone') found.reverse();
      const selected = current && 'id' in current && found[0]?.id === current.id;
      return (selected ? found[1] : found[0]) ?? found[0] ?? null;
    }
    case 'edges':
      return hit.barrierId ? { kind: 'barrier', id: hit.barrierId } : null;
    case 'pits': {
      const lane = pitLaneLayout(project, samples);
      const onLane = lane && hit.road?.side === lane.side && lane.along(hit.road.s) !== null;
      return onLane ? { kind: 'pitLane' } : null;
    }
    case 'terrain':
    case 'decor':
      return null;
  }
}

const ISSUE_LAYER: Partial<Record<TrackIssue['code'], LayerId>> = {
  'pit-lane-too-short': 'pits',
  'pit-lane-too-tight': 'pits',
  'width-zones-overlap': 'road',
  'bank-zones-overlap': 'road',
};

/** The layer where a track issue is fixed. */
export const issueLayer = (issue: TrackIssue): LayerId => ISSUE_LAYER[issue.code] ?? 'track';
