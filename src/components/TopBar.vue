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
      @click.prevent="e.openDialog('new')"
      href="#"
      aria-label="Roadbuilder, accueil de l’éditeur"
      ><span class="brand-mark"><i></i><i></i><i></i></span
      ><span
        >ROAD<span class="brand-light">BUILDER</span><small>ASSETTO CORSA TRACK STUDIO</small></span
      ><span class="version">0.1</span></a
    >
    <nav class="file-actions" aria-label="Projet">
      <button id="new-project" @click="e.openDialog('new')" class="button quiet">
        <svg class="icon"><use href="#i-plus" /></svg><span>Nouveau</span>
      </button>
      <button id="open-project" @click="fileInput?.click()" class="button quiet">
        <svg class="icon"><use href="#i-folder" /></svg><span>Ouvrir</span>
      </button>
      <button id="save-project" @click="e.downloadProject()" class="button secondary">
        <svg class="icon"><use href="#i-save" /></svg><span>Enregistrer</span>
      </button>
      <span class="nav-divider"></span>
      <button id="export-project" @click="e.openDialog('export')" class="button primary">
        <svg class="icon"><use href="#i-export" /></svg>Exporter<span class="desktop-only">
          le tracé</span
        >
      </button>
    </nav>
  </header>
  <input
    ref="fileInput"
    type="file"
    id="file-input"
    accept=".json,.roadbuilder.json,application/json"
    hidden
    @change="openFile"
  />
</template>
