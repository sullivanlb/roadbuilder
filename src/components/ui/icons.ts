/** Line icons on a 24×24 grid, drawn with the current colour. */
export const ICONS = {
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  folder: 'M3 19V5h6l2 3h10v11zM3 10h18',
  save: 'm4 3 13 0 4 4v14H3V3zM7 3v6h9V3M7 21v-8h10v8',
  export: 'M12 3v12m-5-5 5 5 5-5M4 15v6h16v-6',
  cursor: 'm5 3 14 10-7 1-3 7z',
  move: 'M12 2v20M2 12h20M8 6l4-4 4 4M8 18l4 4 4-4M6 8l-4 4 4 4m12-8 4 4-4 4',
  undo: 'M4 5v7h7M4 12c3-9 16-9 16 1 0 4-4 7-8 6',
  redo: 'M20 5v7h-7m7 0C17 3 4 3 4 13c0 4 4 7 8 6',
  fit: 'M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6M8 8h8v8H8z',
  trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
  help: 'M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0M9 8c0-3 6-3 6 0 0 2-3 2-3 5m0 3v1',
  close: 'm6 6 12 12M6 18 18 6',
  cube: 'm12 2 9 5v10l-9 5-9-5V7zM3 7l9 5 9-5M12 12v10M7 4l10 6',
  map: 'm3 5 6-3 6 3 6-3v17l-6 3-6-3-6 3zM9 2v17m6-14v17',
  route:
    'M2 6a3 3 0 1 0 6 0a3 3 0 1 0-6 0M16 18a3 3 0 1 0 6 0a3 3 0 1 0-6 0M8 6h9a4 4 0 0 1 0 8H7a2 2 0 0 0 0 4h9',
  wall: 'M4 4v16M12 4v16M20 4v16M3 9h18M3 15h18',
  flag: 'M5 22V3m0 1c5-4 9 4 15 0v10c-6 4-10-4-15 0',
  pits: 'M3 4v16M8 4v16M8 8h13M8 14h13M12 8v6M17 8v6',
  width: 'M7 3v18M17 3v18M10 12H3m4-3-3 3 3 3m7-3h7m-4-3 3 3-3 3',
} as const;

export type IconName = keyof typeof ICONS;
