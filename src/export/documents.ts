import type { Project, Sample } from '../domain/types';
import type { TrackIssue } from '../domain/diagnostics';
import { formatTrackIssue } from '../i18n/fr';

/** Assetto Corsa surfaces.ini: the four physical surfaces used by the meshes. */
export function surfacesIni(): string {
  return [
    ['ROAD', 1, 1, 0],
    ['GRASS', 0.65, 0, 0],
    ['KERB', 0.95, 1, 0],
    ['PIT', 1, 1, 1],
  ]
    .map(
      ([key, friction, valid, pit], i) =>
        `[SURFACE_${i}]\nKEY=${key}\nFRICTION=${friction}\nDAMPING=0\nWAV=\nWAV_PITCH=0\nFF_EFFECT=NULL\nDIRT_ADDITIVE=${key === 'GRASS' ? 1 : 0}\nIS_VALID_TRACK=${valid}\nBLACK_FLAG_TIME=0\nSIN_HEIGHT=0\nSIN_LENGTH=0\nIS_PITLANE=${pit}\nVIBRATION_GAIN=${key === 'KERB' ? 0.1 : 0}\nVIBRATION_LENGTH=${key === 'KERB' ? 0.2 : 0}\n`,
    )
    .join('\n');
}

/** ui_track.json shown by Content Manager for the exported track. */
export function uiTrackJson(
  project: Project,
  samples: Sample[],
  stats: { length: number },
): string {
  return JSON.stringify(
    {
      name: project.name,
      description: `Créé avec Roadbuilder. ${project.closed ? 'Circuit fermé' : 'Route ouverte'}. Prototype pour essais libres en solo.`,
      tags: [project.closed ? 'circuit' : 'hillclimb', 'fictional', 'roadbuilder'],
      country: 'France',
      city: '',
      length: `${Math.round(stats.length)} m`,
      width: `${project.width} m`,
      pitboxes: '1',
      run: project.closed
        ? samples.reduce(
            (sum, p, i) => (i ? sum + samples[i - 1].x * p.z - p.x * samples[i - 1].z : sum),
            0,
          ) > 0
          ? 'clockwise'
          : 'counter-clockwise'
        : 'point-to-point',
      author: project.author || 'Roadbuilder',
      version: '0.1',
      url: '',
      year: 2026,
    },
    null,
    2,
  );
}

/** LIRE-MOI.txt shipped in the OBJ archive. */
export function objReadme(barrierCount: number): string {
  return (
    'Roadbuilder — sources 3D\n\nImportez track.obj dans Blender (axe vertical Y, avant -Z, échelle 1 m).\nLes textures se trouvent dans texture/. Les transformations des repères Assetto Corsa sont dans markers.json (matrices 4×4, translation sur la dernière ligne).\nOBJ ne conserve pas les repères AC : recréez-les si vous passez par Blender/ksEditor.\nPour un export KN5 direct, utilisez Exporter > Assetto Corsa dans Roadbuilder.\n' +
    (barrierCount
      ? 'Les maillages 1WALL_* sont les colliders du jeu (invisibles sur la piste) ; les décors des barrières n’ont pas de préfixe.\n'
      : '')
  );
}

interface InstallationTextOptions {
  project: Project;
  slug: string;
  barrierCount: number;
  warnings: TrackIssue[];
}

/**
 * INSTALLATION.txt shipped in the Assetto Corsa archive. Its text depends on the
 * barrier count so that projects without barriers keep their previous archive bytes.
 */
export function installationText({
  project,
  slug,
  barrierCount,
  warnings,
}: InstallationTextOptions): string {
  return `ROADBUILDER — ${project.name}\n\nEXPORT KN5 EXPÉRIMENTAL, À VÉRIFIER EN JEU\n\n1. Décompressez cette archive dans un dossier temporaire.\n2. Copiez content/tracks/${slug} dans assettocorsa/content/tracks/.\n   Si ce nom existe déjà, conservez une copie de votre ancienne version avant de la remplacer.\n3. Dans Content Manager ou Assetto Corsa, sélectionnez ${project.name}.\n4. Lancez des ESSAIS LIBRES, avec une seule voiture et sans adversaires.\n\nINCLUS\n${
    barrierCount
      ? `Barrières : ${barrierCount} tronçon${barrierCount > 1 ? 's' : ''} avec collision (glissières, pneus, TecPro ou murs).\n`
      : ''
  }Chaussée avec collisions, accotements, vibreurs optionnels, textures intégrées au KN5,\nrepères de départ/stand et chronométrage, surfaces, plan et aperçu.\nTerrain en herbe avec collisions, à l’intérieur et autour du tracé, raccordé à son relief.\nMarge extérieure du terrain : ${project.terrainMargin} m au-delà des limites des accotements.\nLe point 1 définit le début du tracé ; la ligne de départ est placée après le stand.\n\nLIMITES DE CETTE VERSION\nLa compatibilité en jeu n’a pas été vérifiée automatiquement.\nUn emplacement de stand seulement, sans véritable voie des stands.\nPas de trajectoires IA : les courses contre l’IA ne sont pas prises en charge.\nRoutes ouvertes : essais libres uniquement ; chronométrage point-à-point non validé.\nLe terrain s’arrête au rectangle en pointillés visible dans l’éditeur.\nAu-delà de ce bord extérieur, une chute reste possible. Augmentez la marge si nécessaire.\n${
    barrierCount
      ? 'Les barrières sont des colliders simples : vérifiez les impacts en jeu.\nLe relief du terrain est interpolé automatiquement.\n'
      : 'Pas de barrières, de ponts ou de décor ; le relief du terrain est interpolé automatiquement.\n'
  }Les chevauchements de bords de route/accotements ne sont pas tous détectés.\nPour un circuit destiné à la compétition, vérifiez et complétez le modèle dans un outil 3D.\n\nLe fichier projet.roadbuilder.json permet de reprendre le travail dans l’éditeur.\n${warnings.length ? '\nAVERTISSEMENTS\n' + warnings.map(formatTrackIssue).join('\n') : ''}\n`;
}
