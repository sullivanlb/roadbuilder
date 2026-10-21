<script setup lang="ts">
import { computed } from 'vue';
import type { SoonTool } from '../../editor/layers';
import { t } from '../../i18n';
import type { MessageKey } from '../../i18n';
import { useEditorStore } from '../../stores/editor';
import type { ToolId } from '../../stores/editor';
import { useProjectStore } from '../../stores/project';
import { useUiStore } from '../../stores/ui';
import type { IconName } from '../ui/icons';
import ToolButton from '../ui/ToolButton.vue';

/** The tools of the active layer between selection and hand, then the ones planned for it. */
const store = useProjectStore();
const editor = useEditorStore();
const ui = useUiStore();

const TOOL_LOOK: Record<ToolId, { icon: IconName; label: MessageKey }> = {
  select: { icon: 'cursor', label: 'editor.selectTitle' },
  add: { icon: 'plus', label: 'editor.addTitle' },
  straight: { icon: 'straight', label: 'editor.straightTitle' },
  arc: { icon: 'arc', label: 'editor.arcTitle' },
  width: { icon: 'width', label: 'editor.widthTitle' },
  bank: { icon: 'banking', label: 'editor.bankTitle' },
  barrier: { icon: 'wall', label: 'editor.barrierTitle' },
  pits: { icon: 'pits', label: 'editor.pitsTitle' },
  tree: { icon: 'trees', label: 'editor.treeTitle' },
  building: { icon: 'building', label: 'editor.buildingTitle' },
  grandstand: { icon: 'grandstands', label: 'editor.grandstandTitle' },
  sign: { icon: 'sign', label: 'editor.signTitle' },
  light: { icon: 'light', label: 'editor.lightTitle' },
  pan: { icon: 'move', label: 'editor.panTitle' },
};

const layer = computed(() => editor.layers.find((candidate) => candidate.id === editor.layer)!);
const tools = computed<ToolId[]>(() => ['select', ...layer.value.tools, 'pan']);
const showSoon = (tool: SoonTool) => ui.notify(t(tool.note));
</script>

<template>
  <div class="palette" role="toolbar" :aria-label="t('editor.toolsAria')">
    <ToolButton
      v-for="tool in tools"
      :id="`tool-${tool}`"
      :key="tool"
      :icon="TOOL_LOOK[tool].icon"
      :label="t(TOOL_LOOK[tool].label)"
      :active="editor.tool === tool"
      :aria-pressed="editor.tool === tool"
      @click="editor.setTool(tool)"
    />
    <template v-if="layer.soon.length">
      <span class="divider"></span>
      <ToolButton
        v-for="tool in layer.soon"
        :id="`soon-${tool.id}`"
        :key="tool.id"
        :icon="tool.id as IconName"
        :label="t('soon.title', { tool: t(tool.label) })"
        soon
        @click="showSoon(tool)"
      />
    </template>
    <span class="divider"></span>
    <ToolButton
      id="undo"
      icon="undo"
      :label="t('editor.undoTitle')"
      :disabled="!store.canUndo"
      @click="store.undo()"
    />
    <ToolButton
      id="redo"
      icon="redo"
      :label="t('editor.redoTitle')"
      :disabled="!store.canRedo"
      @click="store.redo()"
    />
  </div>
</template>

<style scoped>
.palette {
  display: flex;
  flex-wrap: wrap;
  position: absolute;
  left: 12px;
  top: 12px;
  max-width: calc(100% - 200px);
  align-items: center;
  padding: 5px;
  border: 1px solid #3c4942;
  border-radius: var(--radius);
  background: #17211fef;
  gap: 2px;
  box-shadow: 0 4px 16px #0002;
}
.divider {
  width: 1px;
  height: 18px;
  background: #3a4941;
  margin: 0 5px;
}
@media (max-width: 860px) {
  .palette {
    max-width: calc(100% - 24px);
    top: 56px;
  }
}
</style>
