<script setup lang="ts">
import { useEditor, number } from '../composables/useEditor';
import { computed, ref, watch, onBeforeUnmount } from 'vue';

const e = useEditor();
const errors = computed(() =>
  e.issues.errors.map((message) => ({
    message,
    segment: e.issues.tightTurns.find((turn) => turn.message === message)?.segment,
  })),
);
const newDialog = ref<HTMLDialogElement | null>(null);
const exportDialog = ref<HTMLDialogElement | null>(null);
const helpDialog = ref<HTMLDialogElement | null>(null);
watch(
  () => e.dialog,
  (active) => {
    for (const [name, el] of [
      ['new', newDialog.value],
      ['export', exportDialog.value],
      ['help', helpDialog.value],
    ] as const) {
      if (!el) continue;
      if (name === active) {
        if (!el.open) el.showModal();
      } else if (el.open) el.close();
    }
  },
  { flush: 'post' },
);
onBeforeUnmount(() => {
  newDialog.value?.close();
  exportDialog.value?.close();
  helpDialog.value?.close();
});
</script>
<template>
  <dialog
    id="new-dialog"
    ref="newDialog"
    @cancel.prevent="e.openDialog(null)"
    aria-labelledby="new-title"
  >
    <div class="dialog-heading">
      <div>
        <span class="eyebrow">UNE NOUVELLE LIGNE DE DÉPART</span>
        <h2 id="new-title">Quel sera votre prochain tracé ?</h2>
      </div>
      <button class="tool" data-close="new-dialog" @click="e.openDialog(null)" aria-label="Fermer">
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

  <dialog
    id="export-dialog"
    ref="exportDialog"
    @cancel.prevent="e.openDialog(null)"
    aria-labelledby="export-title"
  >
    <div class="dialog-heading">
      <div>
        <span class="eyebrow">PROCHAINE ÉTAPE : LE VOLANT</span>
        <h2 id="export-title">Emportez votre tracé.</h2>
      </div>
      <button
        class="tool"
        data-close="export-dialog"
        @click="e.openDialog(null)"
        aria-label="Fermer"
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
        ><input type="radio" name="export-format" v-model="e.exportFormat" value="ac" /><span
          ><strong>Assetto Corsa <small>EXPÉRIMENTAL</small></strong
          ><span>Archive ZIP : modèle KN5, textures, surfaces, départ et stand.</span></span
        ></label
      ><label
        ><input type="radio" name="export-format" v-model="e.exportFormat" value="obj" /><span
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
      <p>
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
        >{{ number(e.stats.length / 1000, 2) }} km ·
        {{ e.project.closed ? 'Circuit fermé' : 'Route ouverte' }} · 1 voiture</span
      ><button
        id="download-export"
        :disabled="e.exporting || e.issues.errors.length > 0"
        @click="e.exportProject"
        class="button primary"
      >
        <svg class="icon"><use href="#i-export" /></svg
        >{{ e.exporting ? 'Création du circuit…' : 'Télécharger le ZIP' }}
      </button>
    </div>
  </dialog>

  <dialog
    id="help-dialog"
    ref="helpDialog"
    @cancel.prevent="e.openDialog(null)"
    aria-labelledby="help-title"
  >
    <div class="dialog-heading">
      <div>
        <span class="eyebrow">PRENEZ LA CORDE</span>
        <h2 id="help-title">Les premiers tours de main.</h2>
      </div>
      <button class="tool" data-close="help-dialog" @click="e.openDialog(null)" aria-label="Fermer">
        <svg class="icon"><use href="#i-close" /></svg>
      </button>
    </div>
    <ol class="guide-steps">
      <li>
        <strong>Dessinez votre ligne.</strong>Déplacez les points en vue 2D. L’outil + ajoute un
        point après celui sélectionné ; un double-clic sur la route l’insère à cet endroit.
      </li>
      <li>
        <strong>Donnez-lui du caractère.</strong>Réglez la largeur, les vibreurs et l’altitude de
        chaque point. L’aperçu 3D se fait pivoter par glisser-déposer.
      </li>
      <li>
        <strong>Conservez votre travail.</strong>La sauvegarde locale est automatique. « Enregistrer
        » télécharge un projet JSON réutilisable avec « Ouvrir ».
      </li>
      <li>
        <strong>Passez au simulateur.</strong>Exportez le ZIP Assetto Corsa, installez le dossier du
        circuit et lancez des essais libres en solo. L’export en jeu est encore expérimental.
      </li>
    </ol>
    <div class="shortcuts">
      <span>Sélectionner <kbd>V</kbd></span
      ><span>Ajouter un point <kbd>A</kbd></span
      ><span>Déplacer la vue <kbd>H</kbd></span
      ><span>Tout cadrer <kbd>F</kbd></span
      ><span>Annuler <kbd>Ctrl Z</kbd></span
      ><span>Rétablir <kbd>Ctrl Maj Z</kbd></span
      ><span>Enregistrer <kbd>Ctrl S</kbd></span
      ><span>Supprimer un point <kbd>Suppr</kbd></span>
    </div>
    <p class="dialog-note">
      Molette : zoom · Espace + glisser : déplacer la vue · Maj pendant un déplacement : grille de 5
      m. Le premier point détermine la zone de départ. Maximum 160 points.
    </p>
    <p class="dialog-note">
      Roadbuilder est un outil indépendant, non affilié à Kunos Simulazioni. Aucune donnée n’est
      envoyée à un serveur.
    </p>
  </dialog>
</template>
