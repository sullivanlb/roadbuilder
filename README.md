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

| Commande                 | Usage                                                                             |
| ------------------------ | --------------------------------------------------------------------------------- |
| `npm run dev`            | Serveur de développement avec rechargement automatique                            |
| `npm run typecheck`      | Typage strict de l’application, de la configuration et des tests                  |
| `npm test`               | Tests du domaine, des exports, des stores et de l’interface                       |
| `npm run test:ui`        | Tests de l’interface Vue avec DOM et canvas simulés                               |
| `npm run build`          | Vérification des types et compilation dans `dist/`                                |
| `npm run preview`        | Aperçu local de la compilation, à l’adresse affichée par Vite                     |
| `npm run assets:scenery` | Reconstruit arbres et textures du décor avec Blender (Python 3 et Blender requis) |

Les assets du décor sont versionnés dans `src/assets/scenery` : la compilation n’a pas besoin de Blender. `npm run assets:scenery` télécharge les sources CC0 de Poly Haven dans `.cache/` et les régénère (docs/adr/0014) ; la variable `BLENDER` indique Blender s’il n’est pas trouvé.

Pour distribuer l’application, servez le contenu de **`dist/`** sur un hébergement statique HTTP(S). Les chemins des ressources sont relatifs pour permettre un sous-répertoire. Aucun PHP ni serveur applicatif n’est requis ; `dist/index.html` n’est pas prévu pour une ouverture directe par double-clic. La sauvegarde automatique est propre à l’adresse de l’hébergement : utilisez l’export/import JSON pour transférer vos projets.

### Organisation du code

Le vocabulaire du domaine est défini dans [`CONTEXT.md`](CONTEXT.md), les décisions d’architecture dans [`docs/adr/`](docs/adr/) et ce qu’Assetto Corsa attend d’un export — appris en jeu ou documenté — dans [`docs/assetto-corsa.md`](docs/assetto-corsa.md). Complétez ce dernier après chaque test en jeu. Chaque couche n’importe que les couches inférieures ; ESLint le vérifie.

- `src/core/` : le domaine, sans framework. `project/` contient le format v2 (schéma zod, règles et bornes, modèles, opérations d’édition immer), `track/` l’axe du tracé (courbes, droites et points arrondis), les plages entre deux repères, les largeurs, les dévers et les diagnostics, `scene/` la construction de la scène (chaussée, terrain et terrassements, barrières, repères).
- `src/export/` : archives Assetto Corsa (KN5, fichiers ini, carte) et OBJ, encodeurs binaires PNG/ZIP. Les textes des documents exportés sont fournis par l’appelant.
- `src/rendering/` : dessin du plan 2D et de la bande de piste (Canvas 2D), aperçu 3D (Three.js, chargé à la demande), palette de couleurs.
- `src/workers/` : construction des archives dans un Web Worker (Comlink), pour que l’éditeur reste fluide pendant un export ; repli sur le thread principal si les workers ne sont pas disponibles.
- `src/platform/` : accès au stockage et aux fichiers derrière une interface ; implémentation web aujourd’hui, Tauri ensuite.
- `src/stores/` : état Pinia — projet et historique, éditeur (couche, sélection, outil, tracés en cours, plage, survol), vue du plan et de la bande, fichiers et sauvegarde automatique, export, interface.
- `src/editor/` : couches et ce que le clic y attrape, outils du plan (un module par outil), clics dans l’aperçu 3D, interactions au pointeur et raccourcis clavier.
- `src/components/` : composants Vue avec styles scoped — `layout/` (barre du haut, couches), `inspector/` et `sidebar/` (réglages de la couche active), `workspace/` (plan, bande, 3D), `dialogs/` et `ui/` (primitives partagées).
- `src/i18n/` : vue-i18n avec catalogues français et anglais typés.
- `src/styles/` : jetons de design et styles de base uniquement.
- `tests/` : Vitest — `core/` et `export/` sans DOM, `stores.test.ts` pour la logique de l’éditeur, `workers.test.ts` pour l’export en arrière-plan, `app.test.ts` pour l’interface (DOM et canvas simulés).

Le projet est une valeur immuable : chaque modification produit un nouveau projet, l’historique conserve les versions précédentes et les calculs dérivés (échantillons, diagnostics, scène) se refont uniquement quand le projet change.

### Format de projet

Les fichiers `.roadbuilder.json` sont au **format version 2** : les points de contrôle et les barrières ont des identifiants stables, et une barrière relie deux points par leurs identifiants. Les fichiers de la version 1 ne sont plus acceptés.

### Backend

**Aucun backend pour le moment.** Si des comptes, une bibliothèque partagée ou des traitements distants deviennent nécessaires, le backend sera développé avec **Symfony**. Une application de bureau **Tauri** est prévue : l’accès aux fichiers passe déjà par `src/platform/`.

### Vérifications avant livraison

La CI (GitHub Actions) vérifie le formatage, le lint, les types, les tests et la compilation à chaque push. Les tests couvrent le format de projet et ses références, les opérations d’édition, la géométrie et les diagnostics, la scène (valeurs finies, indices valides, colliders orientés vers la piste, bridage dans les virages), la structure des archives, l’historique, la sauvegarde automatique et sa récupération, ainsi que les parcours de l’interface. Les tailles de maillage et les statistiques des modèles sont figées dans des snapshots : après une modification volontaire de la géométrie, mettez-les à jour avec `npx vitest -u` et vérifiez l’export **dans Assetto Corsa**.

Pour la vérification manuelle : ouvrir les trois modèles et une page blanche, parcourir les six couches, déplacer/ajouter/supprimer des points (seuls et en groupe), tracer droites et arcs (avec et sans Maj), arrondir un point et régler son rayon, régler largeur et relief, tracer une portion plus large et une plus étroite, poser un dévers dans un virage et le vérifier en 3D, poser portions, barrières et voie des stands depuis le plan, la bande et la 3D, poser chaque type de décor puis le déplacer, le tourner, le dupliquer et basculer « Bloque les voitures », tracer un talus, un fossé et un dégagement puis changer leur type et leurs réglages, élever une colline, la creuser en cuvette et la déplacer, poser un décor dessus, sculpter au pinceau sur le plan et en 3D (monter, creuser avec Maj, lisser, aplanir, clic droit pour tourner la vue) puis annuler le coup de pinceau, tirer leurs bords dans la bande, utiliser « Aller à » et la mini-carte, tester zoom et raccourcis, enregistrer/recharger/importer un projet, puis télécharger les ZIP Assetto Corsa et OBJ. Comparer également le rendu aux dimensions bureau et mobile.

## Fonctionnalités disponibles

- Circuits fermés et routes ouvertes, avec modèles club, karting, montagne et page blanche.
- Édition par couches (tracé, chaussée, bords, stands et départ, terrain, décor) : la couche active décide de ce que le clic attrape ; les autres restent visibles, atténuées, ou masquées.
- Dessin en 2D : ajout, déplacement et suppression de points, seuls ou en groupe (rectangle de sélection, Maj + clic), zoom et navigation.
- Dessin précis : lignes droites de longueur exacte, arcs de cercle tangents au tracé et points arrondis à rayon réglable.
- Bande de piste : la piste déroulée sous le plan, avec l’altitude, les largeurs, les barrières ou les stands selon la couche ; on y choisit une plage pour y poser un élément et on y étire les éléments par leurs bords.
- Repérage sur les grands circuits : virages détectés et numérotés, mini-carte, menu « Aller à ».
- Réglage de la largeur de base, des accotements, des vibreurs et de l’altitude par point.
- Largeur variable : portions plus larges ou plus étroites, tracées en deux clics n’importe où sur la piste.
- Dévers : la chaussée s’incline par portions dans les virages, jusqu’au virage relevé d’un ovale (35°).
- Barrières avec collision : glissières, pneus, blocs TecPro et murs en béton, tracés en deux clics le long de la piste.
- Décor détaillé et texturé (modèles et textures préparés dans Blender à partir de sources CC0) : arbres et bosquets, bâtiments, tribunes, panneaux et éclairages posés librement sur le plan ou en 3D, face à la piste ; bâtiments et tribunes arrêtent les voitures (réglable par objet), les éclairages s’allument la nuit avec Custom Shaders Patch.
- Terrain complet en herbe, raccordé au relief, à l’intérieur et autour du tracé, avec une marge réglable de 50 à 500 m et des collisions dans Assetto Corsa.
- Sculpture du terrain : talus, fossés et dégagements posés en deux clics le long de la piste (ils suivent le tracé), collines et cuvettes posées librement sur le plan, et pinceau pour sculpter le relief sur le plan ou en 3D en maintenant le clic, comme dans un moteur de jeu (monter, creuser, lisser, aplanir) ; les accotements gardent leur hauteur et un avertissement signale un terrassement qui atteint une autre partie de la piste.
- Aperçu 3D orientable, où l’on sélectionne et pose comme sur le plan.
- Annulation et rétablissement des modifications.
- Sauvegarde locale automatique et import/export de projets `.roadbuilder.json`.
- Export ZIP Assetto Corsa avec modèle KN5, textures, surfaces, départ et stand.
- Export OBJ avec matériaux et textures pour poursuivre la modélisation dans un outil 3D.
- Interface bilingue **français / anglais** : le sélecteur **FR / EN** de la barre d’actions traduit l’interface et les documents exportés (`INSTALLATION.txt`, `README.txt`, description `ui_track.json`). Le choix est mémorisé dans le navigateur.

## Créer et conserver un tracé

1. Cliquez sur **Nouveau** et choisissez un modèle ou une page blanche.
2. Choisissez une **couche** dans la colonne de gauche (touches **1** à **6**). Seuls ses éléments réagissent au clic, ses outils s’affichent au-dessus du plan et ses réglages à droite. Les outils en pointillés sont prévus : un clic explique ce qu’ils feront.
3. Dans **Tracé**, déplacez les points. L’outil **+** ajoute un point après celui sélectionné ; un double-clic sur la chaussée insère un point à cet endroit. Les outils **Droite** (S) et **Arc** (R) prolongent le tracé avec une ligne droite ou un arc de cercle (voir « Droites, arcs et rayons »). Glissez dans le vide pour sélectionner plusieurs points, ou Maj + clic pour en ajouter un : ils se déplacent ensemble et leur altitude se règle en groupe.
4. Dans **Chaussée**, réglez la largeur de base, les accotements, les vibreurs, les portions de largeur et les dévers. Dans **Terrain**, choisissez la marge autour du tracé. Les unités sont en mètres.
5. Dans **Bords**, choisissez un type de barrière, puis tracez un tronçon en deux clics sur la piste, du début à la fin. Réglez son écartement, son début et sa fin, changez-le de côté ou supprimez-le.
6. Sous le plan, la **bande de piste** déroule le circuit. Glissez sur une plage pour y poser une portion, des barrières ou la voie des stands selon la couche ; tirez les bords d’un bloc pour l’allonger. La molette zoome, un double-clic montre tout.
7. Basculez sur l’**aperçu 3D** (touche **C**) pour observer le relief ; glissez pour tourner, molette pour zoomer. On y sélectionne et on y pose comme sur le plan ; les points ne se déplacent que sur le plan.
8. Cliquez sur **Enregistrer** pour télécharger un fichier projet. Utilisez **Ouvrir** pour le reprendre plus tard.

Sur un grand circuit, les virages sont détectés et numérotés en haut de la bande : un clic sur un nom cadre le virage. La mini-carte recentre le plan et le menu **Aller à** liste les virages et les problèmes à corriger.

La sauvegarde automatique dépend du navigateur et de l’adresse de l’application. Enregistrez une copie du projet avant de déplacer l’application ou de supprimer les données du navigateur. L’historique d’annulation reste limité à la session en cours.

### Repérer un virage trop serré

Le contrôle de largeur examine la courbe calculée **entre les points de contrôle**. Un problème peut donc se situer entre deux points, même si les points eux-mêmes semblent bien espacés.

Les portions concernées sont surlignées en rouge avec un repère **!** dans les vues 2D et 3D. Leurs points de contrôle sont également signalés dans le plan 2D ; leur sélection affiche le diagnostic dans le panneau de droite. Le message indique les deux numéros, y compris le dernier et le premier point pour la fermeture d’un circuit.

Utilisez **Voir le virage**, dans l’en-tête de la bande, le menu **Aller à** ou le dialogue d’export, pour revenir au plan 2D, cadrer la portion et sélectionner son premier point. Les indications se mettent à jour après chaque modification, import, annulation ou rétablissement. Écartez les points du virage ou réduisez la largeur ; l’export reste bloqué tant que le contrôle détecte ce problème.

### Droites, arcs et rayons

L’outil **Droite** (touche **S**) trace une ligne droite du point sélectionné, ou du dernier, jusqu’au clic ; la longueur et l’écart d’angle avec le tracé s’affichent avant de cliquer. **Maj** la garde exactement dans le prolongement du tracé, au mètre près. Le nouveau point est sélectionné : chaque clic ajoute une droite à la suite.

L’outil **Arc** (touche **R**) trace un arc de cercle tangent au tracé, du point sélectionné jusqu’au clic, avec son rayon et son angle. **Maj** arrondit le rayon à 5 m et l’angle à 5°. Un arc devient un ou plusieurs **points arrondis** (un quart de tour au plus chacun), suivis d’un point à l’arrivée ; jusqu’à trois quarts de tour.

Un point arrondi n’est pas sur la piste : elle arrive en ligne droite depuis le point précédent, tourne sur un arc du rayon choisi, tangent aux deux côtés, puis repart en ligne droite vers le point suivant. Le plan montre ses côtés en pointillés et son rayon. Dans la section **La forme**, **Arrondir ce point** arrondit n’importe quel point (30 m, ou moins s’il n’y a pas la place), puis le **rayon** se règle de 5 à 2 000 m. Si les côtés sont trop courts, le rayon est réduit et un avertissement le signale : écartez les points voisins. Le premier et le dernier point d’une route ne s’arrondissent pas.

La même section règle le **segment suivant** : **Courbe** ou **Droite**, et la longueur d’une droite, de point à point. Une courbe qui rejoint une droite la prolonge sans cassure ; deux droites qui se rejoignent sur un point non arrondi font un angle vif, signalé par un avertissement. Les projets enregistrés avant ces outils gardent exactement la même forme.

### Terrain complet

Le sol est généré automatiquement dès que le tracé comporte au moins deux points. Il remplit l’intérieur des circuits et les espaces entre les portions d’une route ouverte, puis s’étend autour du tracé dans un rectangle. La marge se règle dans **Le terrain → Marge autour du tracé** : **150 m par défaut**, de **50 à 500 m**.

Le terrain suit les altitudes du tracé et se raccorde aux accotements. Son maillage est découpé autour de la chaussée, des vibreurs et du stand afin de ne pas les recouvrir. Les petites différences de hauteur existantes aux extrémités des vibreurs ou du stand sont raccordées progressivement. Au-delà des accotements, le terrain reste d’abord à plat, à la hauteur de leur bord, sur 8 m, puis rejoint en pente douce, sur 40 m, le relief éloigné, interpolé automatiquement à partir des altitudes du tracé. Entre deux passages proches du tracé, il descend de l’un à l’autre sans marche ; la sculpture manuelle du terrain reste une tâche à réaliser.

Le contour en pointillés du plan 2D montre la limite extérieure. L’aperçu 3D affiche le terrain réel. Les exports **Assetto Corsa et OBJ** incluent cette même géométrie ; dans le jeu, elle utilise la surface physique **GRASS**. Au-delà du contour extérieur, il n’y a plus de sol : augmentez la marge pour disposer de plus d’espace.

Pour ajouter le terrain à un circuit déjà installé, ouvrez son projet, exportez un nouveau ZIP et remplacez son dossier dans le jeu après avoir sauvegardé l’ancienne version.

### Stands et grille de départ

Sur un circuit fermé, l’outil **P** ou le bouton **Tracer la voie** de la section **Les stands** pose la voie des stands en deux clics : l’entrée, puis la sortie, sur la rive cliquée. La voie longe la piste derrière un muret en béton, avec un biseau de 40 m à l’entrée et à la sortie. Réglez ensuite le **nombre de voitures** (jusqu’à 24), la largeur de la voie, son côté et la position de l’entrée et de la sortie (un point plus une distance en mètres).

Le nombre de voitures fixe les emplacements de stand, répartis tous les 10 m le long de la voie, et la grille de départ, en quinconce derrière la ligne de départ. La ligne de départ se déplace dans **Le tracé**. Une voie trop courte pour ses voitures, ou trop serrée à l’intérieur d’un virage, bloque l’export ; le bouton **Voir** la montre sur le plan. Sans voie des stands, et sur une route ouverte, le tracé accueille une seule voiture.

Les barrières posées du même côté que la voie sont repoussées derrière elle.

### Largeur variable

La largeur réglée dans **La chaussée** est la **largeur de base**. Pour élargir une ligne droite ou resserrer un passage, utilisez l’outil **L** ou le bouton **Tracer une portion** de la section **Les largeurs** : un premier clic marque le début de la portion, un second sa fin. Sur un circuit, les deux clics retiennent le plus court des deux trajets entre eux. La portion démarre 4 m plus large que la base ; réglez ensuite sa largeur (4 à 24 m), son début et sa fin (un point plus une distance en mètres).

La largeur change progressivement sur 20 m à chaque bout, sans marche. Les deux bords s’écartent de la même façon : l’axe reste au milieu de la chaussée. Vibreurs, accotements, voie des stands, barrières, grille et chronométrage suivent la largeur locale. Le contrôle des virages serrés compare chaque virage à la largeur locale : resserrer une épingle peut donc débloquer l’export.

Une nouvelle portion ne peut pas en chevaucher une autre (maximum **40 portions**). Si un réglage les fait se chevaucher, la dernière de la liste l’emporte et un avertissement le signale. Un clic sur la chaussée avec l’outil de sélection sélectionne la portion qui s’y trouve. L’inversion du sens du tracé garde chaque portion à sa place, et le passage en route ouverte scinde une portion qui traverse le départ.

### Dévers et virages relevés

Pour incliner la chaussée dans un virage, utilisez l’outil **D** ou le bouton **Tracer un dévers** de la section **Les dévers** : un premier clic marque le début, un second la fin. On peut aussi choisir une plage dans la bande de piste (un clic sur le nom d’un virage la cadre) puis **Portion de dévers**. Le dévers démarre à 8°, relevé à l’extérieur du virage ; réglez ensuite son angle (0 à 35°), sa transition, le bord relevé, son début et sa fin.

La chaussée s’incline progressivement sur la longueur de la **transition**, à chaque bout : 60 m par défaut, de 5 à 200 m. Une portion plus courte que deux transitions les raccourcit à sa moitié. Elle pivote autour de son bord bas, qui garde l’altitude du tracé : seul le bord relevé monte, rien ne s’enfonce dans le sol. La pente couvre la chaussée et les vibreurs ; au-delà, accotements, voie des stands, muret, barrières et terrain restent à la hauteur du bord des vibreurs. La grille de départ et les emplacements de stand posés sur la chaussée suivent la pente. La bande de piste montre l’angle le long du tracé, au-dessus de la ligne médiane quand la droite est relevée.

Comme pour les largeurs, un nouveau dévers ne peut pas en chevaucher un autre (maximum **40 portions**) ; si un réglage les fait se chevaucher, le dernier l’emporte et un avertissement le signale. Là où une portion de largeur et un dévers se superposent, un clic sur la chaussée garde le type déjà sélectionné, et un second clic passe à l’autre. L’inversion du sens du tracé change le bord relevé de côté, pour que le même bord reste en haut.

### Barrières et collisions

Les tronçons se posent avec l’outil **B** ou le bouton **Tracer sur le plan** : un premier clic fixe le début sur la rive cliquée, n’importe où sur la piste, un second la fin. L’aperçu suit la piste entre les deux clics. Échap annule le tracé en cours ; les tronçons se règlent ensuite dans **Les barrières** (écartement de 0 à 10 m au-delà du vibreur, début et fin en point plus distance, changement de côté, suppression). Maximum **120 tronçons**.

Les quatre types ont des hauteurs réalistes : glissière 0,78 m, pneus 0,85 m, TecPro 0,85 m, mur en béton 1,1 m. Comme les circuits officiels, chaque tronçon produit un **collider invisible** nommé `1WALL_*` que le jeu utilise pour la collision, plus un décor visible (rail, pneus, blocs rouges et blancs ou mur). Les colliders restent à l’extérieur de la chaussée, y compris dans les virages très serrés.

L’inversion du sens du tracé retourne les tronçons, la suppression d’un point garde les tronçons en place, et le passage en route ouverte scinde les tronçons qui bouclaient.

### Décor

Sur la couche **Décor** (6), choisissez un arbre, un bâtiment, une tribune, un panneau ou un éclairage, puis cliquez sur le plan ou dans l’aperçu 3D : l’objet se pose sur le terrain, face à la partie de la piste la plus proche (Maj : grille de 5 m). Il se sélectionne, se glisse et se règle ensuite dans **Objets de décor** : aspect (feuillu ou conifère, panneau sur pieds ou au sol, éclairage à un ou deux bras), dimensions, orientation, nombre d’arbres d’un bosquet. Les objets restent en place quand le tracé change ; un avertissement signale ceux qui empiètent sur la piste. Maximum **400 objets**.

Bâtiments et tribunes arrêtent les voitures par défaut, grâce à un collider invisible `1WALL_scenery` ; l’interrupteur **Bloque les voitures** l’ajoute ou le retire pour chaque objet. Les éclairages ont des lampes lumineuses et, avec Custom Shaders Patch, de vraies lumières de nuit déclarées dans `extension/ext_config.ini` (à vérifier en jeu).

| Action                                      | Raccourci                           |
| ------------------------------------------- | ----------------------------------- |
| Changer de couche                           | 1 à 6                               |
| Plan / aperçu 3D                            | C                                   |
| Sélection / ajout / déplacement de la vue   | V / A / H                           |
| Tracer une ligne droite / un arc            | S / R                               |
| Tracer une barrière                         | B                                   |
| Tracer la voie des stands                   | P                                   |
| Tracer une portion de largeur               | L                                   |
| Navigation temporaire                       | Espace + glisser, ou bouton central |
| Cadrer le tracé                             | F                                   |
| Grille de 5 m pendant un déplacement        | Maj                                 |
| Annuler / rétablir                          | Ctrl+Z / Ctrl+Maj+Z ou Ctrl+Y       |
| Enregistrer le projet                       | Ctrl+S                              |
| Ajouter ou retirer un point de la sélection | Maj + clic                          |
| Supprimer les points ou objets sélectionnés | Suppr                               |
| Tourner les objets de décor de 15°          | E / Maj+E                           |
| Dupliquer les objets de décor               | Ctrl+D                              |
| Annuler un tracé, puis vider la plage       | Échap                               |

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

Prochaines priorités : **trajectoires IA → dévers**.

- [x] **Terrain complet** : sol continu à l’intérieur et autour du tracé, marge réglable, adaptation au relief, aperçu 2D/3D et export avec collisions.
- [x] **Barrières et murs** : glissières, pneus, TecPro et murs en béton tracés en deux clics, avec colliders invisibles dans Assetto Corsa.
- [x] **Vrais stands** : voie des stands avec entrée, sortie et muret, plusieurs emplacements et une grille de départ (à valider en jeu).
- [x] **Largeur variable** : régler la largeur par portion pour élargir une ligne droite ou resserrer un passage (à valider en jeu).
- [x] **Dévers et virages relevés** : incliner la chaussée dans les courbes.
- [x] **Outils de dessin précis** : ajouter des lignes droites, arcs de cercle et virages à rayon réglable.
- [x] **Décors à placer** : ajouter arbres, bâtiments, tribunes, panneaux et éclairages (collisions et lumières CSP à valider en jeu).
- [ ] **Sculpture du terrain** : créer collines, talus, fossés et dégagements.
- [ ] **Image de fond** : importer un plan ou une vue aérienne et dessiner dessus à l’échelle.
- [ ] **Départ et chronométrage personnalisables** : déplacer les lignes de départ et d’arrivée ainsi que les secteurs.
- [ ] **Trajectoires IA** : permettre aux adversaires de parcourir le circuit et de rejoindre les stands.
- [ ] **Import GPX** : utiliser une trace GPS comme base pour reproduire une route.
- [ ] **Caméra embarquée** : parcourir virtuellement le tracé avant de l’exporter.
- [ ] **Bibliothèque de projets** : gérer plusieurs circuits avec miniatures et versions.
- [ ] **Installation automatique** : envoyer le circuit dans le dossier du jeu depuis le logiciel.
- [ ] **Application Windows `.exe`** : proposer un lancement comme logiciel de bureau.

## Limites actuelles

L’import dans Assetto Corsa a été confirmé par l’utilisateur pour la version précédente. L’ajout du terrain a été testé sur la géométrie et les exports, mais reste à vérifier en jeu. L’export reste expérimental et vise les essais libres en solo ; cela ne valide pas tous les tracés ni toutes les configurations du jeu.

- Voie des stands, grille de départ et portions de largeur encore à vérifier en jeu.
- Pas de trajectoires IA ni de courses avec des adversaires.
- Chronométrage à vérifier, particulièrement sur les routes ouvertes, prévues pour le roulage libre.
- Le terrain reste limité au rectangle visible dans l’éditeur ; posez des barrières aux endroits risqués, sinon une chute reste possible au-delà.
- Les barrières utilisent des colliders simplifiés ; leur blocage de la voiture a été confirmé en jeu.
- Pas de ponts. Les matériaux sont simples ; le décor est en géométrie simplifiée, ses collisions et ses lumières de nuit restent à vérifier en jeu.
- Les intersections et certains virages trop serrés bloquent l’export ; tous les chevauchements de bords ou d’accotements ne sont pas détectés.

## Références

Le format KN5 suit la disposition des champs publiée dans le [code source AcTools de gro-ove](https://github.com/gro-ove/actools/blob/master/AcTools/Kn5File/Kn5Writer.cs). L’encodeur est une implémentation indépendante en JavaScript, sans bibliothèque AcTools embarquée.

Aucune donnée n’est envoyée à un serveur. Roadbuilder est un projet indépendant, non affilié à Kunos Simulazioni.
