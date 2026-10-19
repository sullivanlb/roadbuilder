/**
 * French catalogue: the source of truth for every message. The `as const` object
 * feeds both the key types used by t() and the vue-i18n messages given to
 * createI18n; en.ts must provide the same keys.
 *
 * Messages stay free of the vue-i18n syntax characters (| @ $): a `|` is only
 * used to separate plural forms, in the messages documented as such.
 */
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
  'editor.pitsTitle': 'Tracer la voie des stands (P)',
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
  'canvas.hintPits':
    'Cliquez l’entrée de la voie des stands, sur la rive voulue · Échap quitte l’outil',
  'canvas.hintPitsDraft': 'Cliquez la sortie de la voie des stands · Échap annule',
  'canvas.hintSelect': 'Glissez un point · Molette pour zoomer · Espace + glisser pour naviguer',
  'canvas.start': 'DÉPART',
  'canvas.finish': 'ARRIVÉE',

  'preview.unavailable':
    'L’aperçu 3D nécessite WebGL, indisponible sur cet appareil. Le plan 2D reste utilisable.',

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
  'sidebar.startLine': 'Ligne de départ',
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
  'barriers.count': '{count} TRONÇON | {count} TRONÇONS',
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

  'pits.title': 'Les stands',
  'pits.roadOnly':
    'Les stands sont réservés aux circuits fermés : une route ouverte accueille une seule voiture.',
  'pits.empty': 'Pas encore de voie des stands : une seule voiture, qui part de la ligne.',
  'pits.draw': 'Tracer la voie',
  'pits.statusTool': 'Cliquez l’entrée de la voie sur la piste, du côté voulu. Échap annule.',
  'pits.statusDraft': 'Cliquez maintenant la sortie de la voie.',
  'pits.cars': 'Nombre de voitures',
  'pits.carsUnit': 'voitures',
  'pits.width': 'Largeur de la voie',
  'pits.entry': 'Entrée',
  'pits.exit': 'Sortie',
  'pits.sideRight': 'Voie à droite de la piste',
  'pits.sideLeft': 'Voie à gauche de la piste',
  'pits.delete': 'Supprimer la voie',
  'position.point': 'Point',
  'position.distance': 'm après',
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
  'help.shortcutPits': 'Tracer les stands',
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
  'toast.pitLaneAdded':
    'Voie des stands ajoutée. Réglez le nombre de voitures dans « Les stands ».',
  'toast.pitLaneSamePlace': 'Choisissez une sortie éloignée de l’entrée.',
  'toast.pointTooClose': 'Placez ce point à au moins {min} mètres des autres.',
  'toast.pointsLimit': 'Maximum {max} points par tracé.',
  'toast.projectDownloaded': 'Projet téléchargé. Gardez ce fichier pour reprendre votre travail.',
  'toast.projectOpened': '« {name} » est ouvert.',
  'toast.newProject': 'Nouveau tracé. Ctrl+Z permet de retrouver le précédent.',
  'toast.archiveDownloaded': 'Archive téléchargée. Le guide d’installation est dans le ZIP.',
  'toast.sourcesDownloaded': 'Sources 3D téléchargées : OBJ, matériaux et textures.',
  'toast.exportFailed': 'Export impossible : {reason}',
  'toast.storageUnreadable':
    'La sauvegarde locale n’a pas pu être relue. Le circuit de démonstration est ouvert ; votre fichier projet reste importable.',
  'project.defaultName': 'Mon tracé',
  'template.club': 'Circuit des Collines',
  'template.kart': 'Karting des Pins',
  'template.mountain': 'Col de la Lumière',
  'template.blank': 'Mon nouveau tracé',

  'projectError.fileTooLarge': 'Ce fichier dépasse {size} Mo. Choisissez un projet Roadbuilder.',
  'projectError.invalidJson':
    'Le fichier n’est pas un JSON valide. Votre projet actuel est conservé.',
  'projectError.notAProject': 'Ce fichier n’est pas un projet Roadbuilder version 2.',
  'projectError.pointsLimit': 'Le projet dépasse {max} points.',
  'projectError.barriersLimit': 'Le projet dépasse {max} tronçons de barrière.',
  'projectError.duplicateId': 'Le projet contient deux éléments avec le même identifiant.',
  'projectError.barrierEndpoint': 'Une barrière s’appuie sur un point qui n’existe pas.',
  'projectError.barrierSpan': 'Une barrière doit relier deux points différents.',
  'projectError.barrierDirection':
    'Sur une route ouverte, une barrière doit suivre le sens du tracé.',
  'projectError.positionPoint': 'Un repère de piste s’appuie sur un point qui n’existe pas.',
  'projectError.pitLaneOnRoad': 'Une route ouverte ne peut pas avoir de voie des stands.',
  'projectError.carsWithoutPitLane': 'Plusieurs voitures nécessitent une voie des stands.',
  'projectError.invalidValue': 'Valeur invalide dans le projet : {path}.',

  'trackIssue.pointsMinimumClosed': 'Ajoutez au moins {min} points pour fermer le circuit.',
  'trackIssue.pointsMinimumOpen': 'Ajoutez au moins {min} points pour créer une route.',
  'trackIssue.trackTooShort': 'Le tracé doit mesurer au moins {min} m pour accueillir le départ.',
  'trackIssue.pointsTooClose': 'Deux points consécutifs sont trop proches (minimum {min} m).',
  'trackIssue.steepGrade':
    'Pente maximale de {grade} % : certaines voitures auront des difficultés.',
  'trackIssue.tightTurn':
    'Virage trop serré entre les points {from} et {to} pour cette largeur. Écartez les points du virage ou réduisez la largeur.',
  'trackIssue.trackCrossing':
    'Le tracé se croise : déplacez les points concernés. Les ponts ne sont pas pris en charge.',

  'trackIssue.pitLaneTooShort':
    'La voie des stands n’accueille que {capacity} voitures sur {cars} : allongez-la ou réduisez le nombre de voitures.',
  'trackIssue.pitLaneTooTight':
    'La voie des stands est trop serrée entre les points {from} et {to} : placez-la à l’extérieur du virage ou réduisez sa largeur.',
  'exportError.foldedSurface':
    'Un bord de route ou de stand se replie dans un virage. Écartez les points, réduisez la largeur ou déplacez le début du tracé vers une ligne droite.',

  'documents.objHeader': '# Roadbuilder — mètres, Y vertical, avant -Z',
  'documents.trackDescription':
    'Créé avec Roadbuilder. {mode}. Prototype pour essais libres en solo.',
  'documents.objReadme':
    'Roadbuilder — sources 3D\n\nImportez track.obj dans Blender (axe vertical Y, avant -Z, échelle 1 m).\nLes textures se trouvent dans texture/. Les transformations des repères Assetto Corsa sont dans markers.json (matrices 4×4, translation sur la dernière ligne).\nOBJ ne conserve pas les repères AC : recréez-les si vous passez par Blender/ksEditor.\nPour un export KN5 direct, utilisez Exporter > Assetto Corsa dans Roadbuilder.\n',
  'documents.objReadmeBarriers':
    'Les maillages 1WALL_* sont les colliders du jeu (invisibles sur la piste) ; les décors des barrières n’ont pas de préfixe.\n',
  'documents.installationHead':
    'ROADBUILDER — {name}\n\nEXPORT KN5 EXPÉRIMENTAL, À VÉRIFIER EN JEU\n\n1. Décompressez cette archive dans un dossier temporaire.\n2. Copiez content/tracks/{slug} dans assettocorsa/content/tracks/.\n   Si ce nom existe déjà, conservez une copie de votre ancienne version avant de la remplacer.\n3. Dans Content Manager ou Assetto Corsa, sélectionnez {name}.\n4. Lancez des ESSAIS LIBRES, avec une seule voiture et sans adversaires.\n\nINCLUS\n',
  'documents.installationBarriers':
    'Barrières : {count} tronçon avec collision (glissières, pneus, TecPro ou murs).|Barrières : {count} tronçons avec collision (glissières, pneus, TecPro ou murs).',
  'documents.installationPitLane':
    'Voie des stands avec muret, {count} emplacements et grille de départ de {count} places.\n',
  'documents.installationSpawnPit':
    'Un seul emplacement de stand, à côté du départ, sans voie des stands.\n',
  'documents.installationBody':
    'Chaussée avec collisions, accotements, vibreurs optionnels, textures intégrées au KN5,\nrepères de départ/stands et chronométrage, surfaces, plan et aperçu.\nTerrain en herbe avec collisions, à l’intérieur et autour du tracé, raccordé à son relief.\nMarge extérieure du terrain : {terrainMargin} m au-delà des limites des accotements.\nLe point 1 définit le début du tracé ; la ligne de départ est placée après le stand.\n\nLIMITES DE CETTE VERSION\nLa compatibilité en jeu n’a pas été vérifiée automatiquement.\nPas de trajectoires IA : les courses contre l’IA ne sont pas prises en charge.\nRoutes ouvertes : essais libres uniquement ; chronométrage point-à-point non validé.\nLe terrain s’arrête au rectangle en pointillés visible dans l’éditeur.\nAu-delà de ce bord extérieur, une chute reste possible. Augmentez la marge si nécessaire.\n',
  'documents.installationBarrierLimits':
    'Les barrières sont des colliders simples : vérifiez les impacts en jeu.\nLe relief du terrain est interpolé automatiquement.\n',
  'documents.installationNoBarrierLimits':
    'Pas de barrières, de ponts ou de décor ; le relief du terrain est interpolé automatiquement.\n',
  'documents.installationTail':
    'Les chevauchements de bords de route/accotements ne sont pas tous détectés.\nPour un circuit destiné à la compétition, vérifiez et complétez le modèle dans un outil 3D.\n\nLe fichier {projectFile} permet de reprendre le travail dans l’éditeur.\n',
  'documents.installationWarnings': 'AVERTISSEMENTS',
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
