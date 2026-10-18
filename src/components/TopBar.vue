<script setup lang="ts">
import { useEditor } from '../composables/useEditor';
import { ref } from 'vue';
import { locale, setLocale, t } from '../i18n';

const e = useEditor();
const fileInput = ref<HTMLInputElement | null>(null);
function openFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (file) void e.importProject(file);
}
</script>
<template>
  <header class="topbar">
    <a
      class="brand"
      href="#"
      :aria-label="t('topbar.brandAria')"
      @click.prevent="e.openDialog('new')"
      ><span class="brand-mark"><i></i><i></i><i></i></span
      ><span
        >ROAD<span class="brand-light">BUILDER</span><small>ASSETTO CORSA TRACK STUDIO</small></span
      ><span class="version">0.1</span></a
    >
    <nav class="file-actions" :aria-label="t('topbar.projectAria')">
      <button id="new-project" class="button quiet" @click="e.openDialog('new')">
        <svg class="icon"><use href="#i-plus" /></svg><span>{{ t('topbar.new') }}</span>
      </button>
      <button id="open-project" class="button quiet" @click="fileInput?.click()">
        <svg class="icon"><use href="#i-folder" /></svg><span>{{ t('topbar.open') }}</span>
      </button>
      <button id="save-project" class="button secondary" @click="e.downloadProject()">
        <svg class="icon"><use href="#i-save" /></svg><span>{{ t('topbar.save') }}</span>
      </button>
      <span class="nav-divider"></span>
      <button id="export-project" class="button primary" @click="e.openDialog('export')">
        <svg class="icon"><use href="#i-export" /></svg>{{ t('topbar.export')
        }}<span class="desktop-only"> {{ t('topbar.exportTrack') }}</span>
      </button>
      <span class="nav-divider"></span>
      <div class="locale-switch" role="group" :aria-label="t('topbar.language')">
        <button
          id="locale-fr"
          class="button quiet"
          :aria-pressed="locale === 'fr'"
          @click="setLocale('fr')"
        >
          FR
        </button>
        <button
          id="locale-en"
          class="button quiet"
          :aria-pressed="locale === 'en'"
          @click="setLocale('en')"
        >
          EN
        </button>
      </div>
    </nav>
  </header>
  <input
    id="file-input"
    ref="fileInput"
    type="file"
    accept=".json,.roadbuilder.json,application/json"
    hidden
    @change="openFile"
  />
</template>
