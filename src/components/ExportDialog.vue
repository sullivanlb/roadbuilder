<script setup lang="ts">
import { computed } from 'vue';
import { useEditor, formatNumber } from '../composables/useEditor';
import { useModalDialog } from '../composables/useModalDialog';

const props = defineProps<{ open: boolean }>();
const e = useEditor();
const dialog = useModalDialog(() => props.open);
const errors = computed(() =>
  e.issues.errors.map((message) => ({
    message,
    segment: e.issues.tightTurns.find((turn) => turn.message === message)?.segment,
  })),
);
</script>
<template>
  <dialog
    id="export-dialog"
    ref="dialog"
    aria-labelledby="export-title"
    @cancel.prevent="e.openDialog(null)"
  >
    <div class="dialog-heading">
      <div>
        <span class="eyebrow">PROCHAINE ÉTAPE : LE VOLANT</span>
        <h2 id="export-title">Emportez votre tracé.</h2>
      </div>
      <button
        class="tool"
        data-close="export-dialog"
        aria-label="Fermer"
        @click="e.openDialog(null)"
      >
        <svg class="icon"><use href="#i-close" /></svg>
      </button>
    </div>
    <label class="field-label" for="export-author">Créateur <span>facultatif</span></label
    ><input
      id="export-author"
      v-model="e.exportAuthor"
      class="text-input"
      maxlength="80"
      placeholder="Votre nom ou pseudo"
    />
    <fieldset class="export-formats">
      <legend>Format de l’export</legend>
      <label
        ><input v-model="e.exportFormat" type="radio" name="export-format" value="ac" /><span
          ><strong>Assetto Corsa <small>EXPÉRIMENTAL</small></strong
          ><span>Archive ZIP : modèle KN5, textures, surfaces, départ et stand.</span></span
        ></label
      ><label
        ><input v-model="e.exportFormat" type="radio" name="export-format" value="obj" /><span
          ><strong>Modèle 3D · OBJ</strong
          ><span>Géométrie et textures pour poursuivre le travail dans Blender.</span></span
        ></label
      >
    </fieldset>
    <div id="export-issues" class="export-issues">
      <p v-for="error in errors" :key="error.message" class="error">
        {{ error.message }}
        <button
          v-if="error.segment !== undefined"
          class="button secondary small locate-turn"
          :data-tight-turn="error.segment"
          @click="e.focusTightTurn(error.segment)"
        >
          Voir le virage
        </button>
      </p>
      <p v-for="message in e.issues.warnings" :key="message" class="warning">{{ message }}</p>
    </div>
    <div class="export-notice">
      <svg class="icon"><use href="#i-help" /></svg>
      <p v-if="e.project.barriers?.length">
        <strong>Pour essais libres en solo.</strong>Terrain complet inclus, avec une limite
        extérieure visible dans l’éditeur. Un stand, sans trajectoire IA ; les barrières tracées
        sont incluses avec collision. Le KN5 et le chronométrage doivent être vérifiés dans Assetto
        Corsa ; les routes ouvertes sont prévues pour le roulage libre.
      </p>
      <p v-else>
        <strong>Pour essais libres en solo.</strong>Terrain complet inclus, avec une limite
        extérieure visible dans l’éditeur. Un stand, sans trajectoire IA ni barrières. Le KN5 et le
        chronométrage doivent être vérifiés dans Assetto Corsa ; les routes ouvertes sont prévues
        pour le roulage libre.
      </p>
    </div>
    <div class="export-install">
      <span>01</span>
      <p>
        Décompressez le ZIP, puis copiez son dossier de circuit dans
        <code>assettocorsa/content/tracks/</code>. Le guide est inclus.
      </p>
    </div>
    <div class="dialog-footer">
      <span id="export-summary"
        >{{ formatNumber(e.stats.length / 1000, 2) }} km ·
        {{ e.project.closed ? 'Circuit fermé' : 'Route ouverte' }} · 1 voiture</span
      ><button
        id="download-export"
        :disabled="e.exporting || e.issues.errors.length > 0"
        class="button primary"
        @click="e.exportProject"
      >
        <svg class="icon"><use href="#i-export" /></svg
        >{{ e.exporting ? 'Création du circuit…' : 'Télécharger le ZIP' }}
      </button>
    </div>
  </dialog>
</template>
