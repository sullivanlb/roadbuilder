<script setup lang="ts">
import { useEditor, formatNumber } from '../composables/useEditor';
import { computed, ref, watch } from 'vue';
import NumericInput from './NumericInput.vue';
import { BARRIER_TYPE_LABELS } from '../domain/track/barriers';
import type { Barrier, BarrierType } from '../domain/types';

const e = useEditor();
const typeNotes: Record<BarrierType, string> = {
  guardrail: 'Rail métallique de 0,78 m : le compromis idéal le long des enchaînements.',
  tires: 'Trois rangées de pneus de 0,85 m : les chocs sont absorbés et les erreurs pardonnées.',
  tecpro: 'Blocs rouges et blancs de 0,85 m, parfaits pour protéger une sortie de virage.',
  wall: 'Mur de béton de 1,1 m : la limite la plus franche, à réserver aux zones à risque.',
};
const swatches: Record<BarrierType, string> = {
  guardrail: '#c8d3d7',
  tires: '#98a2a9',
  tecpro: '#d0664a',
  wall: '#e7e6da',
};
const barriers = computed(() => e.project.barriers ?? []);
const selectedBarrier = computed(() => barriers.value[e.selectedBarrier] ?? null);
const activeType = computed(() => selectedBarrier.value?.type ?? e.barrierType);
const typeNote = computed(
  () =>
    (selectedBarrier.value ? 'Le tronçon sélectionné : ' : 'Prochain tronçon : ') +
    typeNotes[activeType.value],
);
const barrierSummary = computed(() => {
  const counts = new Map<BarrierType, number>();
  for (const barrier of barriers.value)
    counts.set(barrier.type, (counts.get(barrier.type) ?? 0) + 1);
  return [...counts].map(([type, count]) => `${count} × ${BARRIER_TYPE_LABELS[type]}`).join(' · ');
});
const barrierStatus = computed(() => {
  const draft = e.barrierDraft;
  if (draft)
    return `Départ au point ${String(draft.from + 1).padStart(2, '0')} (côté ${
      draft.side === 'right' ? 'droit' : 'gauche'
    }) — cliquez le point d’arrivée.`;
  if (e.tool === 'barrier') return 'Cliquez le point de départ sur la piste. Échap annule.';
  if (selectedBarrier.value)
    return 'Tronçon sélectionné : réglez son écartement, changez de côté ou supprimez-le.';
  return barriers.value.length
    ? 'Cliquez un tronçon sur le plan pour le modifier.'
    : 'Glissière, pneus, TecPro ou mur : deux clics sur le plan et la piste se sécurise.';
});
const rowLabel = (barrier: Barrier, index: number) =>
  `${String(index + 1).padStart(2, '0')} · ${BARRIER_TYPE_LABELS[barrier.type]} · ${
    barrier.side === 'right' ? 'droite' : 'gauche'
  } · pts ${barrier.from + 1}→${barrier.to + 1}`;
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

    <section class="panel-section barrier-section">
      <h2>
        <span class="section-index">04</span> Les barrières
        <span v-if="barriers.length" id="barrier-count" class="point-badge"
          >{{ String(barriers.length).padStart(2, '0') }} TRONÇON{{
            barriers.length > 1 ? 'S' : ''
          }}</span
        >
      </h2>
      <div class="segmented" aria-label="Type de barrière">
        <button
          id="barrier-type-guardrail"
          :aria-pressed="activeType === 'guardrail'"
          @click="e.setBarrierType('guardrail')"
        >
          Glissière
        </button>
        <button
          id="barrier-type-tires"
          :aria-pressed="activeType === 'tires'"
          @click="e.setBarrierType('tires')"
        >
          Pneus
        </button>
        <button
          id="barrier-type-tecpro"
          :aria-pressed="activeType === 'tecpro'"
          @click="e.setBarrierType('tecpro')"
        >
          TecPro
        </button>
        <button
          id="barrier-type-wall"
          :aria-pressed="activeType === 'wall'"
          @click="e.setBarrierType('wall')"
        >
          Mur béton
        </button>
      </div>
      <p id="barrier-type-note" class="field-note">{{ typeNote }}</p>
      <button
        id="barrier-draw"
        class="button secondary small barrier-draw"
        :class="{ active: e.tool === 'barrier' }"
        @click="e.setTool('barrier')"
      >
        <svg class="icon"><use href="#i-wall" /></svg>Tracer sur le plan <kbd>B</kbd>
      </button>
      <p id="barrier-status" class="field-note">{{ barrierStatus }}</p>
      <div v-if="barriers.length" id="barrier-frame" class="barrier-frame">
        <button
          v-for="(barrier, index) in barriers"
          :id="`barrier-row-${index}`"
          :key="index"
          class="barrier-row"
          :class="{ active: index === e.selectedBarrier }"
          :title="rowLabel(barrier, index)"
          @click="e.selectBarrier(index)"
        >
          <span class="barrier-swatch" :style="{ background: swatches[barrier.type] }"></span
          >{{ rowLabel(barrier, index) }}
        </button>
      </div>
      <div v-if="selectedBarrier" id="barrier-editor" class="barrier-editor">
        <label class="range-label" for="barrier-offset"
          >Écartement du collider
          <output id="barrier-offset-value"
            >{{ formatNumber(selectedBarrier.offset, 1) }} m</output
          ></label
        >
        <NumericInput
          id="barrier-offset"
          type="range"
          :min="0"
          :max="10"
          :step="0.5"
          field="barrierOffset"
          :value="selectedBarrier.offset"
        />
        <div class="range-ticks"><span>0 m · bord</span><span>10 m</span></div>
        <div class="barrier-actions">
          <button id="barrier-swap" class="button quiet small" @click="e.swapBarrierSide()">
            <svg class="icon"><use href="#i-move" /></svg>Changer de côté
          </button>
          <button
            id="barrier-delete"
            class="button quiet small delete-point"
            @click="e.deleteBarrier()"
          >
            <svg class="icon"><use href="#i-trash" /></svg>Supprimer
          </button>
        </div>
      </div>
      <p v-else-if="barriers.length" id="barrier-summary" class="field-note">
        {{ barrierSummary }}
      </p>
      <p v-else id="barrier-empty" class="field-note">
        Aucune barrière pour l’instant. Le tracé se sécurise en deux clics : départ puis arrivée.
      </p>
    </section>

    <section class="panel-section point-section">
      <h2>
        <span class="section-index">05</span> Le relief
        <span v-if="e.point" id="point-badge" class="point-badge"
          >POINT {{ String(e.selected + 1).padStart(2, '0') }}</span
        >
      </h2>
      <div v-if="e.point" id="point-editor">
        <div
          v-if="e.selectedTightTurns.length"
          id="point-issues"
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
          id="point-height"
          type="range"
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
            class="button quiet small"
            aria-label="Point précédent"
            @click="e.selectPoint(Math.max(0, e.selected - 1))"
          >
            ←</button
          ><button
            id="point-next"
            :disabled="e.selected >= e.project.points.length - 1"
            class="button quiet small"
            aria-label="Point suivant"
            @click="e.selectPoint(Math.min(e.project.points.length - 1, e.selected + 1))"
          >
            →</button
          ><button
            id="delete-point"
            class="button quiet small delete-point"
            @click="e.deletePoint()"
          >
            <svg class="icon"><use href="#i-trash" /></svg>Supprimer
          </button>
        </div>
      </div>
      <p v-else id="point-empty" class="field-note">
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
    <button id="open-help" class="help-button" @click="e.openDialog('help')">
      <svg class="icon"><use href="#i-help" /></svg>Guide & raccourcis<span>?</span>
    </button>
  </aside>
</template>
