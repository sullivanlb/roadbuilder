<script setup lang="ts">
import type { LayerId } from '../../editor/layers';
import { t } from '../../i18n';
import { useEditorStore } from '../../stores/editor';
import { useProjectStore } from '../../stores/project';
import AppIcon from '../ui/AppIcon.vue';

/** The layers, the active one highlighted; the eye hides a layer on the plan. */
const store = useProjectStore();
const editor = useEditorStore();

function count(id: LayerId): number | null {
  const project = store.project;
  if (id === 'track') return project.points.length;
  if (id === 'road') return project.widthZones.length + project.bankZones.length;
  if (id === 'edges') return project.barriers.length;
  return null;
}
const hidden = (id: LayerId) => editor.hiddenLayers.includes(id);
</script>

<template>
  <nav class="rail" :aria-label="t('layers.aria')">
    <h2>{{ t('layers.title') }}</h2>
    <div
      v-for="layer in editor.layers"
      :key="layer.id"
      class="row"
      :class="{ active: editor.layer === layer.id, planned: layer.planned }"
    >
      <button
        :id="`layer-${layer.id}`"
        type="button"
        class="layer"
        :aria-pressed="editor.layer === layer.id"
        @click="editor.setLayer(layer.id)"
      >
        <kbd>{{ layer.key }}</kbd>
        <span class="name"
          >{{ t(`layers.${layer.id}`) }}
          <small
            >{{ layer.planned ? `${t('layers.planned')} · ` : ''
            }}{{ t(`layers.${layer.id}Sub`) }}</small
          ></span
        >
        <span v-if="count(layer.id) !== null" class="count">{{ count(layer.id) }}</span>
      </button>
      <button
        v-if="layer.id !== 'track'"
        :id="`layer-eye-${layer.id}`"
        type="button"
        class="eye"
        :class="{ off: hidden(layer.id) }"
        :aria-pressed="!hidden(layer.id)"
        :aria-label="
          t(hidden(layer.id) ? 'layers.show' : 'layers.hide', { layer: t(`layers.${layer.id}`) })
        "
        :title="
          t(hidden(layer.id) ? 'layers.show' : 'layers.hide', { layer: t(`layers.${layer.id}`) })
        "
        @click="editor.toggleLayer(layer.id)"
      >
        <AppIcon name="eye" />
      </button>
    </div>
    <p class="note">{{ t('layers.note') }}</p>
    <p class="note privacy">{{ t('editor.privacy') }}</p>
  </nav>
</template>

<style scoped>
.rail {
  background: var(--panel);
  border-right: 1px solid var(--line);
  padding: 16px 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
}
h2 {
  font-size: 11px;
  font-weight: 600;
  color: var(--faint);
  margin: 0 8px 8px;
}
.row {
  display: flex;
  align-items: center;
  border: 1px solid transparent;
  border-radius: var(--radius);
}
.row:hover {
  background: var(--panel-2);
}
.row.active {
  background: var(--panel-2);
  border-color: var(--line-strong);
}
.layer {
  flex: 1;
  min-width: 0;
  display: grid;
  grid-template-columns: 20px 1fr auto;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: none;
  border: 0;
  text-align: left;
}
.layer kbd {
  text-align: center;
  padding: 1px 0;
}
.name {
  font-weight: 600;
  font-size: 12px;
  min-width: 0;
}
.active .name {
  color: var(--accent);
}
.planned .name {
  color: var(--faint);
}
.name small {
  display: block;
  font-weight: 400;
  font-size: 10px;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.count {
  font-family: var(--mono);
  font-size: 10px;
  color: var(--faint);
}
.eye {
  border: 0;
  background: none;
  color: var(--faint);
  padding: 6px;
  margin-right: 4px;
  border-radius: 4px;
  line-height: 0;
  --icon-size: 15px;
}
.eye:hover {
  color: var(--text);
  background: var(--hover);
}
.note:first-of-type {
  margin-top: auto;
}
.privacy {
  padding-top: 6px;
}
.eye.off {
  opacity: 0.4;
}
.note {
  padding: 12px 8px 0;
  font-size: 10px;
  line-height: 1.6;
  color: var(--faint);
}
@media (max-width: 860px) {
  .rail {
    flex-direction: row;
    overflow-x: auto;
    border-right: 0;
    border-bottom: 1px solid var(--line);
    padding: 6px;
  }
  h2,
  .note,
  .name small {
    display: none;
  }
  .layer {
    white-space: nowrap;
  }
}
</style>
