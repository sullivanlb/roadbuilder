<script setup lang="ts">
import { useEditor, number } from '../composables/useEditor';
import { computed, ref, watch } from 'vue';
import NumericInput from './NumericInput.vue';

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
      @focus="beginName"
      @input="inputName"
      @blur="finishName"
      spellcheck="false"
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
        <button id="mode-closed" @click="e.setClosed(true)" :aria-pressed="e.project.closed">
          <svg class="icon"><use href="#i-flag" /></svg>Circuit fermé
        </button>
        <button id="mode-open" @click="e.setClosed(false)" :aria-pressed="!e.project.closed">
          <svg class="icon"><use href="#i-route" /></svg>Route ouverte
        </button>
      </div>
      <p class="field-note" id="mode-description">
        {{
          e.project.closed
            ? 'Une boucle continue. À vous de trouver la trajectoire idéale.'
            : 'Un départ, une arrivée. Imaginez une route qui donne envie de rouler.'
        }}
      </p>
      <button id="reverse-track" @click="e.reverseTrack" class="text-button">
        Inverser le sens <span>⇄</span>
      </button>
    </section>

    <section class="panel-section">
      <h2><span class="section-index">02</span> La chaussée</h2>
      <label class="range-label" for="track-width"
        >Largeur de la route
        <output id="width-value"
          >{{ number(e.project.width, e.project.width % 1 ? 1 : 0) }} m</output
        ></label
      >
      <NumericInput
        type="range"
        id="track-width"
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
          >{{ number(e.project.shoulder, e.project.shoulder % 1 ? 1 : 0) }} m</output
        ></label
      >
      <NumericInput
        type="range"
        id="track-shoulder"
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
          >{{ number(e.project.terrainMargin, e.project.terrainMargin % 1 ? 1 : 0) }} m</output
        ></label
      >
      <NumericInput
        type="range"
        id="terrain-margin"
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

    <section class="panel-section point-section">
      <h2>
        <span class="section-index">04</span> Le relief
        <span id="point-badge" v-if="e.point" class="point-badge"
          >POINT {{ String(e.selected + 1).padStart(2, '0') }}</span
        >
      </h2>
      <div id="point-editor" v-if="e.point">
        <div
          id="point-issues"
          v-if="e.selectedTightTurns.length"
          class="point-issues"
          role="status"
        >
          <p v-for="turn in e.selectedTightTurns" :key="turn.segment">{{ turn.message }}</p>
        </div>
        <div class="range-label">
          <label for="point-altitude">Altitude du point</label
          ><span class="unit-input"
            ><NumericInput
              id="point-altitude"
              type="number"
              :min="-100"
              :max="1000"
              :step="0.5"
              field="y"
              :value="Number(e.point.y.toFixed(2))"
            /><span>m</span></span
          >
        </div>
        <NumericInput
          type="range"
          id="point-height"
          :min="-100"
          :max="1000"
          :step="0.5"
          aria-label="Altitude du point sélectionné"
          field="y"
          :value="e.point.y"
        />
        <div class="coordinates">
          <label
            >X
            <NumericInput
              id="point-x"
              type="number"
              :min="-10000"
              :max="10000"
              :step="1"
              field="x"
              :value="Number(e.point.x.toFixed(1))" /></label
          ><label
            >Z
            <NumericInput
              id="point-z"
              type="number"
              :min="-10000"
              :max="10000"
              :step="1"
              field="z"
              :value="Number(e.point.z.toFixed(1))"
          /></label>
        </div>
        <div class="point-actions">
          <button
            id="point-previous"
            :disabled="e.selected <= 0"
            @click="e.selectPoint(Math.max(0, e.selected - 1))"
            class="button quiet small"
            aria-label="Point précédent"
          >
            ←</button
          ><button
            id="point-next"
            :disabled="e.selected >= e.project.points.length - 1"
            @click="e.selectPoint(Math.min(e.project.points.length - 1, e.selected + 1))"
            class="button quiet small"
            aria-label="Point suivant"
          >
            →</button
          ><button
            id="delete-point"
            @click="e.deletePoint()"
            class="button quiet small delete-point"
          >
            <svg class="icon"><use href="#i-trash" /></svg>Supprimer
          </button>
        </div>
      </div>
      <p id="point-empty" class="field-note" v-else>
        Sélectionnez un point du tracé pour modifier sa position et son altitude.
      </p>
    </section>

    <div class="sidebar-bottom">
      <div class="tip-icon">
        <svg class="icon"><use href="#i-cursor" /></svg>
      </div>
      <p>
        <strong>Un virage commence par un point.</strong>Déplacez les points pour façonner le tracé.
        Double-cliquez sur la route pour en ajouter un.
      </p>
    </div>
    <button id="open-help" @click="e.openDialog('help')" class="help-button">
      <svg class="icon"><use href="#i-help" /></svg>Guide & raccourcis<span>?</span>
    </button>
  </aside>
</template>
