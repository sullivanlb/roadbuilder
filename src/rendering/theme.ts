import type { BarrierType } from '../core/project/schema';

/** Colours of the canvas drawings, kept in one place so the plan, profile and preview agree. */
export const COLORS = {
  accent: '#d3f47d',
  danger: '#ec8b7f',
  dangerFill: '#412a25',
  background: { center: '#28392b', edge: '#17251f' },
  grid: { line: '#667e4b12', dot: '#a0bc6c22' },
  terrain: { fill: '#627d3a28', outline: '#adc68a80' },
  road: {
    shadow: '#0d191f50',
    shoulder: '#4c623a',
    kerbWhite: '#c3c4ac',
    kerbRed: '#b35949',
    edge: '#89918a',
    asphalt: '#3e4848',
    centerLine: '#b1c39185',
    arrow: '#d8eab9aa',
  },
  start: { light: '#e4e9d6', dark: '#202923', label: '#b3c69b' },
  point: {
    fill: '#1b2b22',
    outline: '#c9dda7',
    hover: '#efffdc',
    label: '#a8bc8c',
    selectedLabel: '#e4ffa4',
    halo: '#d3f47d16',
    haloOutline: '#d3f47d66',
  },
  selection: '#d3f47d44',
  widthZone: '#e4e9d6aa',
  band: {
    row: '#141d20',
    range: '#d3f47d24',
    label: '#8c9a9c',
    base: '#5f7377',
    tick: '#5f7377',
    blockText: '#1b2714',
    corner: '#a0bc6c14',
  },
  pits: { lane: '#596264', wall: '#ddd9c9', box: '#d3f47d99', grid: '#e4e9d6aa' },
  profile: { grid: '#39504355', line: '#bddb86', fillTop: '#a7cb5e40', fillBottom: '#a7cb5e03' },
  preview: { sky: '#17251f' },
} as const;

/** How each barrier type is drawn on the plan and in the sidebar. */
export const BARRIER_STYLE: Record<BarrierType, { color: string; width: number; dash: number[] }> =
  {
    guardrail: { color: '#c8d3d7', width: 2.5, dash: [] },
    tires: { color: '#98a2a9', width: 3, dash: [2, 3] },
    tecpro: { color: '#d0664a', width: 3.5, dash: [6, 4] },
    wall: { color: '#e7e6da', width: 4, dash: [] },
  };
