import type { ToolId } from '../../stores/editor';
import { addTool } from './add';
import { barrierTool } from './barrier';
import { panTool } from './pan';
import { pitsTool } from './pits';
import { selectTool } from './select';
import { widthTool } from './width';
import type { Tool } from './tool';

export const TOOLS: Record<ToolId, Tool> = {
  select: selectTool,
  add: addTool,
  barrier: barrierTool,
  pits: pitsTool,
  width: widthTool,
  pan: panTool,
};

export { panGesture } from './pan';
export type { Gesture, PointerInput, Tool, ToolContext } from './tool';
