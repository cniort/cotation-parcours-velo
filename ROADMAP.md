# Roadmap — Cotation des parcours vélo
*Développé par Corentin NIORT*

## Vision
Outil de cotation de la difficulté des itinéraires vélo, basé sur la grille officielle France Vélo Tourisme (5 indicateurs), avec affichage cartographique interactif et scoring visuel type Lighthouse.

---

## Légende des statuts
- [x] Fait
- [🔄] En cours / À valider
- [ ] À faire
- [⏸️] En attente (donnée ou décision manquante)

---

## 1. Données & Scoring

### 1.1 Indicateur 1 — Sécurité (% voies cyclables)
- [x] Lecture du champ `Site` (Site propre / Site partagé) depuis le GeoJSON
- [x] Calcul du % par tranche de 10 km (pondéré par la distance)
- [x] Grille de cotation : +90% → 0 pt, 60-90% → 1 pt, 20-60% → 2 pts, <20% → 3 pts

### 1.2 Indicateur 2 — Provisoire (% de sections provisoires)
- [⏸️] Donnée absente du GeoJSON actuel — source identifiée : ON3V de Vélo & Territoires
- [ ] Récupérer la donnée depuis l'ON3V / RVM (site en maintenance, correction prévue prochainement)
- [ ] Intégrer le champ `provisoire` dans le pipeline de scoring
- Grille : 0% → 0 pt, 0,1-20% → 1 pt, 20-50% → 2 pts, >50% → 3 pts

### 1.3 Indicateur 3 — Relief (D+ par tranche de 10 km)
- [x] Fusion GPX (altitude) + GeoJSON (attributs) par index spatial
- [x] Calcul du D+ par tranche de 10 km (score = tranche la plus difficile)
- [x] Grille : 0-100m → 0 pt, 100-200m → 1 pt, 200-400m → 2 pts, >400m → 3 pts
- [x] Aligné sur le fichier Excel FVT de référence

### 1.4 Indicateur 4 — Pics (nombre de pics de pente > 4%)
- [x] Détection des pics : montée continue > 4% de pente ET > 200m de longueur
- [x] Grille : 0-1 → 0 pt, 2-3 → 1 pt, 4-5 → 2 pts, >5 → 3 pts

### 1.5 Indicateur 5 — Pente (% de pente des pics)
- [x] Calcul du % de pente max par pic
- [x] Score sommé par pic : 4-8% → 0,25 pt, >8% → 0,5 pt (non plafonné)
- [x] Aligné sur le fichier Excel FVT (ex : Saint-Jean-de-Luz → Hendaye = 1,0 pt)

### 1.6 Score total & Catégories
- [x] Somme des 5 indicateurs
- [x] 0-2 pts → "Je débute" (+ mention "Famille" si sécurité = 0 pt)
- [x] 3-6 pts → "J'ai l'habitude"
- [x] 7+ pts → "Aventure"
- [x] Décimales affichées avec virgule (norme française)
- [🔄] Ambiguïté des bornes à clarifier avec FVT (chevauchement 2 pts et 6 pts entre catégories)

---

## 2. Sources de données

### 2.1 GeoJSON Vélodyssée (VLD.geojson)
- [x] Projection Lambert 93 (EPSG:2154) → reprojection WGS84 via proj4js
- [x] Champs exploités : `Site`, `revetement`, `region`, `departemen`
- [x] Tri spatial des 1699 segments par index par grille (~O(n))
- [x] Correction des noms de territoires (accents, casse)
- [x] Revêtement disponible : Lisse (73%), Rugueux (20%), Meuble (4%), Non renseigné (<1%)
- [⏸️] Champ `provisoire` : absent, à sourcer depuis ON3V/RVM (correction prévue)

### 2.2 GPX avec altitude (la-velodyssee.gpx)
- [x] 76 389 points avec altitude chargés
- [x] Fusion GPX + GeoJSON par index spatial (grid ~2 km)
- [x] Attribution des propriétés (site, revêtement) à chaque point GPX par proximité

### 2.3 Scraping des sites d'itinéraires
- [x] Scraping via proxy CORS (allorigins.win)
- [x] Parsing HTML des sites FVT/Drupal (article.etape, div.niveau-difficulte)
- [x] Détection des niveaux par couleur inline CSS et par texte
- [x] Support des variantes : "Ça grimpe", "Je me dépasse", "Sportif" → aventure
- [x] Pré-remplissage du nom de l'itinéraire depuis le <h1>

### 2.4 ON3V / RVM
- [⏸️] Site en maintenance — donnée "provisoire" non disponible
- [ ] Intégration prévue dès que l'ON3V sera de nouveau accessible

### 2.5 Référentiel national DGE 2016
- [x] Document analysé et comparé avec la grille FVT V3
- [x] Différences majeures identifiées : système d'étoiles vs points, 4 vs 3 niveaux, revêtement inclus, distance comme critère, trafic routier
- [🔄] À discuter : intégration du revêtement et du trafic routier dans le scoring

---

## 3. Fonctionnalités

### 3.1 Vues
- [x] Toggle principal : Étapes / Régions / Départements
- [x] Sous-toggle global : Tranches 10 km / Étapes touristiques (visible sur toutes les vues)
- [x] 38 étapes touristiques officielles de la Vélodyssée intégrées
- [x] Scores par territoire (régions et départements) avec donuts et barres de répartition
- [x] Territoires calculés dynamiquement selon le toggle actif (10 km ou touristique)
- [x] Bandeau informatif fermable s'adaptant au mode de calcul actif
- [x] Clic territoire → zoom + highlight + bottom panel avec profil altimétrique et score moyen

### 3.2 Bottom panel territoire
- [x] Stage agrégé construit à partir des étapes du territoire (coordonnées concaténées)
- [x] Score moyen calculé depuis les scores individuels des étapes (pas de recalcul brut)
- [x] Profil altimétrique complet du territoire
- [x] Sous-scores moyennés avec donuts cliquables
- [x] Navigation prev/next entre territoires
- [x] Rafraîchissement automatique du bottom panel quand on change le toggle 10 km / touristique

### 3.3 Filtres
- [x] Filtre par catégorie (Je débute / J'ai l'habitude / Aventure)
- [x] Filtre par région (dropdown dynamique)
- [x] Filtre par département (dropdown dynamique)
- [x] KPIs dynamiques selon les filtres (distance, nb étapes, % site propre)
- [x] Synchronisation filtres ↔ carte ↔ sidebar
- [ ] Filtre par score min/max (slider)
- [ ] Filtre par revêtement (lisse / rugueux / meuble)

### 3.4 Comparaison ancienne / nouvelle cotation
- [x] Cotations actuelles scrapées depuis le site officiel (lavelodyssee.com)
- [x] Modale d'audit dédiée avec tableau comparatif complet
- [x] KPIs de synthèse : inchangées / facilitées / durcies
- [x] Lignes colorées selon l'évolution (vert facilitée, rouge durcie)
- [x] Export CSV avec séparateur ; (compatible Excel FR)

### 3.5 Multi-itinéraires
- [x] Modale d'ajout d'itinéraire (nom, URL, GeoJSON, GPX)
- [x] Scraping automatique des étapes et niveaux depuis l'URL
- [x] Sélecteur d'itinéraire dans le header pour basculer
- [x] Stockage en mémoire (itineraryDB)
- [ ] Persistance des itinéraires importés (localStorage / IndexedDB)

### 3.6 Carte
- [x] Leaflet avec fond adaptatif dark/light
- [x] Sélecteur de fond de carte : Sobre (CARTO), OSM, CyclOSM, Satellite
- [x] Tronçons colorés par score (vert/orange/rouge)
- [x] Clic étape → atténuation des autres tronçons (25%) + zoom
- [x] Clic territoire → focus et highlight du territoire (25%)
- [x] Restauration de l'opacité à la fermeture du panel
- [⏸️] Fond de carte français : CARTO raster ne supporte pas `lang=fr`, nécessiterait migration vers tuiles vectorielles (MapLibre GL JS)

### 3.7 Profil altimétrique
- [x] Profil altimétrique interactif (canvas) dans le bottom panel
- [x] Tooltip au survol (altitude + distance)
- [x] Donuts de sous-scores cliquables pour filtrer l'affichage du profil
- [x] Highlight des pics (orange) au clic sur "Pics"
- [x] Highlight des pentes critiques (rouge) au clic sur "Pente"
- [x] Coloration par tranche de 10 km au clic sur "Relief"
- [x] Seuil de visualisation Relief : 10 m de D+ continu minimum (filtre le bruit GPS)
- [x] Profil altimétrique complet pour les territoires (coordonnées agrégées)

### 3.8 Modale Points de discussion
- [x] Bouton "Discussion" dans le header (orange) pour accès rapide
- [x] 11 sujets méthodologiques organisés en 4 catégories
- [x] Section 1 : Grille de cotation (sécurité, relief, provisoire)
- [x] Section 2 : Relief/Pics/Pente — définitions, seuils, redondance (sujet fusionné)
- [x] Section 3 : Découpage et catégorisation (tranches, bornes, agrégation territoires)
- [x] Section 4 : Données et sources (revêtement, altitude GPS)
- [x] Chaque sujet : tag coloré, paramétrage actuel, question(s) ouverte(s)

---

## 4. Interface & UX

### 4.1 Design
- [x] Palette Phototech (dark: #0f0f14, light: #fcfcfd, accent: #6366f1)
- [x] Couleurs de statut : success #22c55e, warning #f59e0b, danger #ef4444
- [x] Light mode tons froids alignés indigo
- [x] Mode Light / Dark avec toggle icône (soleil/lune) dans le header
- [x] Fond de carte synchronisé avec le thème
- [x] Choix persisté dans localStorage
- [x] Scrollbar adaptée au thème
- [x] Font Inter, sans glow, sans gradient, sobre
- [x] Pluriels gérés (étape/étapes, pic/pics)
- [x] Décimales avec virgule partout

### 4.2 Donuts Lighthouse
- [x] Donut SVG avec arc de progression coloré
- [x] Score central en gros (font-weight 800)
- [x] Taille 72px dans le sidebar, 60px pour le donut principal bottom panel, 48px pour les sous-scores
- [x] Stroke et typo adaptatifs selon la taille

### 4.3 Cartes d'étape (sidebar)
- [x] Donut + titre + badge catégorie
- [x] Localisation (département · région) avec icône pin Lucide
- [x] KPIs en capsules avec icônes Lucide (distance, sécurité, D+, pics)

### 4.4 Cartes territoire (sidebar)
- [x] Donut 72px + KPIs en capsules avec icônes Lucide
- [x] Barres de répartition proportionnelles avec % affiché
- [x] Cliquables → zoom + bottom panel avec score moyen et profil altimétrique

### 4.5 Bottom Panel — détail d'une étape / territoire
- [x] Layout C retenu : Score+titre en haut-gauche, sous-scores bas-gauche, profil droite
- [x] Titre limité à 2 lignes avec ellipsis, colonne gauche élargie (340px max)
- [x] Sous-scores : donuts 48px, typo et trait épaissis, labels lisibles
- [x] Profil altimétrique adaptatif (flex: 1, min-height 150px)
- [x] Navigation prev/next (étapes et territoires)
- [x] Bouton fermer positionné au-dessus du panel
- [🔄] Responsive à valider sur différentes tailles d'écran

### 4.6 Modales
- [x] Modale de cotation (explication de la grille FVT, 5 indicateurs, catégories)
- [x] Modale d'audit de comparaison (tableau + KPIs + export CSV)
- [x] Modale d'ajout d'itinéraire (nom, URL+scraping, GeoJSON, GPX)
- [x] Modale Points de discussion (11 sujets, 4 catégories)
- [x] Fermeture par clic fond / X / Escape
- [x] Autofill compatible dark mode
- [x] Zones d'upload alignées avec descriptions vulgarisées

### 4.7 Déploiement
- [x] GitHub Pages activé sur https://cniort.github.io/cotation-parcours-velo/
- [x] Données Vélodyssée incluses (GeoJSON + GPX)
- [x] Redéploiement automatique à chaque push sur main
- [x] Projet renommé "Cotation des parcours vélo" (local + remote cohérents)

---

## 5. À faire — Prochaines priorités

### 5.1 En cours / À valider
1. [🔄] Valider le responsive du bottom panel (titres longs, sous-scores, différentes résolutions)
2. [🔄] Clarifier les bornes de catégories avec FVT (ambiguïté 2 pts et 6 pts)
3. [🔄] Discuter les 11 sujets méthodologiques avec le collectif partenaires

### 5.2 Données à intégrer
- [ ] Donnée "provisoire" depuis ON3V/RVM dès que le site est de nouveau accessible
- [ ] Évaluer l'intégration du revêtement comme indicateur (données disponibles dans le GeoJSON)
- [ ] Explorer les données de trafic routier (CEREMA / data.gouv.fr) pour affiner le score sécurité

### 5.3 Agrégation territoires
- [ ] Implémenter le double affichage (moyenne + max) si validé par le collectif
- [ ] Pondération par distance (optionnel, à discuter)

### 5.4 Carte
- [ ] Évaluer la migration vers MapLibre GL JS pour tuiles vectorielles (fond de carte français)
- [ ] Marqueurs ponctuels sur la carte (pics, changements de voie)
- [ ] Coloration continue du tracé (par pente ou par type de voie)

### 5.5 Mode plein écran
- [ ] Bouton toggle pour masquer/afficher le panneau latéral de droite
- [ ] En mode plein écran : le bandeau détail s'étend sur toute la largeur de la carte
- [ ] Adapter le profil altimétrique à la nouvelle largeur/hauteur selon le mode

### 5.6 Exports & partage
- [ ] Export PDF du tableau de classement par étape
- [ ] Export image de la carte avec les scores
- [ ] Lien partageable avec filtres en paramètres URL

### 5.7 Persistance
- [ ] Persistance des itinéraires importés (IndexedDB)
- [ ] Filtre par revêtement et par score (slider)
