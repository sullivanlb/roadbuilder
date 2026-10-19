<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { rename } from '../../core/project/edits';
import { RULES } from '../../core/project/rules';
import { t } from '../../i18n';
import { useFilesStore } from '../../stores/files';
import { useProjectStore } from '../../stores/project';
import { useUiStore } from '../../stores/ui';
import AppIcon from '../ui/AppIcon.vue';
import BarrierSection from './BarrierSection.vue';
import PointSection from './PointSection.vue';
import RoadSection from './RoadSection.vue';
import TerrainSection from './TerrainSection.vue';
import TrackSection from './TrackSection.vue';

const store = useProjectStore();
const files = useFilesStore();
const ui = useUiStore();

const saveFailed = computed(
  () => files.saveState === 'unavailable' || files.saveState === 'recovery',
);

// The field shows what is typed (even blank) until it loses focus; the project gets a clean name.
const name = ref(store.project.name);
let typing = false;
watch(
  () => store.project.name,
  (next) => {
    if (!typing) name.value = next;
  },
);
function onNameInput(event: Event) {
  typing = true;
  name.value = (event.target as HTMLInputElement).value;
  store.edit((draft) => rename(draft, name.value, t('project.defaultName')), { commit: false });
}
function onNameDone() {
  typing = false;
  name.value = store.project.name;
  store.commit();
}
</script>

<template>
  <aside class="sidebar" :aria-label="t('sidebar.aria')">
    <div class="heading">
      <span class="eyebrow">{{ t('sidebar.eyebrow') }}</span>
      <span class="local"><i class="dot"></i> {{ t('sidebar.local') }}</span>
    </div>
    <label class="sr-only" for="project-name">{{ t('sidebar.name') }}</label>
    <input
      id="project-name"
      class="project-name"
      :maxlength="RULES.name.max"
      :value="name"
      spellcheck="false"
      @input="onNameInput"
      @blur="onNameDone"
    />
    <div id="save-status" class="save-status" :class="{ error: saveFailed }" role="status">
      <i v-if="files.saveState === 'saved'" class="dot"></i>{{ t(`save.${files.saveState}`) }}
    </div>

    <TrackSection :index="1" />
    <RoadSection :index="2" />
    <TerrainSection :index="3" />
    <BarrierSection :index="4" />
    <PointSection :index="5" />

    <div class="tip">
      <AppIcon class="tip-icon" name="cursor" />
      <p>
        <strong>{{ t('sidebar.tipTitle') }}</strong
        >{{ t('sidebar.tipBody') }}
      </p>
    </div>
    <button id="open-help" type="button" class="help" @click="ui.openDialog('help')">
      <AppIcon name="help" />{{ t('sidebar.help') }}<span>?</span>
    </button>
  </aside>
</template>

<style scoped>
.sidebar {
  border-right: 1px solid var(--line);
  background: var(--panel);
  padding: 26px 22px 18px;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: #3b494c transparent;
}
.heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 13px;
}
.eyebrow {
  font-size: 9px;
  letter-spacing: 1.8px;
  font-weight: 650;
  color: var(--muted);
}
.local {
  font-family: monospace;
  letter-spacing: 0.9px;
  font-size: 9px;
  color: #a3ad9a;
  display: flex;
  align-items: center;
  gap: 5px;
}
.dot {
  width: 5px;
  height: 5px;
  background: #afc97e;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}
.project-name {
  background: transparent;
  border: 1px solid transparent;
  width: calc(100% + 10px);
  margin-left: -5px;
  padding: 5px 4px;
  border-radius: 4px;
  font-size: 21px;
  font-weight: 600;
  letter-spacing: -0.6px;
  color: var(--text);
}
.project-name:hover {
  border-color: var(--line);
}
.save-status {
  margin-top: 8px;
  font-size: 10px;
  color: var(--muted);
  display: flex;
  align-items: center;
  gap: 7px;
  min-height: 14px;
}
.save-status.error {
  color: var(--red);
}
.tip {
  margin-top: auto;
  padding: 17px 12px;
  border: 1px solid #344136;
  background: #212c25;
  border-radius: 7px;
  display: flex;
  gap: 10px;
}
.tip-icon {
  color: var(--accent);
  margin-top: 3px;
  --icon-size: 16px;
}
.tip p {
  font-size: 10px;
  color: #9caa9b;
  line-height: 1.7;
}
.tip strong {
  display: block;
  font-size: 11px;
  color: #d7e4c5;
  font-weight: 500;
  margin-bottom: 5px;
}
.help {
  display: flex;
  align-items: center;
  padding: 17px 0 0;
  gap: 8px;
  border: 0;
  background: none;
  color: #8c9c9e;
  font-size: 10px;
  --icon-size: 15px;
}
.help:hover {
  color: var(--accent);
}
.help span {
  margin-left: auto;
  border: 1px solid #3b474a;
  padding: 2px 5px;
  border-radius: 3px;
  font-family: monospace;
}
@media (min-width: 1500px) {
  .sidebar {
    padding: 28px;
  }
}
@media (max-width: 1200px) {
  .sidebar {
    padding: 22px 17px 16px;
  }
}
@media (max-width: 950px) {
  .sidebar {
    padding: 20px 15px 15px;
  }
  .project-name {
    font-size: 19px;
  }
  .tip {
    padding: 12px 9px;
  }
  .tip-icon {
    display: none;
  }
}
@media (max-width: 650px) {
  .sidebar {
    border: 0;
    border-top: 1px solid var(--line);
    padding: 24px;
    overflow: visible;
  }
  .heading,
  .project-name {
    max-width: 350px;
  }
  .tip {
    margin-top: 5px;
  }
}
</style>
