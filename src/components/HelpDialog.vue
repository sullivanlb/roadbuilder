<script setup lang="ts">
import { useEditor } from '../composables/useEditor';
import { useModalDialog } from '../composables/useModalDialog';

const props = defineProps<{ open: boolean }>();
const e = useEditor();
const dialog = useModalDialog(() => props.open);
</script>
<template>
  <dialog
    id="help-dialog"
    ref="dialog"
    aria-labelledby="help-title"
    @cancel.prevent="e.openDialog(null)"
  >
    <div class="dialog-heading">
      <div>
        <span class="eyebrow">PRENEZ LA CORDE</span>
        <h2 id="help-title">Les premiers tours de main.</h2>
      </div>
      <button class="tool" data-close="help-dialog" aria-label="Fermer" @click="e.openDialog(null)">
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
        <strong>Sécurisez les bords.</strong>Dans <em>Les barrières</em>, choisissez glissière,
        pneus, TecPro ou mur béton, puis tracez en deux clics sur le plan : départ, puis arrivée.
        Échap annule le tracé en cours.
      </li>
      <li>
        <strong>Passez au simulateur.</strong>Exportez le ZIP Assetto Corsa, installez le dossier du
        circuit et lancez des essais libres en solo. L’export en jeu est encore expérimental.
      </li>
    </ol>
    <div class="shortcuts">
      <span>Sélectionner <kbd>V</kbd></span
      ><span>Ajouter un point <kbd>A</kbd></span
      ><span>Tracer une barrière <kbd>B</kbd></span
      ><span>Déplacer la vue <kbd>H</kbd></span
      ><span>Tout cadrer <kbd>F</kbd></span
      ><span>Annuler <kbd>Ctrl Z</kbd></span
      ><span>Rétablir <kbd>Ctrl Maj Z</kbd></span
      ><span>Enregistrer <kbd>Ctrl S</kbd></span
      ><span>Supprimer un point <kbd>Suppr</kbd></span>
    </div>
    <p class="dialog-note">
      Molette : zoom · Espace + glisser : déplacer la vue · Maj pendant un déplacement : grille de 5
      m. Le premier point détermine la zone de départ. Une barrière se trace du point de départ au
      point d’arrivée, sur la rive cliquée. Maximum 160 points et 120 tronçons de barrière.
    </p>
    <p class="dialog-note">
      Roadbuilder est un outil indépendant, non affilié à Kunos Simulazioni. Aucune donnée n’est
      envoyée à un serveur.
    </p>
  </dialog>
</template>
