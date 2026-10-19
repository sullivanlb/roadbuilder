# Roadbuilder

Un éditeur local, **en français et en anglais**, pour créer des circuits fermés et des routes ouvertes pour Assetto Corsa. L’application utilise **Vue 3, vue-i18n, TypeScript strict et Vite**. Le dessin, le terrain, l’aperçu 3D, la sauvegarde et les exports sont exécutés dans le navigateur ; les projets ne sont pas envoyés à un serveur.

## Installer et lancer

Prérequis : **Node.js 22.12+ (branche 22) ou 24+**, avec npm.

```bash
npm ci
npm run dev
```

Ouvrez **http://127.0.0.1:5173/**. La première installation nécessite Internet ; les dépendances et ressources de l’application sont ensuite locales.

Conservez cette même adresse pour retrouver la sauvegarde automatique. `localhost`, `127.0.0.1`, un autre port et un hébergement distant ont des stockages distincts. Le serveur de développement utilise un port fixe et signale s’il est déjà occupé.

## Développement et distribution

| Commande            | Usage                                                            |
| ------------------- | ---------------------------------------------------------------- |
| `npm run dev`       | Serveur de développement avec rechargement automatique           |
| `npm run typecheck` | Typage strict de l’application, de la configuration et des tests |
| `npm test`          | Tests de géométrie, exports, historique, stockage et interface   |
| `npm run test:ui`   | Tests de l’interface Vue avec DOM et canvas simulés              |
| `npm run build`     | Vérification des types et compilation dans `dist/`               |
| `npm run preview`   | Aperçu local de la compilation, à l’adresse affichée par Vite    |

Pour distribuer l’application, servez le contenu de **`dist/`** sur un hébergement statique HTTP(S). Les chemins des ressources sont relatifs pour permettre un sous-répertoire. Aucun PHP ni serveur applicatif n’est requis ; `dist/index.html` n’est pas prévu pour une ouverture directe par double-clic. La sauvegarde automatique est propre à l’adresse de l’hébergement : utilisez l’export/import JSON pour transférer vos projets.

### Organisation du code

- `src/components/` : composants Vue rangés par zone — `layout/` (barre d’actions), `sidebar/` (réglages, barrières, relief), `workspace/` (canvas, statistiques, profil d’altitude), `dialogs/` (nouveau, export, aide) et `ui/` (champs et icônes partagés).
- `src/composables/` : état partagé de l’éditeur, historique des actions, sauvegarde et interactions avec le canvas. L’état est créé par instance d’application et partagé par injection.
- `src/domain/` : types des projets, validation, géométrie, maillages, terrain, scènes, historique et accès au stockage. Ces modules ne dépendent pas de Vue.
- `src/export/` : encodeurs binaires PNG/ZIP, KN5, OBJ et structure des archives Assetto Corsa.
- `src/i18n/` : moteur **vue-i18n** avec une façade typée — catalogues français et anglais (messages typés, diagnostics, documents exportés), formats de nombres et sélecteur de langue.
- `src/rendering/` : moteur canvas 2D/3D, avec nettoyage des observateurs et animations au démontage.
- `src/styles/` : styles de l’interface existante.
- `tests/` : tests Vitest ; `fixtures/legacy-baseline.json` contient les mesures et empreintes SHA-256 capturées avant migration pour les trois modèles et leurs deux exports.

Les composants utilisent la Composition API. Les données géométriques volumineuses restent hors de la réactivité profonde. Les mutations du projet passent par le composable pour regrouper chaque geste ou saisie dans l’historique. Les écouteurs globaux, temporisations et URL de téléchargement sont libérés au démontage.

### Backend

**Aucun backend pour le moment.** Si des comptes, une bibliothèque partagée ou des traitements distants deviennent nécessaires, le backend sera développé avec **Symfony**. Il n’y a pas de dépendance PHP, de base de données ni d’API factice dans cette version.

### Vérifications avant livraison

Les tests vérifient les projets anciens et invalides, le maillage et ses indices, les exports identiques octet par octet à l’ancienne version, les gestes et raccourcis, l’historique, la restauration, la récupération des sauvegardes corrompues, les téléchargements, ainsi que les barrières : validation, colliders orientés vers la piste, bridage dans les virages, traçage, sélection, entretien et exports. Les deux catalogues de langue sont compilés et comparés clé par clé (placeholders et formes plurielles comprises). Les tests d’interface utilisent un DOM et un canvas simulés : ils ne remplacent pas une vérification visuelle dans un navigateur.

Pour la vérification manuelle : ouvrir les trois modèles et une page blanche, déplacer/ajouter/supprimer des points, régler largeur et relief, naviguer en 2D/3D, tester zoom et raccourcis, tracer des barrières des quatre types, enregistrer/recharger/importer un projet, puis télécharger les ZIP Assetto Corsa et OBJ. Comparer également le rendu aux dimensions bureau et mobile. La validation dans Assetto Corsa reste manuelle.

## Fonctionnalités disponibles

- Circuits fermés et routes ouvertes, avec modèles club, karting, montagne et page blanche.
- Dessin en 2D : ajout, déplacement et suppression de points, zoom et navigation.
- Réglage de la largeur, des accotements, des vibreurs et de l’altitude par point.
- Barrières avec collision : glissières, pneus, blocs TecPro et murs en béton, tracés en deux clics le long de la piste.
- Terrain complet en herbe, raccordé au relief, à l’intérieur et autour du tracé, avec une marge réglable de 50 à 500 m et des collisions dans Assetto Corsa.
- Aperçu 3D orientable et profil d’altitude.
- Annulation et rétablissement des modifications.
- Sauvegarde locale automatique et import/export de projets `.roadbuilder.json`.
- Export ZIP Assetto Corsa avec modèle KN5, textures, surfaces, départ et stand.
- Export OBJ avec matériaux et textures pour poursuivre la modélisation dans un outil 3D.
- Interface bilingue **français / anglais** : le sélecteur **FR / EN** de la barre d’actions traduit l’interface et les documents exportés (`INSTALLATION.txt`, `LIRE-MOI.txt`, description `ui_track.json`). Le choix est mémorisé dans le navigateur.

## Créer et conserver un tracé

1. Cliquez sur **Nouveau** et choisissez un modèle ou une page blanche.
2. Déplacez les points en **Plan 2D**. L’outil **+** ajoute un point après celui sélectionné ; un double-clic sur la chaussée insère un point à cet endroit.
3. Réglez la largeur et les accotements, puis sélectionnez les points pour modifier leur altitude. Dans **Le terrain**, choisissez la marge autour du tracé. Les unités sont en mètres.
4. Sécurisez les bords dans **Les barrières** : choisissez un type, puis tracez un tronçon en deux clics, du point de départ au point d’arrivée. Réglez son écartement, changez-le de côté ou supprimez-le.
5. Consultez **Aperçu 3D** pour observer le relief ; glissez pour tourner et utilisez la molette pour zoomer.
6. Cliquez sur **Enregistrer** pour télécharger un fichier projet. Utilisez **Ouvrir** pour le reprendre plus tard.

La sauvegarde automatique dépend du navigateur et de l’adresse de l’application. Enregistrez une copie du projet avant de déplacer l’application ou de supprimer les données du navigateur. L’historique d’annulation reste limité à la session en cours.

### Repérer un virage trop serré

Le contrôle de largeur examine la courbe calculée **entre les points de contrôle**. Un problème peut donc se situer entre deux points, même si les points eux-mêmes semblent bien espacés.

Les portions concernées sont surlignées en rouge avec un repère **!** dans les vues 2D et 3D. Leurs points de contrôle sont également signalés dans le plan 2D ; leur sélection affiche le diagnostic dans le panneau de gauche. Le message indique les deux numéros, y compris le dernier et le premier point pour la fermeture d’un circuit.

Utilisez **Voir le virage**, sous le tracé ou dans le dialogue d’export, pour revenir au plan 2D, cadrer la portion et sélectionner son premier point. Les indications se mettent à jour après chaque modification, import, annulation ou rétablissement. Écartez les points du virage ou réduisez la largeur ; l’export reste bloqué tant que le contrôle détecte ce problème.

### Terrain complet

Le sol est généré automatiquement dès que le tracé comporte au moins deux points. Il remplit l’intérieur des circuits et les espaces entre les portions d’une route ouverte, puis s’étend autour du tracé dans un rectangle. La marge se règle dans **Le terrain → Marge autour du tracé** : **150 m par défaut**, de **50 à 500 m**.

Le terrain suit les altitudes du tracé et se raccorde aux accotements. Son maillage est découpé autour de la chaussée, des vibreurs et du stand afin de ne pas les recouvrir. Les petites différences de hauteur existantes aux extrémités des vibreurs ou du stand sont raccordées progressivement. Le relief éloigné est interpolé automatiquement ; la sculpture manuelle du terrain reste une tâche à réaliser.

Le contour en pointillés du plan 2D montre la limite extérieure. L’aperçu 3D affiche le terrain réel. Les exports **Assetto Corsa et OBJ** incluent cette même géométrie ; dans le jeu, elle utilise la surface physique **GRASS**. Au-delà du contour extérieur, il n’y a plus de sol : augmentez la marge pour disposer de plus d’espace.

Les anciens projets restent compatibles et reçoivent automatiquement la marge par défaut. Pour ajouter le terrain à un circuit déjà installé, ouvrez son projet, exportez un nouveau ZIP et remplacez son dossier dans le jeu après avoir sauvegardé l’ancienne version.

### Barrières et collisions

Les tronçons se posent avec l’outil **B** ou le bouton **Tracer sur le plan** : un premier clic fixe le point de départ sur la rive cliquée, un second le point d’arrivée. L’aperçu suit la piste entre les deux points. Échap annule le tracé en cours ; les tronçons se règlent ensuite dans **Les barrières** (écartement de 0 à 10 m au-delà du vibreur, changement de côté, suppression). Maximum **120 tronçons**.

Les quatre types ont des hauteurs réalistes : glissière 0,78 m, pneus 0,85 m, TecPro 0,85 m, mur en béton 1,1 m. Comme les circuits officiels, chaque tronçon produit un **collider invisible** nommé `1WALL_*` que le jeu utilise pour la collision, plus un décor visible (rail, pneus, blocs rouges et blancs ou mur). Les colliders restent à l’extérieur de la chaussée, y compris dans les virages très serrés.

L’inversion du sens du tracé retourne les tronçons, la suppression d’un point déplace ou supprime les tronçons concernés, et le passage en route ouverte scinde les tronçons qui bouclaient. Les projets sans barrière gardent des exports strictement identiques à la version précédente.

| Action                                    | Raccourci                           |
| ----------------------------------------- | ----------------------------------- |
| Sélection / ajout / déplacement de la vue | V / A / H                           |
| Tracer une barrière                       | B                                   |
| Navigation temporaire                     | Espace + glisser, ou bouton central |
| Cadrer le tracé                           | F                                   |
| Grille de 5 m pendant un déplacement      | Maj                                 |
| Annuler / rétablir                        | Ctrl+Z / Ctrl+Maj+Z ou Ctrl+Y       |
| Enregistrer le projet                     | Ctrl+S                              |
| Supprimer le point sélectionné            | Suppr                               |

Sur macOS, les raccourcis Ctrl acceptent aussi Cmd.

## Importer le circuit dans Assetto Corsa

1. Dans Roadbuilder, cliquez sur **Exporter le tracé → Assetto Corsa → Télécharger le ZIP**.
2. Décompressez le ZIP.
3. Dans les fichiers extraits, ouvrez `content/tracks/` et copiez le dossier `rb_nom_du_circuit` dans le dossier `assettocorsa/content/tracks/` du jeu.
4. Le dossier du circuit doit contenir directement son fichier `.kn5`, `models.ini` et les dossiers `data` et `ui`.
5. Ouvrez ou relancez Assetto Corsa / Content Manager, sélectionnez le circuit et lancez des **essais libres, une voiture, sans adversaires**.

Conservez une copie de l’ancienne version si vous remplacez un circuit existant. Le fichier `INSTALLATION.txt` inclus dans le ZIP rappelle la procédure.

## Tâches à réaliser

Les cases cochées indiquent les fonctionnalités livrées. Les autres restent à réaliser.

Prochaines priorités : **stands → trajectoires IA → dévers**.

- [x] **Terrain complet** : sol continu à l’intérieur et autour du tracé, marge réglable, adaptation au relief, aperçu 2D/3D et export avec collisions.
- [x] **Barrières et murs** : glissières, pneus, TecPro et murs en béton tracés en deux clics, avec colliders invisibles dans Assetto Corsa.
- [ ] **Vrais stands** : créer une voie d’entrée et de sortie, plusieurs emplacements et une grille de départ.
- [ ] **Trajectoires IA** : permettre aux adversaires de parcourir le circuit et de rejoindre les stands.
- [ ] **Largeur variable** : régler la largeur par portion pour élargir une ligne droite ou resserrer un passage.
- [ ] **Dévers et virages relevés** : incliner la chaussée dans les courbes.
- [ ] **Outils de dessin précis** : ajouter des lignes droites, arcs de cercle et virages à rayon réglable.
- [ ] **Départ et chronométrage personnalisables** : déplacer les lignes de départ et d’arrivée ainsi que les secteurs.
- [ ] **Décors à placer** : ajouter arbres, bâtiments, tribunes, panneaux et éclairages.
- [ ] **Revêtements personnalisés** : choisir asphalte, terre, gravier, marquages et vibreurs par portion.
- [ ] **Sculpture du terrain** : créer collines, talus, fossés et dégagements.
- [ ] **Image de fond** : importer un plan ou une vue aérienne et dessiner dessus à l’échelle.
- [ ] **Import GPX** : utiliser une trace GPS comme base pour reproduire une route.
- [ ] **Caméra embarquée** : parcourir virtuellement le tracé avant de l’exporter.
- [ ] **Bibliothèque de projets** : gérer plusieurs circuits avec miniatures et versions.
- [ ] **Installation automatique** : envoyer le circuit dans le dossier du jeu depuis le logiciel.
- [ ] **Application Windows `.exe`** : proposer un lancement comme logiciel de bureau.

## Limites actuelles

L’import dans Assetto Corsa a été confirmé par l’utilisateur pour la version précédente. L’ajout du terrain a été testé sur la géométrie et les exports, mais reste à vérifier en jeu. L’export reste expérimental et vise les essais libres en solo ; cela ne valide pas tous les tracés ni toutes les configurations du jeu.

- Un emplacement de départ et un stand, sans véritable voie des stands.
- Pas de trajectoires IA ni de courses avec des adversaires.
- Chronométrage à vérifier, particulièrement sur les routes ouvertes, prévues pour le roulage libre.
- Le terrain reste limité au rectangle visible dans l’éditeur ; posez des barrières aux endroits risqués, sinon une chute reste possible au-delà.
- Les barrières utilisent des colliders simplifiés ; leur blocage de la voiture a été confirmé en jeu.
- Pas de ponts, de dévers ni de décors. Les matériaux sont simples.
- Les intersections et certains virages trop serrés bloquent l’export ; tous les chevauchements de bords ou d’accotements ne sont pas détectés.

## Références

Le format KN5 suit la disposition des champs publiée dans le [code source AcTools de gro-ove](https://github.com/gro-ove/actools/blob/master/AcTools/Kn5File/Kn5Writer.cs). L’encodeur est une implémentation indépendante en JavaScript, sans bibliothèque AcTools embarquée.

Aucune donnée n’est envoyée à un serveur. Roadbuilder est un projet indépendant, non affilié à Kunos Simulazioni.
