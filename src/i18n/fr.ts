import type {
  ExportError,
  ProjectErrorDetail,
  ProjectField,
  TrackIssue,
} from '../domain/diagnostics';
import type { DocumentTexts } from './documents';

/** Every interface string, with {placeholder} tokens interpolated by t(). */
export const frMessages = {
  'topbar.brandAria': 'Roadbuilder, accueil de l’éditeur',
  'topbar.projectAria': 'Projet',
  'topbar.language': 'Langue',
  'topbar.new': 'Nouveau',
  'topbar.open': 'Ouvrir',
  'topbar.save': 'Enregistrer',
  'topbar.export': 'Exporter',
  'topbar.exportTrack': 'le tracé',

  'editor.aria': 'Éditeur du tracé',
  'editor.eyebrow': 'ATELIER DE CRÉATION',
  'editor.title': 'De l’idée à la piste',
  'editor.viewAria': 'Vue de l’éditeur',
  'editor.view2d': 'Plan 2D',
  'editor.view3d': 'Aperçu 3D',
  'editor.canvasAria':
    'Éditeur de circuit : sélectionnez et déplacez les points à la souris. Le panneau de gauche permet aussi de modifier leurs coordonnées.',
  'editor.toolsAria': 'Outils de dessin',
  'editor.selectTitle': 'Sélectionner et déplacer un point (V)',
  'editor.selectAria': 'Sélectionner (V)',
  'editor.addTitle': 'Ajouter des points (A)',
  'editor.barrierTitle': 'Tracer une barrière (B)',
  'editor.panTitle': 'Déplacer la vue (H)',
  'editor.undoTitle': 'Annuler (Ctrl+Z)',
  'editor.redoTitle': 'Rétablir (Ctrl+Maj+Z)',
  'editor.zoomAria': 'Zoom',
  'editor.zoomOut': 'Dézoomer',
  'editor.zoomIn': 'Zoomer',
  'editor.fitTitle': 'Cadrer le tracé (F)',
  'editor.fitAria': 'Cadrer le tracé',
  'editor.scene2d': 'VUE DE DESSUS',
  'editor.scene3d': 'APERÇU DU RELIEF',
  'editor.pointCount': '{count} POINTS',
  'editor.emptyTitle': 'Votre terrain de jeu.',
  'editor.emptyLine1': 'Cliquez pour poser votre premier point.',
  'editor.emptyLine2': 'Le suivant dessinera le début de votre route.',
  'editor.statusReady': 'Géométrie prête · export en jeu expérimental',
  'editor.locateTurn': 'Voir le virage',
  'editor.unitHint': '1 unité = 1 mètre',
  'editor.privacy': 'Tout reste sur votre appareil',

  'canvas.hint3d': 'Glissez pour tourner · Molette pour zoomer · Retour au plan 2D pour modifier',
  'canvas.hintBarrierDraft': 'Cliquez le point d’arrivée du tronçon · Échap annule le tracé',
  'canvas.hintBarrier': 'Cliquez le point de départ du tronçon · Échap quitte l’outil',
  'canvas.hintAdd': 'Cliquez pour ajouter après le point sélectionné · Échap pour terminer',
  'canvas.hintPan': 'Glissez pour déplacer le plan · Molette pour zoomer',
  'canvas.hintSelect': 'Glissez un point · Molette pour zoomer · Espace + glisser pour naviguer',
  'canvas.start': 'DÉPART',
  'canvas.finish': 'ARRIVÉE',

  'telemetry.length': 'LONGUEUR TOTALE',
  'telemetry.climb': 'DÉNIVELÉ POSITIF',
  'telemetry.grade': 'PENTE MAX.',
  'telemetry.session': 'SESSION CIBLE',
  'telemetry.freePractice': 'Essais libres',

  'profile.title': 'PROFIL D’ALTITUDE',
  'profile.aria': 'Profil d’altitude du tracé',
  'profile.start': 'DÉPART',
  'profile.closedEnd': 'RETOUR AU DÉPART',
  'profile.openEnd': 'ARRIVÉE',

  'sidebar.aria': 'Paramètres du circuit',
  'sidebar.eyebrow': 'VOTRE PROJET',
  'sidebar.local': 'LOCAL',
  'sidebar.name': 'Nom du tracé',
  'save.saved': 'Sauvegardé sur cet appareil',
  'save.pending': 'Enregistrement…',
  'save.unavailable': 'Sauvegarde locale indisponible · utilisez Enregistrer',
  'save.recovery': 'Ancienne sauvegarde préservée · utilisez Enregistrer',
  'sidebar.track': 'Le tracé',
  'sidebar.modeAria': 'Type de tracé',
  'sidebar.closed': 'Circuit fermé',
  'sidebar.open': 'Route ouverte',
  'sidebar.closedNote': 'Une boucle continue. À vous de trouver la trajectoire idéale.',
  'sidebar.openNote': 'Un départ, une arrivée. Imaginez une route qui donne envie de rouler.',
  'sidebar.reverse': 'Inverser le sens',
  'sidebar.road': 'La chaussée',
  'sidebar.width': 'Largeur de la route',
  'sidebar.shoulder': 'Accotements',
  'sidebar.kerbs': 'Vibreurs rouge et blanc',
  'sidebar.kerbsNote': 'Le long des deux bords',
  'sidebar.terrain': 'Le terrain',
  'sidebar.terrainMargin': 'Marge autour du tracé',
  'sidebar.terrainNote':
    'Sol continu à l’intérieur et autour du tracé, raccordé au relief et inclus dans les exports. Le contour en pointillés indique sa limite.',
  'sidebar.tipTitle': 'Un virage commence par un point.',
  'sidebar.tipBody':
    'Déplacez les points pour façonner le tracé. Double-cliquez sur la route pour en ajouter un.',
  'sidebar.help': 'Guide & raccourcis',

  'barriers.title': 'Les barrières',
  'barriers.countOne': '{count} TRONÇON',
  'barriers.countMany': '{count} TRONÇONS',
  'barriers.typeAria': 'Type de barrière',
  'barriers.guardrail': 'Glissière',
  'barriers.tires': 'Pneus',
  'barriers.tecpro': 'TecPro',
  'barriers.wall': 'Mur béton',
  'barriers.guardrailNote':
    'Rail métallique de 0,78 m : le compromis idéal le long des enchaînements.',
  'barriers.tiresNote':
    'Trois rangées de pneus de 0,85 m : les chocs sont absorbés et les erreurs pardonnées.',
  'barriers.tecproNote':
    'Blocs rouges et blancs de 0,85 m, parfaits pour protéger une sortie de virage.',
  'barriers.wallNote':
    'Mur de béton de 1,1 m : la limite la plus franche, à réserver aux zones à risque.',
  'barriers.selectedNote': 'Le tronçon sélectionné : ',
  'barriers.nextNote': 'Prochain tronçon : ',
  'barriers.draw': 'Tracer sur le plan',
  'barriers.statusDraft': 'Départ au point {point} (côté {side}) — cliquez le point d’arrivée.',
  'barriers.statusTool': 'Cliquez le point de départ sur la piste. Échap annule.',
  'barriers.statusSelected':
    'Tronçon sélectionné : réglez son écartement, changez de côté ou supprimez-le.',
  'barriers.statusChoose': 'Cliquez un tronçon sur le plan pour le modifier.',
  'barriers.statusEmpty':
    'Glissière, pneus, TecPro ou mur : deux clics sur le plan et la piste se sécurise.',
  'barriers.sideRightShort': 'droit',
  'barriers.sideLeftShort': 'gauche',
  'barriers.sideRight': 'droite',
  'barriers.sideLeft': 'gauche',
  'barriers.row': '{index} · {type} · {side} · pts {from}→{to}',
  'barriers.offset': 'Écartement du collider',
  'barriers.offsetMin': '0 m · bord',
  'barriers.swap': 'Changer de côté',
  'barriers.delete': 'Supprimer',
  'barriers.empty':
    'Aucune barrière pour l’instant. Le tracé se sécurise en deux clics : départ puis arrivée.',

  'point.title': 'Le relief',
  'point.badge': 'POINT {index}',
  'point.altitude': 'Altitude du point',
  'point.altitudeAria': 'Altitude du point sélectionné',
  'point.previous': 'Point précédent',
  'point.next': 'Point suivant',
  'point.delete': 'Supprimer',
  'point.empty': 'Sélectionnez un point du tracé pour modifier sa position et son altitude.',

  'dialog.close': 'Fermer',
  'new.eyebrow': 'UNE NOUVELLE LIGNE DE DÉPART',
  'new.title': 'Quel sera votre prochain tracé ?',
  'new.intro': 'Choisissez une base, puis faites-en votre propre terrain de jeu.',
  'new.club': 'Circuit club',
  'new.clubNote': 'Grandes courbes, relief léger',
  'new.kart': 'Karting',
  'new.kartNote': 'Compact, technique et plat',
  'new.mountain': 'Route de montagne',
  'new.mountainNote': 'Lacets et dénivelé progressif',
  'new.blank': 'Page blanche',
  'new.blankNote': 'Tout commence avec vous',
  'new.closedTag': 'CIRCUIT FERMÉ',
  'new.openTag': 'ROUTE OUVERTE',
  'new.blankTag': 'À DESSINER',
  'new.note':
    'Votre tracé actuel restera accessible avec « Annuler ». Enregistrez-le pour le conserver dans un fichier.',

  'export.eyebrow': 'PROCHAINE ÉTAPE : LE VOLANT',
  'export.title': 'Emportez votre tracé.',
  'export.author': 'Créateur',
  'export.authorOptional': 'facultatif',
  'export.authorPlaceholder': 'Votre nom ou pseudo',
  'export.formatLegend': 'Format de l’export',
  'export.ac': 'Assetto Corsa',
  'export.acTag': 'EXPÉRIMENTAL',
  'export.acNote': 'Archive ZIP : modèle KN5, textures, surfaces, départ et stand.',
  'export.obj': 'Modèle 3D · OBJ',
  'export.objNote': 'Géométrie et textures pour poursuivre le travail dans Blender.',
  'export.noticeLead': 'Pour essais libres en solo.',
  'export.noticeWithBarriers':
    'Terrain complet inclus, avec une limite extérieure visible dans l’éditeur. Un stand, sans trajectoire IA ; les barrières tracées sont incluses avec collision. Le KN5 et le chronométrage doivent être vérifiés dans Assetto Corsa ; les routes ouvertes sont prévues pour le roulage libre.',
  'export.noticeNoBarriers':
    'Terrain complet inclus, avec une limite extérieure visible dans l’éditeur. Un stand, sans trajectoire IA ni barrières. Le KN5 et le chronométrage doivent être vérifiés dans Assetto Corsa ; les routes ouvertes sont prévues pour le roulage libre.',
  'export.installBefore': 'Décompressez le ZIP, puis copiez son dossier de circuit dans',
  'export.installAfter': '. Le guide est inclus.',
  'export.summary': '{length} km · {mode} · 1 voiture',
  'export.download': 'Télécharger le ZIP',
  'export.building': 'Création du circuit…',

  'help.eyebrow': 'PRENEZ LA CORDE',
  'help.title': 'Les premiers tours de main.',
  'help.step1Title': 'Dessinez votre ligne.',
  'help.step1':
    'Déplacez les points en vue 2D. L’outil + ajoute un point après celui sélectionné ; un double-clic sur la route l’insère à cet endroit.',
  'help.step2Title': 'Donnez-lui du caractère.',
  'help.step2':
    'Réglez la largeur, les vibreurs et l’altitude de chaque point. L’aperçu 3D se fait pivoter par glisser-déposer.',
  'help.step3Title': 'Conservez votre travail.',
  'help.step3':
    'La sauvegarde locale est automatique. « Enregistrer » télécharge un projet JSON réutilisable avec « Ouvrir ».',
  'help.step4Title': 'Sécurisez les bords.',
  'help.step4Before': 'Dans ',
  'help.step4After':
    ', choisissez glissière, pneus, TecPro ou mur béton, puis tracez en deux clics sur le plan : départ, puis arrivée. Échap annule le tracé en cours.',
  'help.step5Title': 'Passez au simulateur.',
  'help.step5':
    'Exportez le ZIP Assetto Corsa, installez le dossier du circuit et lancez des essais libres en solo. L’export en jeu est encore expérimental.',
  'help.shortcutSelect': 'Sélectionner',
  'help.shortcutAdd': 'Ajouter un point',
  'help.shortcutBarrier': 'Tracer une barrière',
  'help.shortcutPan': 'Déplacer la vue',
  'help.shortcutFit': 'Tout cadrer',
  'help.shortcutUndo': 'Annuler',
  'help.shortcutRedo': 'Rétablir',
  'help.shortcutDelete': 'Supprimer un point',
  'help.keyCtrlZ': 'Ctrl Z',
  'help.keyCtrlShiftZ': 'Ctrl Maj Z',
  'help.keyCtrlS': 'Ctrl S',
  'help.keyDelete': 'Suppr',
  'help.note1':
    'Molette : zoom · Espace + glisser : déplacer la vue · Maj pendant un déplacement : grille de 5 m. Le premier point détermine la zone de départ. Une barrière se trace du point de départ au point d’arrivée, sur la rive cliquée. Maximum {maxPoints} points et {maxBarriers} tronçons de barrière.',
  'help.note2':
    'Roadbuilder est un outil indépendant, non affilié à Kunos Simulazioni. Aucune donnée n’est envoyée à un serveur.',

  'toast.barrierSamePoint': 'Choisissez un point d’arrivée différent du point de départ.',
  'toast.barriersLimit': 'Maximum {max} tronçons de barrière.',
  'toast.barrierAdded': 'Barrière ajoutée. Échap pour terminer le tracé.',
  'toast.pointTooClose': 'Placez ce point à au moins 2 mètres des autres.',
  'toast.pointsLimit': 'Maximum {max} points par tracé.',
  'toast.projectDownloaded': 'Projet téléchargé. Gardez ce fichier pour reprendre votre travail.',
  'toast.importTooLarge': 'Ce fichier dépasse 1 Mo. Choisissez un projet Roadbuilder JSON.',
  'toast.importInvalidJson':
    'Le fichier n’est pas un JSON valide. Votre projet actuel est conservé.',
  'toast.projectOpened': '« {name} » est ouvert.',
  'toast.newProject': 'Nouveau tracé. Ctrl+Z permet de retrouver le précédent.',
  'toast.archiveDownloaded': 'Archive téléchargée. Le guide d’installation est dans le ZIP.',
  'toast.sourcesDownloaded': 'Sources 3D téléchargées : OBJ, matériaux et textures.',
  'toast.exportFailed': 'Export impossible : {reason}',
  'toast.storageUnreadable':
    'La sauvegarde locale n’a pas pu être relue. Le circuit de démonstration est ouvert ; votre fichier projet reste importable.',
  'project.defaultName': 'Mon tracé',
} as const;

export type MessageKey = keyof typeof frMessages;

type Placeholders<S extends string> = S extends `${string}{${infer Name}}${infer Rest}`
  ? Name | Placeholders<Rest>
  : never;

/** Parameters required by a message, derived from its {placeholders}. */
export type MessageParams<K extends MessageKey> = Record<
  Placeholders<(typeof frMessages)[K]>,
  string | number
>;

/** French labels of the ranged numeric fields carried by value-range errors. */
const FIELD_LABELS: Record<ProjectField, string> = {
  x: 'Position X',
  y: 'Altitude',
  z: 'Position Z',
  width: 'Largeur',
  shoulder: 'Accotement',
  terrainMargin: 'Marge du terrain',
  barrierOffset: 'Décalage de barrière',
};

/** Turns a project import failure into the French text shown to the user. */
export function formatProjectError(detail: ProjectErrorDetail): string {
  switch (detail.code) {
    case 'project-format':
      return 'Ce fichier n’est pas un projet Roadbuilder version 1.';
    case 'name-length':
      return `Le nom doit contenir de ${detail.min} à ${detail.max} caractères.`;
    case 'author-length':
      return `Auteur invalide (${detail.max} caractères maximum).`;
    case 'track-options':
      return 'Options du tracé invalides.';
    case 'points-limit':
      return `Maximum ${detail.max} points.`;
    case 'invalid-point':
      return 'Point invalide.';
    case 'value-range':
      return `${FIELD_LABELS[detail.field]} : valeur attendue entre ${detail.min} et ${detail.max}.`;
    case 'barriers-limit':
      return `Maximum ${detail.max} tronçons de barrière.`;
    case 'barriers-min-points':
      return 'Les barrières nécessitent au moins deux points de tracé.';
    case 'invalid-barrier':
      return 'Barrière invalide.';
    case 'barrier-type':
      return 'Type de barrière inconnu.';
    case 'barrier-side':
      return 'Côté de barrière invalide.';
    case 'barrier-index':
      return `${detail.end === 'from' ? 'Début' : 'Fin'} de barrière : indice de point hors du tracé.`;
    case 'barrier-span':
      return 'Une barrière doit couvrir au moins deux points.';
    case 'barrier-direction':
      return 'Sur une route ouverte, une barrière doit suivre le sens du tracé.';
  }
}

/** Turns a track diagnostic into the French text shown to the user. */
export function formatTrackIssue(issue: TrackIssue): string {
  switch (issue.code) {
    case 'points-minimum':
      return issue.closed
        ? `Ajoutez au moins ${issue.min} points pour fermer le circuit.`
        : `Ajoutez au moins ${issue.min} points pour créer une route.`;
    case 'track-too-short':
      return `Le tracé doit mesurer au moins ${issue.min} m pour accueillir le départ.`;
    case 'points-too-close':
      return `Deux points consécutifs sont trop proches (minimum ${issue.min} m).`;
    case 'steep-grade':
      return `Pente maximale de ${Math.round(issue.grade)} % : certaines voitures auront des difficultés.`;
    case 'tight-turn':
      return `Virage trop serré entre les points ${issue.from + 1} et ${issue.to + 1} pour cette largeur. Écartez les points du virage ou réduisez la largeur.`;
    case 'track-crossing':
      return 'Le tracé se croise : déplacez les points concernés. Les ponts ne sont pas pris en charge.';
  }
}

/** Turns a failed export into the French text appended to « Export impossible ». */
export function formatExportError(error: ExportError): string {
  return error.detail.code === 'invalid-track'
    ? (error.issues?.errors ?? []).map(formatTrackIssue).join('\n')
    : 'Un bord de route ou de stand se replie dans un virage. Écartez les points, réduisez la largeur ou déplacez le début du tracé vers une ligne droite.';
}

/** French texts embedded in the exported archives. */
export const frDocuments: DocumentTexts = {
  objHeader: '# Roadbuilder — mètres, Y vertical, avant -Z',
  trackDescription: (closed) =>
    `Créé avec Roadbuilder. ${closed ? 'Circuit fermé' : 'Route ouverte'}. Prototype pour essais libres en solo.`,
  objReadme: (barrierCount) =>
    'Roadbuilder — sources 3D\n\nImportez track.obj dans Blender (axe vertical Y, avant -Z, échelle 1 m).\nLes textures se trouvent dans texture/. Les transformations des repères Assetto Corsa sont dans markers.json (matrices 4×4, translation sur la dernière ligne).\nOBJ ne conserve pas les repères AC : recréez-les si vous passez par Blender/ksEditor.\nPour un export KN5 direct, utilisez Exporter > Assetto Corsa dans Roadbuilder.\n' +
    (barrierCount
      ? 'Les maillages 1WALL_* sont les colliders du jeu (invisibles sur la piste) ; les décors des barrières n’ont pas de préfixe.\n'
      : ''),
  installation: ({ name, slug, terrainMargin, barrierCount, warnings }) =>
    `ROADBUILDER — ${name}\n\nEXPORT KN5 EXPÉRIMENTAL, À VÉRIFIER EN JEU\n\n1. Décompressez cette archive dans un dossier temporaire.\n2. Copiez content/tracks/${slug} dans assettocorsa/content/tracks/.\n   Si ce nom existe déjà, conservez une copie de votre ancienne version avant de la remplacer.\n3. Dans Content Manager ou Assetto Corsa, sélectionnez ${name}.\n4. Lancez des ESSAIS LIBRES, avec une seule voiture et sans adversaires.\n\nINCLUS\n${
      barrierCount
        ? `Barrières : ${barrierCount} tronçon${barrierCount > 1 ? 's' : ''} avec collision (glissières, pneus, TecPro ou murs).\n`
        : ''
    }Chaussée avec collisions, accotements, vibreurs optionnels, textures intégrées au KN5,\nrepères de départ/stand et chronométrage, surfaces, plan et aperçu.\nTerrain en herbe avec collisions, à l’intérieur et autour du tracé, raccordé à son relief.\nMarge extérieure du terrain : ${terrainMargin} m au-delà des limites des accotements.\nLe point 1 définit le début du tracé ; la ligne de départ est placée après le stand.\n\nLIMITES DE CETTE VERSION\nLa compatibilité en jeu n’a pas été vérifiée automatiquement.\nUn emplacement de stand seulement, sans véritable voie des stands.\nPas de trajectoires IA : les courses contre l’IA ne sont pas prises en charge.\nRoutes ouvertes : essais libres uniquement ; chronométrage point-à-point non validé.\nLe terrain s’arrête au rectangle en pointillés visible dans l’éditeur.\nAu-delà de ce bord extérieur, une chute reste possible. Augmentez la marge si nécessaire.\n${
      barrierCount
        ? 'Les barrières sont des colliders simples : vérifiez les impacts en jeu.\nLe relief du terrain est interpolé automatiquement.\n'
        : 'Pas de barrières, de ponts ou de décor ; le relief du terrain est interpolé automatiquement.\n'
    }Les chevauchements de bords de route/accotements ne sont pas tous détectés.\nPour un circuit destiné à la compétition, vérifiez et complétez le modèle dans un outil 3D.\n\nLe fichier projet.roadbuilder.json permet de reprendre le travail dans l’éditeur.\n${
      warnings.length ? '\nAVERTISSEMENTS\n' + warnings.map(formatTrackIssue).join('\n') : ''
    }\n`,
};
