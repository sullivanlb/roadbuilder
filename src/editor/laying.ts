import type { Draft } from 'immer';
import {
  addBankZone,
  addBarrier,
  addEarthwork,
  addWidthZone,
  bankZoneRejection,
  barrierRejection,
  earthworkRejection,
  setPitLane,
  widthZoneRejection,
} from '../core/project/edits';
import { RULES } from '../core/project/rules';
import { EARTHWORK_TYPES, isCircuit } from '../core/project/schema';
import type {
  BarrierType,
  EarthworkType,
  Project,
  Side,
  TrackPosition,
} from '../core/project/schema';
import { outsideOf } from '../core/track/bank';
import { trackLength } from '../core/track/centerline';
import type { Sample } from '../core/track/centerline';
import { LAYOUT } from '../core/track/layout';
import { positionAt } from '../core/track/positions';
import { rangeBetween, rangeSamples } from '../core/track/ranges';
import type { LaidKind, TrackRange } from '../core/track/ranges';
import { t } from '../i18n';
import type { MessageKey } from '../i18n';
import type { Selection } from '../rendering/editing';
import type { ToolId } from '../stores/editor';

// Barriers, width and bank zones, the pit lane and earthworks are laid the same
// way along the track (docs/adr/0008): two clicks on the road, in any view, or
// a stretch picked in the band. This module knows each kind once: its tool, how
// far it runs between two clicks, why it is refused and how it is added.

export type { LaidKind };

/** A place on the road and the side it points at, as a track distance. */
export interface RoadSpot {
  s: number;
  side: Side;
}

/** The first click of what is being laid, waiting for the second. */
export interface Laying {
  kind: LaidKind;
  from: RoadSpot;
}

/** What is laid besides its stretch: the side clicked, and the types chosen in the inspector. */
export interface LayChoices {
  side: Side;
  barrierType: BarrierType;
  earthworkType: EarthworkType;
}

interface KindRules {
  /** The message telling why it cannot be laid over a stretch, or null when it can. */
  refusal(project: Project, samples: readonly Sample[], stretch: TrackRange): string | null;
  /** Adds it between two track positions; returns what to select. */
  add(
    draft: Draft<Project>,
    ends: { from: TrackPosition; to: TrackPosition },
    choices: LayChoices & { high: Side },
  ): Selection;
  /** Told once it is laid. */
  added: MessageKey;
  /** A track has a single one: once laid, the tool goes back to selecting. */
  single?: true;
}

const min = RULES.rangeLength;

const KINDS: Record<LaidKind, KindRules> = {
  barrier: {
    refusal(project, _, stretch) {
      const rejection = barrierRejection(project, stretch);
      if (rejection === 'too-short') return t('toast.barrierTooShort', { min });
      if (rejection === 'barriers-limit')
        return t('toast.barriersLimit', { max: RULES.barriers.max });
      return null;
    },
    add: (draft, ends, { side, barrierType }) => ({
      kind: 'barrier',
      id: addBarrier(draft, { type: barrierType, side, ...ends }),
    }),
    added: 'toast.barrierAdded',
  },
  widthZone: {
    refusal(project, samples, stretch) {
      const rejection = widthZoneRejection(project, samples, stretch);
      if (rejection === 'width-zones-limit')
        return t('toast.widthZonesLimit', { max: RULES.widthZones.max });
      if (rejection === 'too-short') return t('toast.widthZoneTooShort', { min });
      if (rejection === 'overlap') return t('toast.widthZoneOverlap');
      return null;
    },
    add: (draft, ends) => ({ kind: 'widthZone', id: addWidthZone(draft, ends) }),
    added: 'toast.widthZoneAdded',
  },
  bankZone: {
    refusal(project, samples, stretch) {
      const rejection = bankZoneRejection(project, samples, stretch);
      if (rejection === 'bank-zones-limit')
        return t('toast.bankZonesLimit', { max: RULES.bankZones.max });
      if (rejection === 'too-short') return t('toast.bankZoneTooShort', { min });
      if (rejection === 'overlap') return t('toast.bankZoneOverlap');
      return null;
    },
    // Raised on the outside of its bend.
    add: (draft, ends, { high }) => ({
      kind: 'bankZone',
      id: addBankZone(draft, { ...ends, high }),
    }),
    added: 'toast.bankZoneAdded',
  },
  pitLane: {
    refusal(project, _, stretch) {
      if (!isCircuit(project)) return t('pits.roadOnly');
      if (stretch.length < 2 * LAYOUT.pitLane.taper) return t('toast.pitLaneSamePlace');
      return null;
    },
    add(draft, ends, { side }) {
      setPitLane(draft, { side, entry: ends.from, exit: ends.to });
      return { kind: 'pitLane' };
    },
    added: 'toast.pitLaneAdded',
    single: true,
  },
  earthwork: {
    refusal(project, _, stretch) {
      const rejection = earthworkRejection(project, stretch);
      if (rejection === 'too-short') return t('toast.earthworkTooShort', { min });
      if (rejection === 'earthworks-limit')
        return t('toast.earthworksLimit', { max: RULES.earthworks.max });
      return null;
    },
    add: (draft, ends, { side, earthworkType }) => ({
      kind: 'earthwork',
      id: addEarthwork(draft, { type: earthworkType, side, ...ends }),
    }),
    added: 'toast.earthworkAdded',
  },
};

const TOOL_KINDS: Partial<Record<ToolId, LaidKind>> = {
  barrier: 'barrier',
  width: 'widthZone',
  bank: 'bankZone',
  pits: 'pitLane',
  ...Object.fromEntries(EARTHWORK_TYPES.map((type) => [type, 'earthwork'])),
};

/** What a tool lays along the track, or null for a tool that lays nothing there. */
export const laidKindOfTool = (tool: ToolId): LaidKind | null => TOOL_KINDS[tool] ?? null;

/**
 * The stretch covered between two clicks at track distances `from` and `to`: a
 * pit lane runs from its entry to its exit in track direction, the others the
 * shorter way round a circuit.
 */
export function laidExtent(
  kind: LaidKind,
  project: Project,
  samples: readonly Sample[],
  from: number,
  to: number,
): TrackRange {
  if (kind !== 'pitLane') return rangeBetween(project, samples, from, to);
  const total = trackLength(samples);
  return { start: from, length: (((to - from) % total) + total) % total };
}

/** Laying something over a stretch: how to add it and what to tell, or why it is refused. */
export type Lay =
  | { recipe: (draft: Draft<Project>) => Selection; added: string; single: boolean }
  | { refusal: string };

/** Lays something of a kind over a stretch of track. */
export function lay(
  kind: LaidKind,
  project: Project,
  samples: readonly Sample[],
  stretch: TrackRange,
  choices: LayChoices,
): Lay {
  const rules = KINDS[kind];
  const refusal = rules.refusal(project, samples, stretch);
  if (refusal) return { refusal };
  const ends = {
    from: positionAt(project, samples, stretch.start),
    to: positionAt(project, samples, stretch.start + stretch.length),
  };
  const high = kind === 'bankZone' ? outsideOf(rangeSamples(samples, stretch)) : choices.side;
  return {
    recipe: (draft) => rules.add(draft, ends, { ...choices, high }),
    added: t(rules.added),
    single: rules.single === true,
  };
}
