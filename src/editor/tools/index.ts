import type { ToolId } from '../../stores/editor';
import { addTool } from './add';
import { arcTool } from './arc';
import { bankTool } from './bank';
import { barrierTool } from './barrier';
import { panTool } from './pan';
import { pitsTool } from './pits';
import { selectTool } from './select';
import { straightTool } from './straight';
import { widthTool } from './width';
import type { Tool } from './tool';

export const TOOLS: Record<ToolId, Tool> = {
  select: selectTool,
  add: addTool,
  straight: straightTool,
  arc: arcTool,
  barrier: barrierTool,
  pits: pitsTool,
  width: widthTool,
  bank: bankTool,
  pan: panTool,
};

export { panGesture } from './pan';
export type { Gesture, PointerInput, Tool, ToolContext } from './tool';
