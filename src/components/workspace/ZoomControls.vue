<script setup lang="ts">
import { t } from '../../i18n';
import { useEditorStore } from '../../stores/editor';
import { useViewportStore } from '../../stores/viewport';
import ToolButton from '../ui/ToolButton.vue';

const editor = useEditorStore();
const viewport = useViewportStore();
</script>

<template>
  <div class="zoom" role="toolbar" :aria-label="t('editor.zoomAria')">
    <ToolButton
      id="zoom-out"
      icon="minus"
      :label="t('editor.zoomOut')"
      @click="viewport.zoom(0.8)"
    />
    <span v-if="editor.view === '2d'" id="zoom-level" class="level"
      >{{ viewport.zoomPercent }} %</span
    >
    <ToolButton id="zoom-in" icon="plus" :label="t('editor.zoomIn')" @click="viewport.zoom(1.25)" />
    <span class="divider"></span>
    <ToolButton id="fit-view" icon="fit" :label="t('editor.fitTitle')" @click="viewport.fit()" />
  </div>
</template>

<style scoped>
.zoom {
  position: absolute;
  bottom: 17px;
  right: 16px;
  display: flex;
  align-items: center;
  background: #18221fef;
  border: 1px solid #3c4942;
  border-radius: 5px;
  padding: 2px;
  color: #bfceb2;
  --icon-size: 15px;
}
.zoom .tool {
  width: 28px;
  height: 28px;
}
.level {
  width: 42px;
  text-align: center;
  font-family: monospace;
  font-size: 10px;
}
.divider {
  width: 1px;
  height: 18px;
  background: #3a4941;
  margin: 0 5px;
}
</style>
