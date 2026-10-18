import type { BarrierType } from '../domain/types';

/** 2D style of each barrier type (colour, line width, dash pattern). */
export const BARRIER_STYLE: Record<BarrierType, { color: string; width: number; dash: number[] }> =
  {
    guardrail: { color: '#c8d3d7', width: 2.5, dash: [] },
    tires: { color: '#98a2a9', width: 3, dash: [2, 3] },
    tecpro: { color: '#d0664a', width: 3.5, dash: [6, 4] },
    wall: { color: '#e7e6da', width: 4, dash: [] },
  };

/** Colour of the barrier segment being drawn. */
export const DRAFT_COLOR = '#d3f47d';
