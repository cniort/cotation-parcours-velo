# Roadmap — Cotation des parcours vélo
*Développé par Corentin NIORT*

## Vision
Outil de cotation de la difficulté des itinéraires vélo, basé sur la grille officielle France Vélo Tourisme (5 indicateurs), avec affichage cartographique interactif et scoring visuel type Lighthouse.

---

## Légende des statuts
- [x] Fait
- [ ] À faire
- [⏸️] En attente (donnée ou décision manquante)

---

## 1. Données & Scoring

### 1.1 Indicateur 1 — Sécurité (% voies cyclables)
- [x] Lecture du champ `Site` (Site propre / Site partagé) depuis le GeoJSON
- [x] Calcul du % par tranche de 10 km (pondéré par la distance)
- [x] Grille de cotation : +90% → 0 pt, 60-90% → 1 pt, 20-60% → 2 pts, <20% → 3 pts

### 1.2 Indicateur 2 — Provisoire (% de sections provisoires)
- [⏸️] Donnée absente du GeoJSON actuel
- [ ] Récupérer la donnée depuis l'ON3V / RVM (site en maintenance au 16/03/2026)
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

---

## 2. Sources de données

### 2.1 GeoJSON Vélodyssée (VLD.geojson)
- [x] Projection Lambert 93 (EPSG:2154) → reprojection WGS84 via proj4js
- [x] Champs exploités : `Site`, `revetement`, `region`, `departemen`
- [x] Tri spatial des 1699 segments par index par grille (~O(n))
- [x] Correction des noms de territoires (accents, casse)
- [⏸️] Champ `provisoire` : absent, à sourcer depuis ON3V/RVM

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

---

## 3. Fonctionnalités

### 3.1 Vues
- [x] Toggle principal : Étapes / Régions / Départements
- [x] Sous-toggle : Tranches 10 km / Étapes touristiques
- [x] 38 étapes touristiques officielles de la Vélodyssée intégrées
- [x] Scores par territoire (régions et départements) avec donuts et barres de répartition
- [x] Territoires toujours calculés sur les tranches 10 km (cohérence FVT)
- [x] Bandeau informatif fermable précisant la base de calcul

### 3.2 Filtres
- [x] Filtre par catégorie (Je débute / J'ai l'habitude / Aventure)
- [x] Filtre par région (dropdown dynamique)
- [x] Filtre par département (dropdown dynamique)
- [x] KPIs dynamiques selon les filtres (distance, nb étapes, % site propre)
- [x] Synchronisation filtres ↔ carte ↔ sidebar
- [ ] Filtre par score min/max (slider)
- [ ] Filtre par revêtement (lisse / rugueux / meuble)

### 3.3 Comparaison ancienne / nouvelle cotation
- [x] Cotations actuelles scrapées depuis le site officiel (lavelodyssee.com)
- [x] Modale d'audit dédiée avec tableau comparatif complet
- [x] KPIs de synthèse : inchangées / facilitées / durcies
- [x] Lignes colorées selon l'évolution (vert facilitée, rouge durcie)
- [x] Export CSV avec séparateur ; (compatible Excel FR)

### 3.4 Multi-itinéraires
- [x] Modale d'ajout d'itinéraire (nom, URL, GeoJSON, GPX)
- [x] Scraping automatique des étapes et niveaux depuis l'URL
- [x] Sélecteur d'itinéraire dans le header pour basculer entre les itinéraires
- [x] Stockage en mémoire (itineraryDB)
- [ ] Persistance des itinéraires importés (localStorage / IndexedDB)

### 3.5 Carte
- [x] Leaflet avec fond adaptatif dark/light
- [x] Sélecteur de fond de carte : Sobre (CARTO), OSM, CyclOSM, Satellite
- [x] Tronçons colorés par score (vert/orange/rouge)
- [x] Clic étape → atténuation des autres tronçons + zoom
- [x] Clic territoire → focus et highlight du territoire
- [x] Bottom panel avec score total, sous-scores en donuts, KPIs en capsules avec icônes Lucide
- [x] Restauration de l'opacité à la fermeture du panel

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

### 4.2 Donuts Lighthouse
- [x] Donut SVG avec arc de progression coloré
- [x] Score central en gros (font-weight 800)
- [x] Taille 72px dans le sidebar, 100px dans le bottom panel, 64px pour les sous-scores
- [x] Stroke adaptatif selon la taille
- [x] Décimales avec virgule

### 4.3 Cartes d'étape
- [x] Donut + titre + badge catégorie
- [x] Localisation (département · région) avec icône pin
- [x] KPIs en capsules avec icônes Lucide (distance, sécurité, D+, pics)
- [x] Pluriels gérés (étape/étapes, pic/pics)

### 4.4 Bottom Panel
- [x] Score total + sous-scores en donuts (64px, stroke 7)
- [x] Titre + badge catégorie sur la même ligne
- [x] Localisation sous le titre
- [x] Métriques en capsules avec icônes Lucide
- [x] Bouton fermer avec frame et hover
- [x] Limité à l'espace carte (pas sur le sidebar)

### 4.5 Modales
- [x] Modale de cotation (explication de la grille FVT, 5 indicateurs, catégories)
- [x] Modale d'audit de comparaison (tableau + KPIs + export CSV)
- [x] Modale d'ajout d'itinéraire (nom, URL+scraping, GeoJSON, GPX)
- [x] Fermeture par clic fond / X / Escape
- [x] Autofill compatible dark mode

---

## 5. À faire — Prochaines priorités

1. [ ] Persistance des itinéraires importés (IndexedDB)
2. [ ] Donnée "provisoire" depuis ON3V/RVM (indicateur 2)
3. [ ] Export PDF du tableau de classement par étape
4. [ ] Export image de la carte avec les scores
5. [ ] Lien partageable avec filtres en paramètres URL
6. [ ] Filtre par revêtement et par score (slider)
7. [ ] Support GeoPackage (.gpkg) via sql.js
8. [ ] Profil altimétrique dans le bottom panel
