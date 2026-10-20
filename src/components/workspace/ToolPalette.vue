<script setup lang="ts">
import { computed } from 'vue';
import { t } from '../../i18n';
import { useEditorStore } from '../../stores/editor';
import type { ToolId } from '../../stores/editor';
import { useProjectStore } from '../../stores/project';
import type { IconName } from '../ui/icons';
import ToolButton from '../ui/ToolButton.vue';

const store = useProjectStore();
const editor = useEditorStore();
const tools = computed<{ id: ToolId; icon: IconName; label: string }[]>(() => [
  { id: 'select', icon: 'cursor', label: t('editor.selectTitle') },
  { id: 'add', icon: 'plus', label: t('editor.addTitle') },
  { id: 'barrier', icon: 'wall', label: t('editor.barrierTitle') },
  { id: 'pits', icon: 'pits', label: t('editor.pitsTitle') },
  { id: 'width', icon: 'width', label: t('editor.widthTitle') },
  { id: 'pan', icon: 'move', label: t('editor.panTitle') },
]);
</script>

<template>
  <div class="palette" role="toolbar" :aria-label="t('editor.toolsAria')">
    <ToolButton
      v-for="tool in tools"
      :id="`tool-${tool.id}`"
      :key="tool.id"
      :icon="tool.icon"
      :label="tool.label"
      :active="editor.tool === tool.id"
      :aria-pressed="editor.tool === tool.id"
      @click="editor.setTool(tool.id)"
    />
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
  position: absolute;
  left: 16px;
  top: 16px;
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
</style>
