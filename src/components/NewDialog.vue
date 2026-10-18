<script setup lang="ts">
import { useEditor } from '../composables/useEditor';
import { useModalDialog } from '../composables/useModalDialog';

const props = defineProps<{ open: boolean }>();
const e = useEditor();
const dialog = useModalDialog(() => props.open);
</script>
<template>
  <dialog
    id="new-dialog"
    ref="dialog"
    aria-labelledby="new-title"
    @cancel.prevent="e.openDialog(null)"
  >
    <div class="dialog-heading">
      <div>
        <span class="eyebrow">UNE NOUVELLE LIGNE DE DÉPART</span>
        <h2 id="new-title">Quel sera votre prochain tracé ?</h2>
      </div>
      <button class="tool" data-close="new-dialog" aria-label="Fermer" @click="e.openDialog(null)">
        <svg class="icon"><use href="#i-close" /></svg>
      </button>
    </div>
    <p class="dialog-intro">Choisissez une base, puis faites-en votre propre terrain de jeu.</p>
    <div class="templates">
      <button class="template" data-template="club" @click="e.newProject('club')">
        <svg viewBox="0 0 200 100">
          <path d="M30 74h102q43 0 39-35t-40-12l-24 13-20-17q-60-16-66 19t9 32z" /></svg
        ><strong>Circuit club</strong><span>Grandes courbes, relief léger</span
        ><small>CIRCUIT FERMÉ <b>↗</b></small>
      </button>
      <button class="template" data-template="kart" @click="e.newProject('kart')">
        <svg viewBox="0 0 200 100">
          <path d="M30 75h115q35-3 22-33t-37-16q-9 1-10 25t-23 3q-7-38-40-28T30 75z" /></svg
        ><strong>Karting</strong><span>Compact, technique et plat</span
        ><small>CIRCUIT FERMÉ <b>↗</b></small>
      </button>
      <button class="template" data-template="mountain" @click="e.newProject('mountain')">
        <svg viewBox="0 0 200 100">
          <path d="M20 83h110q54-2 28-24L63 55q-45-13-5-26l80-2q36-17-43-17H32" /></svg
        ><strong>Route de montagne</strong><span>Lacets et dénivelé progressif</span
        ><small>ROUTE OUVERTE <b>↗</b></small>
      </button>
      <button class="template" data-template="blank" @click="e.newProject('blank')">
        <svg viewBox="0 0 200 100"><path d="M100 30v40M80 50h40" class="blank-template" /></svg
        ><strong>Page blanche</strong><span>Tout commence avec vous</span
        ><small>À DESSINER <b>↗</b></small>
      </button>
    </div>
    <p class="dialog-note">
      Votre tracé actuel restera accessible avec « Annuler ». Enregistrez-le pour le conserver dans
      un fichier.
    </p>
  </dialog>
</template>
