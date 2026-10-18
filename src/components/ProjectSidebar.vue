<script setup lang="ts">
import { useEditor, formatNumber } from '../composables/useEditor';
import { computed, ref, watch } from 'vue';
import NumericInput from './NumericInput.vue';
import BarrierPanel from './BarrierPanel.vue';
import PointPanel from './PointPanel.vue';

const e = useEditor();
const saveMessage = computed(
  () =>
    ({
      saved: 'Sauvegardé sur cet appareil',
      pending: 'Enregistrement…',
      unavailable: 'Sauvegarde locale indisponible · utilisez Enregistrer',
      recovery: 'Ancienne sauvegarde préservée · utilisez Enregistrer',
    })[e.saveState],
);
const nameDraft = ref(e.project.name);
let editingName = false;
watch(
  () => e.project.name,
  (name) => {
    if (!editingName) nameDraft.value = name;
  },
);
function beginName() {
  editingName = true;
  e.beginEdit();
}
function inputName(event: Event) {
  beginName();
  nameDraft.value = (event.target as HTMLInputElement).value;
  e.setName(nameDraft.value);
}
function finishName() {
  editingName = false;
  nameDraft.value = e.project.name;
  e.flushEdit();
}
</script>
<template>
  <aside class="sidebar" aria-label="Paramètres du circuit">
    <div class="sidebar-heading">
      <span class="eyebrow">VOTRE PROJET</span><span class="local-badge"><i></i> LOCAL</span>
    </div>
    <label class="sr-only" for="project-name">Nom du tracé</label>
    <input
      id="project-name"
      class="project-name"
      maxlength="80"
      :value="nameDraft"
      spellcheck="false"
      @focus="beginName"
      @input="inputName"
      @blur="finishName"
    />
    <div
      id="save-status"
      :class="{ error: e.saveState === 'unavailable' || e.saveState === 'recovery' }"
      class="save-status"
      role="status"
    >
      <span v-if="e.saveState === 'saved'" class="status-dot"></span>{{ saveMessage }}
    </div>

    <section class="panel-section">
      <h2><span class="section-index">01</span> Le tracé</h2>
      <div class="segmented" aria-label="Type de tracé">
        <button id="mode-closed" :aria-pressed="e.project.closed" @click="e.setClosed(true)">
          <svg class="icon"><use href="#i-flag" /></svg>Circuit fermé
        </button>
        <button id="mode-open" :aria-pressed="!e.project.closed" @click="e.setClosed(false)">
          <svg class="icon"><use href="#i-route" /></svg>Route ouverte
        </button>
      </div>
      <p id="mode-description" class="field-note">
        {{
          e.project.closed
            ? 'Une boucle continue. À vous de trouver la trajectoire idéale.'
            : 'Un départ, une arrivée. Imaginez une route qui donne envie de rouler.'
        }}
      </p>
      <button id="reverse-track" class="text-button" @click="e.reverseTrack">
        Inverser le sens <span>⇄</span>
      </button>
    </section>

    <section class="panel-section">
      <h2><span class="section-index">02</span> La chaussée</h2>
      <label class="range-label" for="track-width"
        >Largeur de la route
        <output id="width-value"
          >{{ formatNumber(e.project.width, e.project.width % 1 ? 1 : 0) }} m</output
        ></label
      >
      <NumericInput
        id="track-width"
        type="range"
        :min="4"
        :max="24"
        :step="0.5"
        field="width"
        :value="e.project.width"
      />
      <div class="range-ticks"><span>4 m</span><span>24 m</span></div>
      <label class="range-label" for="track-shoulder"
        >Accotements
        <output id="shoulder-value"
          >{{ formatNumber(e.project.shoulder, e.project.shoulder % 1 ? 1 : 0) }} m</output
        ></label
      >
      <NumericInput
        id="track-shoulder"
        type="range"
        :min="2"
        :max="20"
        :step="0.5"
        field="shoulder"
        :value="e.project.shoulder"
      />
      <div class="range-ticks"><span>2 m</span><span>20 m</span></div>
      <label class="toggle-row" for="track-kerbs"
        ><span>Vibreurs rouge et blanc<small>Le long des deux bords</small></span
        ><input
          id="track-kerbs"
          type="checkbox"
          :checked="e.project.kerbs"
          @change="e.setKerbs(($event.target as HTMLInputElement).checked)" /><span
          class="switch"
          aria-hidden="true"
        ></span
      ></label>
    </section>

    <section class="panel-section terrain-section">
      <h2><span class="section-index">03</span> Le terrain</h2>
      <label class="range-label" for="terrain-margin"
        >Marge autour du tracé
        <output id="terrain-value"
          >{{
            formatNumber(e.project.terrainMargin, e.project.terrainMargin % 1 ? 1 : 0)
          }}
          m</output
        ></label
      >
      <NumericInput
        id="terrain-margin"
        type="range"
        :min="50"
        :max="500"
        :step="10"
        field="terrainMargin"
        :value="e.project.terrainMargin"
      />
      <div class="range-ticks"><span>50 m</span><span>500 m</span></div>
      <p class="field-note">
        Sol continu à l’intérieur et autour du tracé, raccordé au relief et inclus dans les exports.
        Le contour en pointillés indique sa limite.
      </p>
    </section>

    <BarrierPanel />
    <PointPanel />

    <div class="sidebar-bottom">
      <div class="tip-icon">
        <svg class="icon"><use href="#i-cursor" /></svg>
      </div>
      <p>
        <strong>Un virage commence par un point.</strong>Déplacez les points pour façonner le tracé.
        Double-cliquez sur la route pour en ajouter un.
      </p>
    </div>
    <button id="open-help" class="help-button" @click="e.openDialog('help')">
      <svg class="icon"><use href="#i-help" /></svg>Guide & raccourcis<span>?</span>
    </button>
  </aside>
</template>
