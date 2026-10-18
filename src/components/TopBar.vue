<script setup lang="ts">
import { useEditor } from '../composables/useEditor';
import { ref } from 'vue';

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
      aria-label="Roadbuilder, accueil de l’éditeur"
      @click.prevent="e.openDialog('new')"
      ><span class="brand-mark"><i></i><i></i><i></i></span
      ><span
        >ROAD<span class="brand-light">BUILDER</span><small>ASSETTO CORSA TRACK STUDIO</small></span
      ><span class="version">0.1</span></a
    >
    <nav class="file-actions" aria-label="Projet">
      <button id="new-project" class="button quiet" @click="e.openDialog('new')">
        <svg class="icon"><use href="#i-plus" /></svg><span>Nouveau</span>
      </button>
      <button id="open-project" class="button quiet" @click="fileInput?.click()">
        <svg class="icon"><use href="#i-folder" /></svg><span>Ouvrir</span>
      </button>
      <button id="save-project" class="button secondary" @click="e.downloadProject()">
        <svg class="icon"><use href="#i-save" /></svg><span>Enregistrer</span>
      </button>
      <span class="nav-divider"></span>
      <button id="export-project" class="button primary" @click="e.openDialog('export')">
        <svg class="icon"><use href="#i-export" /></svg>Exporter<span class="desktop-only">
          le tracé</span
        >
      </button>
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
