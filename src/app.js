/**
 * Application principale
 */

let currentStages = null;
let currentScores = null;
let allStageItems = [];
let sortedFeaturesCache = null;
let currentView = '10km'; // '10km' ou 'touristique'

// ── Base de données des itinéraires ──
const itineraryDB = {}; // clé → { name, sortedFeatures, gpxCoords, scrapedStages }
let currentItineraryKey = null;

/** Formate un nombre avec virgule comme séparateur décimal */
function fmt(n) {
  return String(Math.round(n * 100) / 100).replace('.', ',');
}

// ── Étapes touristiques officielles de la Vélodyssée ──
// currentLevel: cotation actuelle publiée sur lavelodyssee.com (mars 2026)
// 'debute' = vert, 'habitude' = orange, 'aventure' = rouge
const ETAPES_TOURISTIQUES = [
  { name: 'Roscoff → Morlaix', distance: 30.21, currentLevel: 'habitude' },
  { name: 'Morlaix → Carhaix', distance: 48.20, currentLevel: 'debute' },
  { name: 'Carhaix → Rostrenen', distance: 32.85, currentLevel: 'debute' },
  { name: 'Rostrenen → Mur-de-Bretagne', distance: 30.44, currentLevel: 'habitude' },
  { name: 'Mur-de-Bretagne → Pontivy', distance: 23.04, currentLevel: 'habitude' },
  { name: 'Pontivy → Josselin', distance: 48.15, currentLevel: 'debute' },
  { name: 'Josselin → Peillac', distance: 45.90, currentLevel: 'debute' },
  { name: 'Peillac → Redon', distance: 17.32, currentLevel: 'debute' },
  { name: 'Redon → Blain', distance: 44.86, currentLevel: 'debute' },
  { name: 'Blain → Nort-sur-Erdre', distance: 23.58, currentLevel: 'debute' },
  { name: 'Nort-sur-Erdre → Nantes', distance: 34.82, currentLevel: 'habitude' },
  { name: 'Nantes → Le Pellerin', distance: 23.95, currentLevel: 'habitude' },
  { name: 'Le Pellerin → St-Brevin-les-Pins', distance: 37.37, currentLevel: 'debute' },
  { name: 'St-Brevin-les-Pins → Pornic', distance: 39.88, currentLevel: 'habitude' },
  { name: 'Pornic → Bouin', distance: 33.85, currentLevel: 'habitude' },
  { name: 'Bouin → Fromentine', distance: 34.25, currentLevel: 'habitude' },
  { name: 'Fromentine → St-Gilles-Croix-de-Vie', distance: 35.77, currentLevel: 'debute' },
  { name: 'St-Gilles-Croix-de-Vie → Les Sables-d\'Olonne', distance: 37.22, currentLevel: 'habitude' },
  { name: 'Les Sables-d\'Olonne → La Tranche-sur-Mer', distance: 44.10, currentLevel: 'debute' },
  { name: 'La Tranche-sur-Mer → Marans', distance: 46.27, currentLevel: 'habitude' },
  { name: 'Marans → La Rochelle', distance: 25.38, currentLevel: 'habitude' },
  { name: 'La Rochelle → Rochefort', distance: 50.35, currentLevel: 'habitude' },
  { name: 'Rochefort → Marennes', distance: 37.76, currentLevel: 'habitude' },
  { name: 'Marennes → Royan', distance: 45.42, currentLevel: 'debute' },
  { name: 'Royan → Montalivet-les-Bains', distance: 30.02, currentLevel: 'debute' },
  { name: 'Montalivet → Hourtin-Plage', distance: 20.03, currentLevel: 'debute' },
  { name: 'Hourtin-Plage → Lacanau-Océan', distance: 33.80, currentLevel: 'aventure' },
  { name: 'Lacanau-Océan → Lège-Cap-Ferret', distance: 36.82, currentLevel: 'debute' },
  { name: 'Lège-Cap-Ferret → Arcachon', distance: 42.21, currentLevel: 'habitude' },
  { name: 'Arcachon → Biscarrosse-Plage', distance: 25.81, currentLevel: 'debute' },
  { name: 'Biscarrosse → Parentis-en-Born', distance: 25.56, currentLevel: 'habitude' },
  { name: 'Parentis-en-Born → Mimizan-Plage', distance: 31.13, currentLevel: 'debute' },
  { name: 'Mimizan-Plage → Léon', distance: 47.09, currentLevel: 'habitude' },
  { name: 'Léon → Capbreton', distance: 33.17, currentLevel: 'debute' },
  { name: 'Capbreton → Bayonne', distance: 28.98, currentLevel: 'habitude' },
  { name: 'Bayonne → Biarritz', distance: 16.28, currentLevel: 'habitude' },
  { name: 'Biarritz → Saint-Jean-de-Luz', distance: 14.24, currentLevel: 'debute' },
  { name: 'Saint-Jean-de-Luz → Hendaye', distance: 20.81, currentLevel: 'aventure' }
];

const LEVEL_LABELS = {
  debute: 'Je débute',
  habitude: "J'ai l'habitude",
  aventure: 'Aventure'
};
const LEVEL_COLORS = {
  debute: '#22c55e',
  habitude: '#f59e0b',
  aventure: '#ef4444'
};
const LEVEL_ORDER = { debute: 0, habitude: 1, aventure: 2 };

let comparisonMode = false;

// ── Modale Légende ──
function openLegendModal() {
  document.getElementById('legend-modal').classList.add('visible');
}
function closeLegendModal(event) {
  if (!event || event.target === event.currentTarget) {
    document.getElementById('legend-modal').classList.remove('visible');
  }
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeLegendModal();
    closeComparisonModal();
    closeImportModal();
  }
});

// ── Modale Import ──

let importFiles = { geojson: null, gpx: null };
let scrapedStages = null;

function openImportModal() {
  document.getElementById('import-modal').classList.add('visible');
}
function closeImportModal(event) {
  if (!event || event.target === event.currentTarget) {
    document.getElementById('import-modal').classList.remove('visible');
  }
}

function handleImportFile(input, type) {
  const file = input.files[0];
  if (!file) return;
  importFiles[type] = file;

  const drop = document.getElementById(`drop-${type}`);
  drop.classList.add('file-loaded');
  drop.querySelector('.file-drop-text').textContent = file.name;
}

async function scrapeItinerary() {
  const url = document.getElementById('import-url').value.trim();
  if (!url) return;

  const statusEl = document.getElementById('scrape-status');
  const previewEl = document.getElementById('scrape-preview');
  const resultEl = document.getElementById('scrape-result');

  resultEl.classList.remove('hidden');
  statusEl.textContent = 'Récupération en cours...';
  statusEl.style.color = 'var(--accent)';
  previewEl.innerHTML = '';

  try {
    // Utiliser un proxy CORS
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    const resp = await fetch(proxyUrl);
    if (!resp.ok) throw new Error('Erreur réseau');

    const html = await resp.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Chercher les étapes avec la structure FVT (article.etape)
    const articles = doc.querySelectorAll('article.etape');
    const stages = [];

    if (articles.length > 0) {
      // Structure FVT détectée
      articles.forEach(article => {
        const nameEl = article.querySelector('h2 a');
        const levelEl = article.querySelector('.niveau-difficulte span');
        const distEl = article.querySelector('.distance span');

        const name = nameEl ? nameEl.textContent.trim().replace(/&gt;/g, '→').replace(/>/g, '→') : '';
        const levelText = levelEl ? levelEl.textContent.trim().replace(/\s+/g, ' ') : '';
        const levelStyle = levelEl ? (levelEl.getAttribute('style') || '') : '';
        const distance = distEl ? distEl.textContent.trim() : '';

        // Déterminer le niveau par la couleur inline
        let level = 'debute';
        if (levelStyle.includes('#3498DB') || levelStyle.includes('#3498db')) level = 'habitude';
        else if (levelStyle.includes('#E74C3C') || levelStyle.includes('#e74c3c')) level = 'aventure';
        else if (levelStyle.includes('#52BE80') || levelStyle.includes('#52be80')) level = 'debute';

        // Ou par le texte
        const lt = levelText.toLowerCase();
        if (lt.includes('habitude')) level = 'habitude';
        else if (lt.includes('dépasse') || lt.includes('défi') || lt.includes('grimpe') || lt.includes('aventure') || lt.includes('sportif')) level = 'aventure';

        if (name) {
          stages.push({ name, level, levelText, distance });
        }
      });
    }

    if (stages.length === 0) {
      statusEl.textContent = 'Aucune étape trouvée sur cette page. Vérifiez l\'URL.';
      statusEl.style.color = 'var(--danger)';
      return;
    }

    scrapedStages = stages;
    statusEl.innerHTML = `<span style="color:var(--success)">${stages.length} étapes récupérées</span>`;

    // Aperçu
    let previewHTML = '';
    stages.forEach((s, i) => {
      const bgColor = s.level === 'debute' ? '#22c55e' : s.level === 'habitude' ? '#f59e0b' : '#ef4444';
      previewHTML += `
        <div class="scrape-stage">
          <span class="scrape-stage-name">${i + 1}. ${s.name}</span>
          <span class="scrape-stage-level" style="background:${bgColor}">${s.levelText || LEVEL_LABELS[s.level]}</span>
        </div>
      `;
    });
    previewEl.innerHTML = previewHTML;

    // Pré-remplir le nom si vide
    const nameInput = document.getElementById('import-name');
    if (!nameInput.value) {
      const titleEl = doc.querySelector('h1') || doc.querySelector('title');
      if (titleEl) nameInput.value = titleEl.textContent.trim().split('|')[0].trim();
    }

  } catch (e) {
    statusEl.textContent = 'Impossible de récupérer la page. Vérifiez l\'URL ou réessayez.';
    statusEl.style.color = 'var(--danger)';
    console.error('Scraping error:', e);
  }
}

function launchAnalysis() {
  if (!importFiles.geojson) {
    alert('Veuillez sélectionner un fichier GeoJSON.');
    return;
  }

  const nameInput = document.getElementById('import-name').value.trim() || 'Itinéraire importé';
  const key = nameInput.toLowerCase().replace(/[^a-z0-9]/g, '-');

  const reader = new FileReader();
  reader.onload = (e) => {
    const geojson = JSON.parse(e.target.result);

    const finalize = () => {
      processGeoJSON(geojson);

      // Stocker dans la DB après traitement
      itineraryDB[key] = {
        name: nameInput,
        sortedFeatures: sortedFeaturesCache,
        gpxCoords: gpxCoordsCache,
        scrapedStages: scrapedStages
      };
      currentItineraryKey = key;
      updateItinerarySelector();

      document.getElementById('route-name').textContent = nameInput;
      closeImportModal();
    };

    if (importFiles.gpx) {
      const gpxReader = new FileReader();
      gpxReader.onload = (e2) => {
        const gpxData = parseGPX(e2.target.result);
        gpxCoordsCache = [];
        gpxData.features.forEach(f => gpxCoordsCache.push(...f.geometry.coordinates));
        finalize();
      };
      gpxReader.readAsText(importFiles.gpx);
    } else {
      gpxCoordsCache = null;
      finalize();
    }
  };
  reader.readAsText(importFiles.geojson);
}

function updateItinerarySelector() {
  const select = document.getElementById('itinerary-selector');
  // Garder les options existantes et ajouter les nouvelles
  const existing = new Set([...select.options].map(o => o.value));
  for (const [key, data] of Object.entries(itineraryDB)) {
    if (!existing.has(key)) {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = data.name;
      select.appendChild(opt);
    }
  }
  select.value = currentItineraryKey;
}

function switchItinerary(key) {
  const data = itineraryDB[key];

  if (!data) {
    // Si la clé est velodyssee et pas encore dans la DB, recharger les fichiers locaux
    if (key === 'velodyssee') {
      currentItineraryKey = 'velodyssee';
      tryLoadLocalFile();
    }
    return;
  }

  sortedFeaturesCache = data.sortedFeatures;
  gpxCoordsCache = data.gpxCoords;
  currentItineraryKey = key;

  // Restaurer l'opacité de la carte
  closeBottomPanel();

  displayRoute({
    type: 'FeatureCollection',
    features: sortedFeaturesCache.map(f => ({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: f.coordinates },
      properties: {}
    }))
  });
  rebuildView();
  document.getElementById('route-name').textContent = data.name;
}

document.addEventListener('DOMContentLoaded', () => {
  initMap();
  loadSavedTheme();
  initFilters();
  initViewToggle();
  tryLoadLocalFile();
});

// ── Toggles ──

let currentPanel = 'etapes'; // 'etapes', 'regions', 'departements'

function initViewToggle() {
  // Toggle principal
  document.querySelectorAll('.main-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.main-toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentPanel = btn.dataset.panel;
      updatePanelVisibility();
    });
  });

  // Sous-toggle étapes
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentView = btn.dataset.view;

      const compBar = document.getElementById('comparison-bar');
      if (currentView === 'touristique') {
        compBar.classList.remove('hidden');
      } else {
        compBar.classList.add('hidden');
      }

      if (sortedFeaturesCache) rebuildView();
    });
  });
}

function updatePanelVisibility() {
  const subToggle = document.getElementById('sub-toggle');
  const compBar = document.getElementById('comparison-bar');
  const filters = document.getElementById('filters');
  const stagesList = document.getElementById('stages-list');
  const territoryList = document.getElementById('territory-list');

  if (currentPanel === 'etapes') {
    subToggle.style.display = 'flex';
    filters.style.display = '';
    stagesList.style.display = '';
    territoryList.style.display = 'none';
    compBar.classList.toggle('hidden', currentView !== 'touristique');
  } else {
    subToggle.style.display = 'none';
    filters.style.display = 'none';
    compBar.classList.add('hidden');
    stagesList.style.display = 'none';
    territoryList.style.display = '';
    buildTerritoryScores();
  }
}

// ── Comparaison ──

// toggleComparison n'est plus utilisé — la comparaison s'ouvre via openComparisonModal()

function openComparisonModal() {
  if (!currentStages || !currentScores) return;

  const total = Math.min(currentStages.features.length, ETAPES_TOURISTIQUES.length);
  let unchanged = 0, upgraded = 0, downgraded = 0;

  for (let i = 0; i < total; i++) {
    const comp = getComparisonData(i, currentScores[i].category.key);
    if (!comp) continue;
    if (comp.change === 'unchanged') unchanged++;
    else if (comp.change === 'upgraded') upgraded++;
    else downgraded++;
  }

  let tableRows = '';
  for (let i = 0; i < total; i++) {
    const stage = currentStages.features[i];
    if (!stage) break;
    const score = currentScores[i];
    const comp = getComparisonData(i, score.category.key);
    if (!comp) continue;
    const props = stage.properties;

    const changeClass = comp.change;
    const changeLabel = comp.change === 'unchanged' ? 'Inchangée'
      : comp.change === 'upgraded' ? 'Facilitée' : 'Durcie';

    tableRows += `
      <tr class="audit-row audit-row-${changeClass}">
        <td class="audit-cell-name">${props.name}</td>
        <td class="audit-cell-dist">${fmt(props.distance)} km</td>
        <td><span class="comp-badge" style="background:${comp.oldColor}">${comp.oldLabel}</span></td>
        <td class="audit-cell-arrow">→</td>
        <td><span class="comp-badge" style="background:${comp.newColor}">${comp.newLabel}</span></td>
        <td><span class="comp-change-tag ${changeClass}">${changeLabel}</span></td>
      </tr>
    `;
  }

  const modal = document.getElementById('comparison-modal');
  modal.querySelector('.audit-body').innerHTML = tableRows;
  modal.querySelector('.audit-unchanged').textContent = unchanged;
  modal.querySelector('.audit-upgraded').textContent = upgraded;
  modal.querySelector('.audit-downgraded').textContent = downgraded;
  modal.querySelector('.audit-total').textContent = total;
  modal.classList.add('visible');
}

function closeComparisonModal(event) {
  if (!event || event.target === event.currentTarget) {
    document.getElementById('comparison-modal').classList.remove('visible');
  }
}

function getComparisonData(stageIdx, newCategoryKey) {
  const etape = ETAPES_TOURISTIQUES[stageIdx];
  if (!etape || !etape.currentLevel) return null;

  const oldKey = etape.currentLevel;
  const newKey = newCategoryKey;
  const oldOrder = LEVEL_ORDER[oldKey];
  const newOrder = LEVEL_ORDER[newKey];

  let change = 'unchanged';
  if (newOrder < oldOrder) change = 'upgraded';   // facilité (score plus bas)
  else if (newOrder > oldOrder) change = 'downgraded'; // durci

  return {
    oldKey,
    newKey,
    oldLabel: LEVEL_LABELS[oldKey],
    newLabel: LEVEL_LABELS[newKey],
    oldColor: LEVEL_COLORS[oldKey],
    newColor: LEVEL_COLORS[newKey],
    change
  };
}

function updateComparisonStats(scores) {
  // Stats calculées directement dans openComparisonModal
}

function exportComparison() {
  if (!currentStages || !currentScores) return;

  const sep = ';';
  let csv = ['Étape', 'Distance (km)', '% Site propre', 'Cotation actuelle', 'Nouvelle cotation', 'Évolution'].join(sep) + '\n';

  currentStages.features.forEach((stage, i) => {
    const score = currentScores[i];
    const comp = getComparisonData(i, score.category.key);
    const props = stage.properties;

    const changeLabel = comp
      ? (comp.change === 'unchanged' ? 'Inchangée' : comp.change === 'upgraded' ? 'Facilitée' : 'Durcie')
      : '—';

    csv += [
      `"${props.name}"`,
      fmt(props.distance),
      props.pctSitePropre + '%',
      comp ? comp.oldLabel : '—',
      score.category.name,
      changeLabel
    ].join(sep) + '\n';
  });

  // Ligne de synthèse
  const unchanged = currentScores.filter((s, i) => getComparisonData(i, s.category.key)?.change === 'unchanged').length;
  const upgraded = currentScores.filter((s, i) => getComparisonData(i, s.category.key)?.change === 'upgraded').length;
  const downgraded = currentScores.filter((s, i) => getComparisonData(i, s.category.key)?.change === 'downgraded').length;
  csv += '\n';
  csv += ['Synthèse', '', '', '', '', ''].join(sep) + '\n';
  csv += ['Inchangées', unchanged, '', '', '', ''].join(sep) + '\n';
  csv += ['Facilitées', upgraded, '', '', '', ''].join(sep) + '\n';
  csv += ['Durcies', downgraded, '', '', '', ''].join(sep) + '\n';

  // Télécharger
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'comparaison_cotation_velodyssee.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function rebuildView() {
  let stages;

  if (currentView === 'touristique') {
    stages = splitIntoTouristicStages(sortedFeaturesCache, ETAPES_TOURISTIQUES);
  } else {
    stages = splitIntoStages(sortedFeaturesCache, 10);
  }

  currentStages = stages;
  const scores = stages.features.map(s => computeStageScore(s));
  currentScores = scores;

  displayStages(stages, scores);
  populateFilterDropdowns(stages, scores);
  updateSidebar(stages, scores);

  if (comparisonMode && currentView === 'touristique') {
    updateComparisonStats(scores);
  }

  applyFilters();
}

function handleFileImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  document.getElementById('file-name').textContent = file.name;

  const reader = new FileReader();
  reader.onload = (e) => {
    const content = e.target.result;
    if (file.name.endsWith('.gpx')) {
      processRoute(parseGPX(content));
    } else if (file.name.endsWith('.geojson') || file.name.endsWith('.json')) {
      processGeoJSON(JSON.parse(content));
    }
  };
  reader.readAsText(file);
}

let gpxCoordsCache = null; // Coordonnées GPX avec altitude

async function tryLoadLocalFile() {
  // Tenter de charger le GPX (pour l'altitude)
  for (const gpxFile of ['la-velodyssee.gpx', 'trace.gpx', 'itineraire.gpx']) {
    try {
      const resp = await fetch(gpxFile);
      if (resp.ok) {
        console.log(`GPX trouvé : ${gpxFile}`);
        const gpxText = await resp.text();
        const gpxData = parseGPX(gpxText);
        gpxCoordsCache = [];
        gpxData.features.forEach(f => {
          gpxCoordsCache.push(...f.geometry.coordinates);
        });
        console.log(`${gpxCoordsCache.length} points GPX avec altitude chargés`);
        break;
      }
    } catch (e) { /* continue */ }
  }

  // Charger le GeoJSON
  for (const filename of ['VLD.geojson', 'trace.geojson', 'itineraire.geojson']) {
    try {
      const resp = await fetch(filename);
      if (resp.ok) {
        console.log(`GeoJSON trouvé : ${filename}`);
        currentItineraryKey = 'velodyssee';
        processGeoJSON(await resp.json());
        return;
      }
    } catch (e) { /* continue */ }
  }
}

// ── Filtres ──

function initFilters() {
  document.querySelectorAll('#filter-category .chip').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#filter-category .chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyFilters();
    });
  });
  document.getElementById('filter-region').addEventListener('change', applyFilters);
  document.getElementById('filter-dept').addEventListener('change', applyFilters);
}

function populateFilterDropdowns(stages, scores) {
  const regions = new Set();
  const depts = new Set();

  stages.features.forEach(s => {
    if (s.properties.region) regions.add(s.properties.region);
    if (s.properties.departement) depts.add(s.properties.departement);
  });

  const regionSelect = document.getElementById('filter-region');
  regionSelect.innerHTML = '<option value="all">Toutes les régions</option>';
  [...regions].sort().forEach(r => {
    regionSelect.innerHTML += `<option value="${r}">${r}</option>`;
  });

  const deptSelect = document.getElementById('filter-dept');
  deptSelect.innerHTML = '<option value="all">Tous les départements</option>';
  [...depts].sort().forEach(d => {
    deptSelect.innerHTML += `<option value="${d}">${d}</option>`;
  });
}

function applyFilters() {
  const catFilter = document.querySelector('#filter-category .chip.active')?.dataset.value || 'all';
  const regionFilter = document.getElementById('filter-region').value;
  const deptFilter = document.getElementById('filter-dept').value;

  let visibleCount = 0;
  let filteredDistance = 0;
  let filteredPropre = 0;

  allStageItems.forEach(item => {
    const props = item.stage.properties;
    const catKey = item.score.category.key;

    let visible = true;
    if (catFilter !== 'all' && catKey !== catFilter) visible = false;
    if (regionFilter !== 'all' && props.region !== regionFilter) visible = false;
    if (deptFilter !== 'all' && props.departement !== deptFilter) visible = false;

    item.li.style.display = visible ? '' : 'none';
    if (visible) {
      visibleCount++;
      filteredDistance += props.distance;
      filteredPropre += props.distance * props.pctSitePropre / 100;
    }
  });

  document.getElementById('filter-result-count').textContent = visibleCount;

  // Mettre à jour les KPIs selon le filtre
  const isFiltered = catFilter !== 'all' || regionFilter !== 'all' || deptFilter !== 'all';
  if (isFiltered && visibleCount > 0) {
    document.getElementById('total-distance').textContent = fmt(filteredDistance) + ' km';
    document.getElementById('num-stages').textContent = visibleCount;
    document.getElementById('pct-propre').textContent = Math.round((filteredPropre / filteredDistance) * 100) + '%';
  } else if (currentStages) {
    document.getElementById('total-distance').textContent = fmt(currentStages.properties.totalDistance) + ' km';
    document.getElementById('num-stages').textContent = currentStages.properties.totalStages;
    let totalDist = 0, totalDistPropre = 0;
    currentStages.features.forEach(s => {
      totalDist += s.properties.distance;
      totalDistPropre += s.properties.distance * s.properties.pctSitePropre / 100;
    });
    document.getElementById('pct-propre').textContent = (totalDist > 0 ? Math.round((totalDistPropre / totalDist) * 100) : 0) + '%';
  }

  updateMapFilter(catFilter, regionFilter, deptFilter);
}

// ── Correction des noms de territoires ──

const TERRITORY_NAMES = {
  'FINISTERE': 'Finistère',
  "COTES-D'ARMOR": "Côtes-d'Armor",
  'MORBIHAN': 'Morbihan',
  'ILLE-ET-VILAINE': 'Ille-et-Vilaine',
  'LOIRE-ATLANTIQUE': 'Loire-Atlantique',
  'VENDEE': 'Vendée',
  'CHARENTE-MARITIME': 'Charente-Maritime',
  'GIRONDE': 'Gironde',
  'LANDES': 'Landes',
  'PYRENEES-ATLANTIQUES': 'Pyrénées-Atlantiques',
  'BRETAGNE': 'Bretagne',
  'PAYS DE LA LOIRE': 'Pays de la Loire',
  'NOUVELLE-AQUITAINE': 'Nouvelle-Aquitaine'
};

function fixTerritoryName(name) {
  return TERRITORY_NAMES[name] || name;
}

// ── Traitement GeoJSON ──

function processGeoJSON(geojson) {
  const firstFeature = geojson.features?.[0];
  if (firstFeature) {
    const coords = firstFeature.geometry.type === 'MultiLineString'
      ? firstFeature.geometry.coordinates[0]
      : firstFeature.geometry.coordinates;
    if (coords && isLambert93(coords)) {
      console.log('Reprojection Lambert 93 → WGS84...');
      geojson = reprojectGeoJSON(geojson);
    }
  }

  const flatFeatures = [];
  geojson.features.forEach(f => {
    const props = f.properties || {};
    const base = {
      site: props.Site || '',
      revetement: props.revetement || '',
      region: fixTerritoryName(props.region || ''),
      departement: fixTerritoryName(props.departemen || '')
    };
    if (f.geometry.type === 'MultiLineString') {
      f.geometry.coordinates.forEach(coords => {
        flatFeatures.push({ coordinates: coords, ...base });
      });
    } else if (f.geometry.type === 'LineString') {
      flatFeatures.push({ coordinates: f.geometry.coordinates, ...base });
    }
  });

  if (flatFeatures.length === 0) { alert('Aucun tracé linéaire trouvé.'); return; }

  // Si on a un GPX avec altitude, fusionner pour enrichir avec l'élévation
  if (gpxCoordsCache && gpxCoordsCache.length > 0) {
    console.log('Fusion GPX (altitude) + GeoJSON (attributs)...');
    sortedFeaturesCache = mergeGPXWithGeoJSON(gpxCoordsCache, flatFeatures);
  } else {
    console.log(`${flatFeatures.length} segments — tri spatial...`);
    sortedFeaturesCache = sortFeaturesIntoRoute(flatFeatures);
  }

  displayRoute({
    type: 'FeatureCollection',
    features: sortedFeaturesCache.map(f => ({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: f.coordinates },
      properties: {}
    }))
  });

  rebuildView();

  // Invalider le cache territoires
  stages10kmCache = null;
  scores10kmCache = null;

  // Stocker dans la DB si pas encore fait
  if (!currentItineraryKey) {
    currentItineraryKey = 'velodyssee';
    itineraryDB['velodyssee'] = {
      name: 'La Vélodyssée',
      sortedFeatures: sortedFeaturesCache,
      gpxCoords: gpxCoordsCache,
      scrapedStages: null
    };
  }
}

function processRoute(geojson) {
  const flatFeatures = [];
  geojson.features.forEach(f => {
    flatFeatures.push({
      coordinates: f.geometry.coordinates,
      site: '', revetement: '', region: '', departement: ''
    });
  });
  sortedFeaturesCache = flatFeatures;
  displayRoute(geojson);
  rebuildView();
}

// ── Sidebar ──

function updateSidebar(stages, scores) {
  document.getElementById('route-info').classList.remove('hidden');
  document.getElementById('route-name').textContent = stages.properties.name;
  document.getElementById('total-distance').textContent = fmt(stages.properties.totalDistance) + ' km';
  document.getElementById('num-stages').textContent = stages.properties.totalStages;

  // % site propre pondéré par la distance (km propre / km total)
  let totalDist = 0, totalDistPropre = 0;
  stages.features.forEach(s => {
    const d = s.properties.distance;
    totalDist += d;
    totalDistPropre += d * s.properties.pctSitePropre / 100;
  });
  const globalPctPropre = totalDist > 0 ? Math.round((totalDistPropre / totalDist) * 100) : 0;
  document.getElementById('pct-propre').textContent = globalPctPropre + '%';

  const ul = document.getElementById('stages-ul');
  ul.innerHTML = '';
  allStageItems = [];

  stages.features.forEach((stage, i) => {
    const score = scores[i];
    const props = stage.properties;
    const catColor = score.category.color;

    const hasElev = props.elevationGain !== null;
    const location = [props.departement, props.region].filter(Boolean).join(' · ');

    const li = document.createElement('li');
    li.innerHTML = `
      <div class="stage-card">
        <div class="stage-card-left">
          ${createDonutSVG(score.total, score.maxPossible, catColor, 72)}
        </div>
        <div class="stage-card-right">
          <div class="stage-card-header">
            <span class="stage-card-name">${props.name}</span>
            <span class="stage-card-badge" style="background:${catColor}">${score.category.name}</span>
          </div>
          ${location ? `<div class="stage-card-location"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>${location}</div>` : ''}
          <div class="stage-card-kpis">
            <span class="stage-kpi"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6H5a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h13l4-3.5L18 6Z"/><path d="M12 13v8"/></svg>${fmt(props.distance)} km</span>
            <span class="stage-kpi"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>${props.pctSitePropre}%</span>
            ${hasElev ? `<span class="stage-kpi"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>D+ ${props.elevationGain}m</span>` : ''}
            ${hasElev && props.numPics > 0 ? `<span class="stage-kpi"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/></svg>${props.numPics} pic${props.numPics > 1 ? 's' : ''}</span>` : ''}
          </div>
        </div>
      </div>
    `;
    li.addEventListener('click', () => highlightStage(i, stages));
    ul.appendChild(li);

    allStageItems.push({ li, stage, score, index: i });
  });

  // Appliquer la visibilité du panel actuel
  updatePanelVisibility();
}

// ── Scores par territoire ──

// Cache des données 10 km pour les territoires
let stages10kmCache = null;
let scores10kmCache = null;

function buildTerritoryScores() {
  // Toujours utiliser les tranches de 10 km pour les territoires
  if (!sortedFeaturesCache) return;

  // Recalculer les stages 10 km si pas en cache
  if (!stages10kmCache) {
    stages10kmCache = splitIntoStages(sortedFeaturesCache, 10);
    scores10kmCache = stages10kmCache.features.map(s => computeStageScore(s));
  }

  const stages = stages10kmCache;
  const scores = scores10kmCache;
  const field = currentPanel === 'regions' ? 'region' : 'departement';

  // Agréger par territoire
  const territories = {};
  stages.features.forEach((stage, i) => {
    const key = stage.properties[field];
    if (!key) return;
    if (!territories[key]) {
      territories[key] = { name: key, stages: [], scores: [], totalDist: 0, distPropre: 0 };
    }
    const d = stage.properties.distance;
    territories[key].stages.push(stage);
    territories[key].scores.push(scores[i]);
    territories[key].totalDist += d;
    territories[key].distPropre += d * stage.properties.pctSitePropre / 100;
  });

  // Calculer le score moyen et répartition par catégorie
  const list = document.getElementById('territory-list');
  list.innerHTML = '';

  // Bandeau informatif
  list.innerHTML = `
    <div class="territory-info-banner" id="territory-banner">
      <span>Scores calculés sur la base des tranches de 10 km</span>
      <button onclick="document.getElementById('territory-banner').style.display='none'">&times;</button>
    </div>
  `;

  const sorted = Object.values(territories).sort((a, b) => {
    // Trier par ordre d'apparition sur l'itinéraire
    const idxA = stages.features.findIndex(s => s.properties[field] === a.name);
    const idxB = stages.features.findIndex(s => s.properties[field] === b.name);
    return idxA - idxB;
  });

  sorted.forEach(t => {
    const avgScore = t.scores.reduce((s, sc) => s + sc.total, 0) / t.scores.length;
    const pctPropre = Math.round((t.distPropre / t.totalDist) * 100);

    // Répartition par catégorie
    let debute = 0, habitude = 0, aventure = 0;
    t.scores.forEach(sc => {
      if (sc.category.key === 'debute') debute++;
      else if (sc.category.key === 'habitude') habitude++;
      else aventure++;
    });
    const total = t.scores.length;

    const avgColor = scoreToColor(Math.round(avgScore));
    const avgRounded = Math.round(avgScore * 10) / 10;

    // Collecter les bounds pour le zoom
    const allCoords = [];
    t.stages.forEach(s => {
      s.geometry.coordinates.forEach(c => allCoords.push([c[1], c[0]]));
    });

    const card = document.createElement('div');
    card.className = 'territory-card';
    card.innerHTML = `
      <div class="territory-card-donut">
        ${createDonutSVG(avgRounded, 10, avgColor, 72)}
      </div>
      <div class="territory-card-info">
        <div class="territory-card-name">${t.name}</div>
        <div class="stage-card-kpis">
          <span class="stage-kpi"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m2 12 8.58 3.91a2 2 0 0 0 1.66 0L20.76 12"/><path d="m2 17 8.58 3.91a2 2 0 0 0 1.66 0L20.76 17"/></svg>${total} étape${total > 1 ? 's' : ''}</span>
          <span class="stage-kpi"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6H5a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h13l4-3.5L18 6Z"/><path d="M12 13v8"/></svg>${fmt(t.totalDist)} km</span>
          <span class="stage-kpi"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>${pctPropre}%</span>
        </div>
        <div class="territory-card-bars">
          ${debute > 0 ? `<div class="territory-bar" style="width:${debute/total*100}%; background:#22c55e;" title="${debute} Je débute"><span>${Math.round(debute/total*100)}%</span></div>` : ''}
          ${habitude > 0 ? `<div class="territory-bar" style="width:${habitude/total*100}%; background:#f59e0b;" title="${habitude} J'ai l'habitude"><span>${Math.round(habitude/total*100)}%</span></div>` : ''}
          ${aventure > 0 ? `<div class="territory-bar" style="width:${aventure/total*100}%; background:#ef4444;" title="${aventure} Aventure"><span>${Math.round(aventure/total*100)}%</span></div>` : ''}
        </div>
      </div>
    `;

    // Clic → zoom sur le territoire
    const territoryName = t.name;
    card.addEventListener('click', () => {
      if (allCoords.length > 0) {
        highlightLayer.clearLayers();
        // Atténuer tous les tronçons sauf ceux du territoire (comparaison par nom de territoire)
        stageLayerItems.forEach(item => {
          const itemTerritory = item.stage.properties[field];
          const isInTerritory = itemTerritory === territoryName;
          item.layer.setStyle({
            opacity: isInTerritory ? 1 : 0.25,
            weight: isInTerritory ? 6 : 3
          });
        });
        map.fitBounds(L.latLngBounds(allCoords), { padding: [60, 60], maxZoom: 11 });
      }
    });

    list.appendChild(card);
  });
}
