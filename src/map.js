/**
 * Gestion de la carte Leaflet + bottom panel + thème
 */

let map;
let routeLayer;
let stagesLayer;
let highlightLayer;
let stageLayerItems = [];
let currentTileLayer = null;
let currentBasemap = null; // 'carto', 'osm', 'cyclosm'

const BASEMAPS = {
  carto: {
    label: 'Sobre',
    dark: { url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', attribution: '&copy; OpenStreetMap &copy; CARTO' },
    light: { url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', attribution: '&copy; OpenStreetMap &copy; CARTO' }
  },
  osm: {
    label: 'OSM',
    dark: { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; OpenStreetMap' },
    light: { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; OpenStreetMap' }
  },
  cyclosm: {
    label: 'CyclOSM',
    dark: { url: 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png', attribution: '&copy; OpenStreetMap &copy; CyclOSM' },
    light: { url: 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png', attribution: '&copy; OpenStreetMap &copy; CyclOSM' }
  },
  satellite: {
    label: 'Satellite',
    dark: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: '&copy; Esri' },
    light: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: '&copy; Esri' }
  }
};

function initMap() {
  map = L.map('map', { zoomControl: true }).setView([46.6, 1.9], 6);
  currentBasemap = localStorage.getItem('basemap') || 'carto';
  applyBasemap();
  initBasemapSelector();
  routeLayer = L.layerGroup().addTo(map);
  stagesLayer = L.layerGroup().addTo(map);
  highlightLayer = L.layerGroup().addTo(map);
}

function applyBasemap() {
  const theme = document.documentElement.getAttribute('data-theme') || 'dark';
  const config = BASEMAPS[currentBasemap]?.[theme] || BASEMAPS.carto[theme];
  if (currentTileLayer) map.removeLayer(currentTileLayer);
  currentTileLayer = L.tileLayer(config.url, {
    attribution: config.attribution,
    maxZoom: 19
  }).addTo(map);
  // Mettre à jour le sélecteur
  document.querySelectorAll('.basemap-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.basemap === currentBasemap);
  });
}

function setMapTile(theme) {
  applyBasemap();
}

function initBasemapSelector() {
  const container = document.getElementById('basemap-selector');
  if (!container) return;
  container.innerHTML = '';
  for (const [key, config] of Object.entries(BASEMAPS)) {
    const btn = document.createElement('button');
    btn.className = 'basemap-btn' + (key === currentBasemap ? ' active' : '');
    btn.dataset.basemap = key;
    btn.textContent = config.label;
    btn.addEventListener('click', () => {
      currentBasemap = key;
      localStorage.setItem('basemap', key);
      applyBasemap();
    });
    container.appendChild(btn);
  }
}

function displayRoute(geojson) {
  routeLayer.clearLayers();
  const line = L.geoJSON(geojson, {
    style: { color: 'var(--text-faint)', weight: 2, opacity: 0.4 }
  }).addTo(routeLayer);
  map.fitBounds(line.getBounds(), { padding: [40, 40] });
}

function displayStages(stagesGeojson, scores) {
  stagesLayer.clearLayers();
  stageLayerItems = [];

  stagesGeojson.features.forEach((stage, i) => {
    const score = scores[i];
    const color = scoreToColor(score.total);

    const line = L.geoJSON(stage, {
      style: { color, weight: 5, opacity: 0.9 }
    });

    line.on('click', () => {
      showBottomPanel(stage, score);
      highlightStageOnMap(stage);
    });

    line.addTo(stagesLayer);
    stageLayerItems.push({ layer: line, stage, score });
  });
}

function highlightStage(stageIndex, stagesGeojson) {
  const stage = stagesGeojson.features[stageIndex];
  if (!stage) return;
  highlightStageOnMap(stage);
  if (currentScores && currentScores[stageIndex]) {
    showBottomPanel(stage, currentScores[stageIndex]);
  }
}

function highlightStageOnMap(stage) {
  // Atténuer tous les tronçons sauf le sélectionné
  stageLayerItems.forEach(item => {
    const isSelected = item.stage === stage;
    item.layer.setStyle({
      opacity: isSelected ? 1 : 0.15,
      weight: isSelected ? 7 : 3
    });
  });

  highlightLayer.clearLayers();

  const coords = stage.geometry.coordinates.map(c => [c[1], c[0]]);
  if (coords.length > 0) {
    map.fitBounds(L.latLngBounds(coords), { padding: [80, 80], maxZoom: 13 });
  }
}

function updateMapFilter(catFilter, regionFilter, deptFilter) {
  stageLayerItems.forEach(item => {
    const props = item.stage.properties;
    const catKey = item.score.category.key;

    let visible = true;
    if (catFilter !== 'all' && catKey !== catFilter) visible = false;
    if (regionFilter !== 'all' && props.region !== regionFilter) visible = false;
    if (deptFilter !== 'all' && props.departement !== deptFilter) visible = false;

    if (visible) {
      if (!stagesLayer.hasLayer(item.layer)) stagesLayer.addLayer(item.layer);
    } else {
      if (stagesLayer.hasLayer(item.layer)) stagesLayer.removeLayer(item.layer);
    }
  });
}

// ── Bottom Panel ──

// Icônes Lucide en SVG inline (16x16)
const ICONS = {
  route: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6H5a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h13l4-3.5L18 6Z"/><path d="M12 13v8"/></svg>',
  shield: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>',
  mountain: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/></svg>',
  trendingUp: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>',
  mapPin: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
  triangle: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13.73 4a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/></svg>',
};

function showBottomPanel(stage, score) {
  const panel = document.getElementById('bottom-panel');
  const props = stage.properties;
  const color = score.category.color;

  document.getElementById('panel-donut').innerHTML = createDonutSVG(score.total, score.maxPossible, color, 100);

  const hasElev = props.elevationGain !== null;

  const location = [props.departement, props.region].filter(Boolean).join(' · ');

  document.getElementById('panel-info').innerHTML = `
    <div class="panel-title-row">
      <h3>${props.name}</h3>
      <span class="panel-badge" style="background:${color};">${score.category.name}</span>
    </div>
    ${location ? `<div class="panel-location">${ICONS.mapPin}<span>${location}</span></div>` : ''}
    <div class="panel-chips">
      <span class="panel-chip">${ICONS.route} ${String(props.distance).replace('.', ',')} km</span>
      <span class="panel-chip">${ICONS.shield} ${props.pctSitePropre}% sécurisé</span>
      ${hasElev ? `<span class="panel-chip">${ICONS.trendingUp} D+ ${props.elevationGain}m</span>` : ''}
      ${hasElev ? `<span class="panel-chip">${ICONS.trendingUp} D- ${props.elevationLoss}m</span>` : ''}
      ${hasElev ? `<span class="panel-chip">${ICONS.mountain} ${props.numPics} pic${props.numPics > 1 ? 's' : ''}</span>` : ''}
      ${hasElev && props.maxSlope > 0 ? `<span class="panel-chip">${ICONS.triangle} max ${String(props.maxSlope).replace('.', ',')}%</span>` : ''}
    </div>
  `;

  let subHTML = '';
  for (const [key, sub] of Object.entries(score.subScores)) {
    const c = subScoreColor(sub.points, sub.maxPoints);
    subHTML += `
      <div class="subscore-item ${sub.available ? '' : 'subscore-unavailable'}">
        ${createDonutSVG(sub.points, sub.maxPoints, c, 64, sub.label)}
      </div>
    `;
  }
  document.getElementById('panel-subscores').innerHTML = subHTML;
  panel.classList.add('visible');
}

function closeBottomPanel() {
  document.getElementById('bottom-panel').classList.remove('visible');
  highlightLayer.clearLayers();
  // Restaurer l'opacité de tous les tronçons
  stageLayerItems.forEach(item => {
    item.layer.setStyle({ opacity: 0.9, weight: 5 });
  });
}

// ── Theme toggle ──

function toggleTheme() {
  const html = document.documentElement;
  const current = html.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';

  html.setAttribute('data-theme', next);
  updateThemeIcons(next);
  setMapTile(next);
  localStorage.setItem('theme', next);
}

function loadSavedTheme() {
  const saved = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeIcons(saved);
  setMapTile(saved);
}

function updateThemeIcons(theme) {
  const sun = document.getElementById('icon-sun');
  const moon = document.getElementById('icon-moon');
  if (theme === 'dark') {
    sun.style.display = 'none';
    moon.style.display = 'block';
  } else {
    sun.style.display = 'block';
    moon.style.display = 'none';
  }
}
