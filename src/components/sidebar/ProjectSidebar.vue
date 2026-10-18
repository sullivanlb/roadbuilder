<script setup lang="ts">
import { useEditor } from '../../composables/useEditor';
import { formatNumber, t } from '../../i18n';
import { computed, ref, watch } from 'vue';
import NumericInput from '../ui/NumericInput.vue';
import BarrierPanel from './BarrierPanel.vue';
import PointPanel from './PointPanel.vue';

const e = useEditor();
const saveMessage = computed(() => t(`save.${e.saveState}`));
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
  <aside class="sidebar" :aria-label="t('sidebar.aria')">
    <div class="sidebar-heading">
      <span class="eyebrow">{{ t('sidebar.eyebrow') }}</span
      ><span class="local-badge"><i></i> {{ t('sidebar.local') }}</span>
    </div>
    <label class="sr-only" for="project-name">{{ t('sidebar.name') }}</label>
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
      <h2><span class="section-index">01</span> {{ t('sidebar.track') }}</h2>
      <div class="segmented" :aria-label="t('sidebar.modeAria')">
        <button id="mode-closed" :aria-pressed="e.project.closed" @click="e.setClosed(true)">
          <svg class="icon"><use href="#i-flag" /></svg>{{ t('sidebar.closed') }}
        </button>
        <button id="mode-open" :aria-pressed="!e.project.closed" @click="e.setClosed(false)">
          <svg class="icon"><use href="#i-route" /></svg>{{ t('sidebar.open') }}
        </button>
      </div>
      <p id="mode-description" class="field-note">
        {{ e.project.closed ? t('sidebar.closedNote') : t('sidebar.openNote') }}
      </p>
      <button id="reverse-track" class="text-button" @click="e.reverseTrack">
        {{ t('sidebar.reverse') }} <span>⇄</span>
      </button>
    </section>

    <section class="panel-section">
      <h2><span class="section-index">02</span> {{ t('sidebar.road') }}</h2>
      <label class="range-label" for="track-width"
        >{{ t('sidebar.width') }}
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
        >{{ t('sidebar.shoulder') }}
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
        ><span
          >{{ t('sidebar.kerbs') }}<small>{{ t('sidebar.kerbsNote') }}</small></span
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
      <h2><span class="section-index">03</span> {{ t('sidebar.terrain') }}</h2>
      <label class="range-label" for="terrain-margin"
        >{{ t('sidebar.terrainMargin') }}
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
        {{ t('sidebar.terrainNote') }}
      </p>
    </section>

    <BarrierPanel />
    <PointPanel />

    <div class="sidebar-bottom">
      <div class="tip-icon">
        <svg class="icon"><use href="#i-cursor" /></svg>
      </div>
      <p>
        <strong>{{ t('sidebar.tipTitle') }}</strong
        >{{ t('sidebar.tipBody') }}
      </p>
    </div>
    <button id="open-help" class="help-button" @click="e.openDialog('help')">
      <svg class="icon"><use href="#i-help" /></svg>{{ t('sidebar.help') }}<span>?</span>
    </button>
  </aside>
</template>
