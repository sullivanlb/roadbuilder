<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { rename } from '../../core/project/edits';
import { RULES } from '../../core/project/rules';
import { t } from '../../i18n';
import { useFilesStore } from '../../stores/files';
import { useProjectStore } from '../../stores/project';

/** The editable project name, with the state of the automatic save under it. */
const store = useProjectStore();
const files = useFilesStore();

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
  <div class="project">
    <label class="sr-only" for="project-name">{{ t('sidebar.name') }}</label>
    <input
      id="project-name"
      class="name"
      :maxlength="RULES.name.max"
      :value="name"
      spellcheck="false"
      @input="onNameInput"
      @blur="onNameDone"
    />
    <div id="save-status" class="save-status" :class="{ error: saveFailed }" role="status">
      <i v-if="files.saveState === 'saved'" class="dot"></i>{{ t(`save.${files.saveState}`) }}
    </div>
  </div>
</template>

<style scoped>
.project {
  min-width: 0;
  flex: 1;
  max-width: 420px;
}
.name {
  background: transparent;
  border: 1px solid transparent;
  width: 100%;
  padding: 3px 5px;
  border-radius: 4px;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: -0.3px;
  color: var(--text);
}
.name:hover {
  border-color: var(--line);
}
.save-status {
  padding-left: 6px;
  font-size: 10px;
  color: var(--muted);
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 14px;
}
.save-status.error {
  color: var(--red);
}
.dot {
  width: 5px;
  height: 5px;
  background: #afc97e;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}
@media (max-width: 650px) {
  .project {
    order: 3;
    flex-basis: 100%;
    max-width: none;
  }
}
</style>
