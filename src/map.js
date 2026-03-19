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
      territoryNavData = null;
      showBottomPanel(stage, score);
      highlightStageOnMap(stage);
    });

    line.addTo(stagesLayer);
    stageLayerItems.push({ layer: line, stage, score });
  });
}

function highlightStage(stageIndex, stagesGeojson) {
  territoryNavData = null;
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
      opacity: isSelected ? 1 : 0.25,
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

let currentPanelStage = null;
let currentPanelStageIndex = null;
let currentPanelHighlight = null; // 'securite', 'relief', 'pics', 'pente', null

// Correspondance sous-score → data-kpi sur les chips
const SUBSCORE_KPI_MAP = {
  securite: 'secu',
  relief: 'dplus',
  pics: 'pics',
  pente: 'pics',
  provisoire: null
};

function showBottomPanel(stage, score) {
  const panel = document.getElementById('bottom-panel');
  const props = stage.properties;
  const color = score.category.color;
  currentPanelStage = stage;
  currentPanelStageIndex = props.index;
  currentPanelHighlight = null;

  // Donut principal (60px — Layout C)
  document.getElementById('panel-donut').innerHTML = createDonutSVG(score.total, score.maxPossible, color, 60);

  // Infos — Layout C : titre+badge, location, chips empilés
  const location = [props.departement, props.region].filter(Boolean).join(' · ');
  const hasElev = props.elevationGain !== null;

  document.getElementById('panel-info').innerHTML = `
    <div class="panel-title-row">
      <h3>${props.name}</h3>
      <span class="panel-badge" style="background:${color};">${score.category.name}</span>
    </div>
    ${location ? `<div class="panel-location">${ICONS.mapPin}<span>${location}</span></div>` : ''}
    <div class="panel-chips">
      <span class="panel-chip" data-kpi="dist">${ICONS.route} ${String(props.distance).replace('.', ',')} km</span>
      <span class="panel-chip" data-kpi="secu">${ICONS.shield} ${props.pctSitePropre}% sécu.</span>
      ${hasElev ? `<span class="panel-chip" data-kpi="dplus">${ICONS.trendingUp} D+ ${props.elevationGain}m</span>` : ''}
      ${hasElev && props.numPics > 0 ? `<span class="panel-chip" data-kpi="pics">${ICONS.mountain} ${props.numPics} pic${props.numPics > 1 ? 's' : ''}</span>` : ''}
    </div>
  `;

  // Sous-scores cliquables (taqués en bas gauche, 48px)
  let subHTML = '';
  for (const [key, sub] of Object.entries(score.subScores)) {
    const c = subScoreColor(sub.points, sub.maxPoints);
    subHTML += `
      <div class="subscore-item ${sub.available ? '' : 'subscore-unavailable'}"
           data-indicator="${key}"
           onclick="toggleElevationHighlight('${key}')">
        ${createDonutSVG(sub.points, sub.maxPoints, c, 48, sub.label)}
      </div>
    `;
  }
  document.getElementById('panel-subscores').innerHTML = subHTML;

  panel.classList.add('visible');

  // Navigation : afficher les flèches et les positionner au-dessus du panel
  const nav = document.getElementById('panel-nav');
  nav.classList.add('visible');
  updateNavButtons();
  requestAnimationFrame(() => {
    const panelRect = panel.getBoundingClientRect();
    const mapRect = document.getElementById('map-container').getBoundingClientRect();
    nav.style.left = (panelRect.left - mapRect.left) + 'px';
    nav.style.bottom = (mapRect.bottom - panelRect.top + 6) + 'px';
  });

  // Sélectionner automatiquement le premier sous-score (sécurité)
  const firstIndicator = Object.keys(score.subScores)[0];
  if (firstIndicator) {
    requestAnimationFrame(() => toggleElevationHighlight(firstIndicator));
  } else {
    requestAnimationFrame(() => drawElevationProfile(stage));
  }
}

function navigateStage(direction) {
  // Navigation entre territoires
  if (territoryNavData) {
    const newIdx = territoryNavData.index + direction;
    if (newIdx < 0 || newIdx >= territoryNavData.sorted.length) return;
    territoryNavData.index = newIdx;
    selectTerritory(territoryNavData.sorted[newIdx], territoryNavData.field);
    updateNavButtons();
    return;
  }
  // Navigation entre étapes
  if (currentPanelStageIndex === null || !currentStages || !currentScores) return;
  const newIdx = currentPanelStageIndex + direction;
  if (newIdx < 0 || newIdx >= currentStages.features.length) return;
  highlightStage(newIdx, currentStages);
}

function updateNavButtons() {
  if (territoryNavData) {
    document.getElementById('btn-prev-stage').disabled = territoryNavData.index <= 0;
    document.getElementById('btn-next-stage').disabled = territoryNavData.index >= territoryNavData.sorted.length - 1;
    return;
  }
  const total = currentStages ? currentStages.features.length : 0;
  document.getElementById('btn-prev-stage').disabled = currentPanelStageIndex <= 0;
  document.getElementById('btn-next-stage').disabled = currentPanelStageIndex >= total - 1;
}

function toggleElevationHighlight(indicator) {
  if (currentPanelHighlight === indicator) {
    currentPanelHighlight = null;
  } else {
    currentPanelHighlight = indicator;
  }

  // Mettre à jour l'état actif des donuts
  document.querySelectorAll('#panel-subscores .subscore-item').forEach(el => {
    el.classList.toggle('subscore-active', el.dataset.indicator === currentPanelHighlight);
  });

  // Highlight du KPI correspondant
  document.querySelectorAll('#panel-info .panel-chip').forEach(el => {
    el.classList.remove('chip-highlight');
  });
  if (currentPanelHighlight) {
    const kpiKey = SUBSCORE_KPI_MAP[currentPanelHighlight];
    if (kpiKey) {
      const chip = document.querySelector(`#panel-info .panel-chip[data-kpi="${kpiKey}"]`);
      if (chip) chip.classList.add('chip-highlight');
    }
  }

  if (currentPanelStage) {
    drawElevationProfile(currentPanelStage);
  }
}

// ── Profil altimétrique ──

function drawElevationProfile(stage) {
  const canvas = document.getElementById('elevation-canvas');
  if (!canvas) return;

  const rect = canvas.parentElement.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const w = rect.width;
  const h = rect.height;
  const coords = stage.geometry.coordinates;

  if (!coords || coords.length < 2 || !coords[0][2]) {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-muted');
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Pas de données d\'altitude', w / 2, h / 2);
    return;
  }

  // Calculer les distances cumulées et altitudes
  const points = [];
  let cumDist = 0;
  for (let i = 0; i < coords.length; i++) {
    if (i > 0) {
      cumDist += haversineDistance(coords[i - 1], coords[i]);
    }
    points.push({ dist: cumDist, ele: coords[i][2] || 0, idx: i });
  }

  const totalDist = points[points.length - 1].dist;
  const elevations = points.map(p => p.ele);
  const minEle = Math.min(...elevations);
  const maxEle = Math.max(...elevations);
  const eleRange = maxEle - minEle || 1;

  const padTop = 0;
  const padBottom = 0;
  const padLeft = 0;
  const padRight = 0;
  const pw = w - padLeft - padRight;
  const ph = h - padTop - padBottom;

  function xPos(dist) { return padLeft + (dist / totalDist) * pw; }
  function yPos(ele) { return padTop + ph - ((ele - minEle) / eleRange) * ph; }

  ctx.clearRect(0, 0, w, h);

  // Détecter les pics et pentes pour coloration
  const segments = [];
  for (let i = 1; i < points.length; i++) {
    const segDist = (points[i].dist - points[i - 1].dist) * 1000;
    if (segDist < 2) continue;
    const diff = points[i].ele - points[i - 1].ele;
    const slope = (diff / segDist) * 100;
    segments.push({
      i,
      slope,
      isClimb: slope > 4,
      isSteep: slope > 8,
      dist: points[i].dist,
      ele: points[i].ele
    });
  }

  // Fond : gradient sous la courbe
  const style = getComputedStyle(document.documentElement);
  const textMuted = style.getPropertyValue('--text-muted').trim();
  const borderColor = style.getPropertyValue('--border').trim();

  ctx.beginPath();
  ctx.moveTo(xPos(0), yPos(points[0].ele));
  points.forEach(p => ctx.lineTo(xPos(p.dist), yPos(p.ele)));
  ctx.lineTo(xPos(totalDist), h - padBottom);
  ctx.lineTo(xPos(0), h - padBottom);
  ctx.closePath();

  const gradient = ctx.createLinearGradient(0, padTop, 0, h - padBottom);
  gradient.addColorStop(0, 'rgba(99, 102, 241, 0.12)');
  gradient.addColorStop(1, 'rgba(99, 102, 241, 0.02)');
  ctx.fillStyle = gradient;
  ctx.fill();

  // Ligne de base du profil
  ctx.beginPath();
  points.forEach((p, i) => {
    const x = xPos(p.dist);
    const y = yPos(p.ele);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Helper : message centré sur le profil
  function drawProfileMessage(msg) {
    ctx.fillStyle = textMuted;
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(msg, w / 2, h / 2);
  }

  // Colorier selon le highlight actif
  if (currentPanelHighlight === 'pics') {
    // Pics : localisation des montées > 4%, > 200m — orange uniforme
    let climbStart = -1;
    let climbDist = 0;
    let found = false;

    for (let i = 1; i < points.length; i++) {
      const segDist = (points[i].dist - points[i - 1].dist) * 1000;
      if (segDist < 2) continue;
      const diff = points[i].ele - points[i - 1].ele;
      const slope = (diff / segDist) * 100;

      if (slope > 4) {
        if (climbStart < 0) climbStart = i - 1;
        climbDist += segDist;
      } else {
        if (climbStart >= 0 && climbDist >= 200) {
          drawHighlightSegment(ctx, points, climbStart, i - 1, xPos, yPos, h, padBottom, '#f59e0b');
          found = true;
        }
        climbStart = -1;
        climbDist = 0;
      }
    }
    if (climbStart >= 0 && climbDist >= 200) {
      drawHighlightSegment(ctx, points, climbStart, points.length - 1, xPos, yPos, h, padBottom, '#f59e0b');
      found = true;
    }
    if (!found) drawProfileMessage('Aucun pic détecté (montée > 4% sur > 200 m)');
  } else if (currentPanelHighlight === 'pente') {
    // Pente : intensité de pente dans les pics — orange 4-8%, rouge > 8%
    let climbStart = -1;
    let climbDist = 0;
    let climbMaxSlope = 0;
    let found = false;

    for (let i = 1; i < points.length; i++) {
      const segDist = (points[i].dist - points[i - 1].dist) * 1000;
      if (segDist < 2) continue;
      const diff = points[i].ele - points[i - 1].ele;
      const slope = (diff / segDist) * 100;

      if (slope > 4) {
        if (climbStart < 0) climbStart = i - 1;
        climbDist += segDist;
        if (slope > climbMaxSlope) climbMaxSlope = slope;
      } else {
        if (climbStart >= 0 && climbDist >= 200) {
          const picColor = climbMaxSlope >= 8 ? '#ef4444' : '#f59e0b';
          drawHighlightSegment(ctx, points, climbStart, i - 1, xPos, yPos, h, padBottom, picColor);
          found = true;
        }
        climbStart = -1;
        climbDist = 0;
        climbMaxSlope = 0;
      }
    }
    if (climbStart >= 0 && climbDist >= 200) {
      const picColor = climbMaxSlope >= 8 ? '#ef4444' : '#f59e0b';
      drawHighlightSegment(ctx, points, climbStart, points.length - 1, xPos, yPos, h, padBottom, picColor);
      found = true;
    }
    if (!found) drawProfileMessage('Aucune pente critique détectée');
  } else if (currentPanelHighlight === 'relief') {
    // Relief : colorier uniquement les portions en montée (D+), dans la couleur de difficulté de leur tranche

    // 1. Calculer la couleur de chaque tranche de 10 km
    const trancheColors = []; // { startIdx, endIdx, color } pour chaque tranche
    let trancheStart = 0;
    let trancheDist = 0;
    let trancheGain = 0;

    for (let i = 1; i < points.length; i++) {
      const segDist = points[i].dist - points[i - 1].dist;
      const diff = points[i].ele - points[i - 1].ele;
      trancheDist += segDist;
      if (diff > 0) trancheGain += diff;

      if (trancheDist >= 10 || i === points.length - 1) {
        const color = trancheGain <= 100 ? '#22c55e' : trancheGain <= 200 ? '#f59e0b' : '#ef4444';
        trancheColors.push({ startIdx: trancheStart, endIdx: i, color });
        trancheStart = i;
        trancheDist = 0;
        trancheGain = 0;
      }
    }

    // 2. Pour chaque tranche, ne colorier que les montées ≥ 10 m de D+ continu
    const RELIEF_MIN_GAIN = 10; // seuil : 10 m de D+ continu minimum
    for (const tranche of trancheColors) {
      let climbStart = -1;
      let climbGain = 0;
      for (let i = tranche.startIdx + 1; i <= tranche.endIdx; i++) {
        const diff = points[i].ele - points[i - 1].ele;
        if (diff > 0) {
          if (climbStart < 0) climbStart = i - 1;
          climbGain += diff;
        } else {
          if (climbStart >= 0 && climbGain >= RELIEF_MIN_GAIN) {
            drawHighlightSegment(ctx, points, climbStart, i - 1, xPos, yPos, h, padBottom, tranche.color);
          }
          climbStart = -1;
          climbGain = 0;
        }
      }
      if (climbStart >= 0 && climbGain >= RELIEF_MIN_GAIN) {
        drawHighlightSegment(ctx, points, climbStart, tranche.endIdx, xPos, yPos, h, padBottom, tranche.color);
      }
    }
  } else if (currentPanelHighlight === 'securite') {
    // Sécurité : colorier le profil selon site propre (vert) vs partagé (rouge)
    const siteTypes = stage.properties.siteTypes;
    if (siteTypes && siteTypes.length === coords.length) {
      let segStart = 0;
      let segPropre = siteTypes[0];
      for (let i = 1; i < points.length; i++) {
        if (siteTypes[i] !== segPropre || i === points.length - 1) {
          const endIdx = i === points.length - 1 ? i : i - 1;
          const color = segPropre ? '#22c55e' : '#ef4444';
          drawHighlightSegment(ctx, points, segStart, endIdx, xPos, yPos, h, padBottom, color);
          segStart = i;
          segPropre = siteTypes[i];
        }
      }
    }
  } else if (currentPanelHighlight === 'provisoire') {
    // Provisoire : donnée non disponible
    drawProfileMessage('Donnée provisoire non disponible');
  } else {
    // Pas de highlight : dessiner la courbe en couleur accent
    ctx.beginPath();
    points.forEach((p, i) => {
      const x = xPos(p.dist);
      const y = yPos(p.ele);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Helper : label avec fond pour lisibilité
  const surfaceColor = style.getPropertyValue('--bg-surface-hover').trim() || '#22222e';
  function drawLabel(text, x, y, align) {
    ctx.font = 'bold 9px Inter, sans-serif';
    ctx.textAlign = align;
    const metrics = ctx.measureText(text);
    const tw = metrics.width;
    const th = 11;
    const px = 4, py = 2;
    const rx = align === 'left' ? x - px : x - tw - px;
    ctx.fillStyle = surfaceColor;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.roundRect(rx, y - th - py, tw + px * 2, th + py * 2, 3);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = textMuted;
    ctx.fillText(text, x, y);
  }

  // Point culminant : triangle marqueur
  const peakPoint = points.reduce((best, p) => p.ele > best.ele ? p : best);
  const peakX = xPos(peakPoint.dist);
  const peakY = yPos(peakPoint.ele);
  ctx.fillStyle = textMuted;
  ctx.beginPath();
  ctx.moveTo(peakX, peakY - 3);
  ctx.lineTo(peakX - 3, peakY - 8);
  ctx.lineTo(peakX + 3, peakY - 8);
  ctx.closePath();
  ctx.fill();

  // Label "▲ XXXm" en haut à gauche
  drawLabel(`▲ ${Math.round(maxEle)}m`, 12, 22, 'left');

  // Label altitude min en bas à gauche
  drawLabel(`${Math.round(minEle)}m`, 12, h - 10, 'left');

  // Tooltip au survol
  canvas.onmousemove = (e) => {
    const canvasRect = canvas.getBoundingClientRect();
    const mx = e.clientX - canvasRect.left;
    const dist = ((mx - padLeft) / pw) * totalDist;
    const closest = points.reduce((best, p) => Math.abs(p.dist - dist) < Math.abs(best.dist - dist) ? p : best);

    const tooltip = document.getElementById('elevation-tooltip');
    tooltip.classList.remove('hidden');
    tooltip.style.left = mx + 'px';
    tooltip.textContent = `${String(closest.ele.toFixed(0))}m · ${String(closest.dist.toFixed(1)).replace('.', ',')} km`;
  };

  canvas.onmouseleave = () => {
    document.getElementById('elevation-tooltip').classList.add('hidden');
  };
}

function drawHighlightSegment(ctx, points, startIdx, endIdx, xPos, yPos, h, padBottom, color) {
  ctx.beginPath();
  ctx.moveTo(xPos(points[startIdx].dist), yPos(points[startIdx].ele));
  for (let j = startIdx + 1; j <= endIdx; j++) {
    ctx.lineTo(xPos(points[j].dist), yPos(points[j].ele));
  }
  // Fermer vers le bas pour remplir
  ctx.lineTo(xPos(points[endIdx].dist), h - padBottom);
  ctx.lineTo(xPos(points[startIdx].dist), h - padBottom);
  ctx.closePath();
  ctx.fillStyle = color + '30'; // transparent
  ctx.fill();

  // Ligne épaisse par-dessus
  ctx.beginPath();
  ctx.moveTo(xPos(points[startIdx].dist), yPos(points[startIdx].ele));
  for (let j = startIdx + 1; j <= endIdx; j++) {
    ctx.lineTo(xPos(points[j].dist), yPos(points[j].ele));
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.stroke();
}

function closeBottomPanel() {
  document.getElementById('bottom-panel').classList.remove('visible');
  document.getElementById('panel-nav').classList.remove('visible');
  currentPanelStageIndex = null;
  territoryNavData = null;
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
