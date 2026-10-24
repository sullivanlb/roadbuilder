import { EARTHWORK_TYPES, SCENERY_KINDS } from '../../core/project/schema';
import type { EarthworkType, SceneryKind } from '../../core/project/schema';
import type { MessageKey } from '../../i18n';
import type { ToolId } from '../../stores/editor';
import { addTool } from './add';
import { arcTool } from './arc';
import { hillTool } from './hill';
import { layTool } from './lay';
import { sculptTool } from './sculpt';
import { panTool } from './pan';
import { placeTool } from './scenery';
import { selectTool } from './select';
import { straightTool } from './straight';
import type { Tool } from './tool';

const EARTHWORK_HINT: Record<EarthworkType, MessageKey> = {
  embankment: 'canvas.hintEmbankment',
  ditch: 'canvas.hintDitch',
  runoff: 'canvas.hintRunoff',
};

export const TOOLS: Record<ToolId, Tool> = {
  select: selectTool,
  add: addTool,
  straight: straightTool,
  arc: arcTool,
  barrier: layTool('canvas.hintBarrier', 'canvas.hintBarrierDraft'),
  pits: layTool('canvas.hintPits', 'canvas.hintPitsDraft'),
  width: layTool('canvas.hintWidth', 'canvas.hintWidthDraft'),
  bank: layTool('canvas.hintBank', 'canvas.hintBankDraft'),
  ...(Object.fromEntries(SCENERY_KINDS.map((kind) => [kind, placeTool(kind)])) as Record<
    SceneryKind,
    Tool
  >),
  hill: hillTool,
  sculpt: sculptTool,
  ...(Object.fromEntries(
    EARTHWORK_TYPES.map((type) => [
      type,
      layTool(EARTHWORK_HINT[type], 'canvas.hintEarthworkDraft'),
    ]),
  ) as Record<EarthworkType, Tool>),
  pan: panTool,
};

/** The keys that pick a tool, with how the help names what they do; in the order the help lists them. */
export const TOOL_KEYS: readonly { tool: ToolId; key: string; help: MessageKey }[] = [
  { tool: 'select', key: 'v', help: 'help.shortcutSelect' },
  { tool: 'add', key: 'a', help: 'help.shortcutAdd' },
  { tool: 'straight', key: 's', help: 'help.shortcutStraight' },
  { tool: 'arc', key: 'r', help: 'help.shortcutArc' },
  { tool: 'barrier', key: 'b', help: 'help.shortcutBarrier' },
  { tool: 'pits', key: 'p', help: 'help.shortcutPits' },
  { tool: 'width', key: 'l', help: 'help.shortcutWidth' },
  { tool: 'bank', key: 'd', help: 'help.shortcutBank' },
  { tool: 'pan', key: 'h', help: 'help.shortcutPan' },
];

export { panGesture } from './pan';
export type { Gesture, PointerInput, Tool, ToolContext } from './tool';
