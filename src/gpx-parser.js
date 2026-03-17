/**
 * Définition de la projection Lambert 93 (EPSG:2154)
 */
proj4.defs('EPSG:2154', '+proj=lcc +lat_1=49 +lat_2=44 +lat_0=46.5 +lon_0=3 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs');

function lambert93ToWGS84(x, y) {
  return proj4('EPSG:2154', 'EPSG:4326', [x, y]);
}

function isLambert93(coordinates) {
  if (!coordinates || coordinates.length === 0) return false;
  const first = Array.isArray(coordinates[0][0]) ? coordinates[0][0] : coordinates[0];
  return Math.abs(first[0]) > 10000 || Math.abs(first[1]) > 10000;
}

function reprojectGeoJSON(geojson) {
  const reprojected = JSON.parse(JSON.stringify(geojson));
  reprojected.features.forEach(feature => {
    const geom = feature.geometry;
    if (geom.type === 'LineString') {
      geom.coordinates = geom.coordinates.map(c => lambert93ToWGS84(c[0], c[1]));
    } else if (geom.type === 'MultiLineString') {
      geom.coordinates = geom.coordinates.map(line =>
        line.map(c => lambert93ToWGS84(c[0], c[1]))
      );
    }
  });
  return reprojected;
}

function parseGPX(gpxString) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(gpxString, 'text/xml');
  const name = xml.querySelector('trk > name')?.textContent || 'Itinéraire sans nom';
  const features = [];
  xml.querySelectorAll('trk').forEach(track => {
    track.querySelectorAll('trkseg').forEach(segment => {
      const coordinates = [];
      segment.querySelectorAll('trkpt').forEach(pt => {
        const lat = parseFloat(pt.getAttribute('lat'));
        const lon = parseFloat(pt.getAttribute('lon'));
        const ele = pt.querySelector('ele') ? parseFloat(pt.querySelector('ele').textContent) : 0;
        coordinates.push([lon, lat, ele]);
      });
      features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates }, properties: { name } });
    });
  });
  return { type: 'FeatureCollection', features, properties: { name } };
}

/**
 * Fusionne un GPX (géométrie + altitude) avec un GeoJSON (attributs Site/revetement).
 * Pour chaque point du GPX, on trouve le segment GeoJSON le plus proche
 * et on lui attribue les propriétés du segment.
 * Retourne un tableau de flatFeatures avec coordonnées [lon, lat, ele] et attributs.
 */
function mergeGPXWithGeoJSON(gpxCoords, geojsonFeatures) {
  console.log(`Fusion GPX (${gpxCoords.length} pts) + GeoJSON (${geojsonFeatures.length} segments)...`);

  // Index spatial des segments GeoJSON par grille
  const CELL = 0.02; // ~2km
  const grid = {};

  geojsonFeatures.forEach((feat, idx) => {
    const coords = feat.coordinates;
    // Indexer par les cellules couvertes (premier et dernier point)
    const keys = new Set();
    for (let i = 0; i < coords.length; i += Math.max(1, Math.floor(coords.length / 4))) {
      keys.add(`${Math.floor(coords[i][0] / CELL)},${Math.floor(coords[i][1] / CELL)}`);
    }
    keys.add(`${Math.floor(coords[coords.length - 1][0] / CELL)},${Math.floor(coords[coords.length - 1][1] / CELL)}`);
    keys.forEach(k => {
      if (!grid[k]) grid[k] = [];
      grid[k].push(idx);
    });
  });

  // Pour chaque point GPX, trouver le segment GeoJSON le plus proche
  const result = [];
  let lastSegIdx = 0;
  const batchSize = 50; // On ne check pas tous les points, on sample

  for (let i = 0; i < gpxCoords.length; i++) {
    const pt = gpxCoords[i];
    let bestSeg = lastSegIdx;

    // Toutes les ~50 points, chercher le meilleur segment
    if (i % batchSize === 0) {
      const cx = Math.floor(pt[0] / CELL);
      const cy = Math.floor(pt[1] / CELL);
      let bestDist = Infinity;

      // Chercher dans les 9 cellules voisines
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const candidates = grid[`${cx + dx},${cy + dy}`];
          if (!candidates) continue;
          for (const idx of candidates) {
            const segCoords = geojsonFeatures[idx].coordinates;
            // Distance au point milieu du segment
            const mid = segCoords[Math.floor(segCoords.length / 2)];
            const d = fastDistSq(pt, mid);
            if (d < bestDist) {
              bestDist = d;
              bestSeg = idx;
            }
          }
        }
      }
      lastSegIdx = bestSeg;
    }

    const feat = geojsonFeatures[bestSeg];
    result.push({
      coord: pt,
      site: feat.site,
      revetement: feat.revetement,
      region: feat.region,
      departement: feat.departement
    });
  }

  // Convertir en flatFeatures (groupés par segment continu de mêmes attributs)
  const flatFeatures = [];
  let currentCoords = [result[0].coord];
  let currentAttrs = result[0];

  for (let i = 1; i < result.length; i++) {
    const r = result[i];
    const sameAttrs = r.site === currentAttrs.site && r.revetement === currentAttrs.revetement;
    const dist = haversineDistance(currentCoords[currentCoords.length - 1], r.coord);

    if (!sameAttrs || dist > 0.5) {
      if (currentCoords.length >= 2) {
        flatFeatures.push({
          coordinates: currentCoords,
          site: currentAttrs.site,
          revetement: currentAttrs.revetement,
          region: currentAttrs.region,
          departement: currentAttrs.departement
        });
      }
      currentCoords = [r.coord];
      currentAttrs = r;
    } else {
      currentCoords.push(r.coord);
    }
  }
  if (currentCoords.length >= 2) {
    flatFeatures.push({
      coordinates: currentCoords,
      site: currentAttrs.site,
      revetement: currentAttrs.revetement,
      region: currentAttrs.region,
      departement: currentAttrs.departement
    });
  }

  console.log(`Fusion terminée : ${flatFeatures.length} segments enrichis avec altitude`);
  return flatFeatures;
}

/** Distance euclidienne rapide au carré (pour comparaisons uniquement) */
function fastDistSq(c1, c2) {
  const dx = c1[0] - c2[0];
  const dy = c1[1] - c2[1];
  return dx * dx + dy * dy;
}

/** Distance Haversine en km (pour calculs de distance réelle) */
function haversineDistance(coord1, coord2) {
  const R = 6371;
  const dLat = (coord2[1] - coord1[1]) * Math.PI / 180;
  const dLon = (coord2[0] - coord1[0]) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(coord1[1] * Math.PI / 180) * Math.cos(coord2[1] * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Trie les features en chaîne continue via un index spatial par grille.
 * Complexité ~O(n) au lieu de O(n²).
 */
function sortFeaturesIntoRoute(features) {
  if (features.length <= 1) return features;

  const CELL_SIZE = 0.05; // ~5 km en degrés

  function cellKey(lon, lat) {
    return `${Math.floor(lon / CELL_SIZE)},${Math.floor(lat / CELL_SIZE)}`;
  }

  // Construire l'index spatial : pour chaque feature, indexer son point de départ
  // On indexe par le point de départ de chaque feature
  const grid = {};
  const featureData = features.map((f, idx) => {
    const start = f.coordinates[0];
    const end = f.coordinates[f.coordinates.length - 1];
    return { idx, start, end, used: false };
  });

  function addToGrid(data) {
    // Indexer le start et le end
    const keyS = cellKey(data.start[0], data.start[1]);
    const keyE = cellKey(data.end[0], data.end[1]);
    if (!grid[keyS]) grid[keyS] = [];
    grid[keyS].push(data);
    if (keyS !== keyE) {
      if (!grid[keyE]) grid[keyE] = [];
      grid[keyE].push(data);
    }
  }

  featureData.forEach(d => addToGrid(d));

  // Trouver le point le plus au nord (latitude max) comme départ
  let startIdx = 0;
  let maxLat = -Infinity;
  featureData.forEach((d, i) => {
    const lat = Math.max(d.start[1], d.end[1]);
    if (lat > maxLat) {
      maxLat = lat;
      startIdx = i;
    }
  });

  const sorted = [];
  const first = featureData[startIdx];
  first.used = true;

  // Orienter le premier segment : le point le plus au nord est le départ
  if (first.start[1] < first.end[1]) {
    features[first.idx].coordinates = [...features[first.idx].coordinates].reverse();
    const tmp = first.start;
    first.start = first.end;
    first.end = tmp;
  }
  sorted.push(features[first.idx]);

  let currentEnd = first.end;

  for (let step = 1; step < features.length; step++) {
    const key = cellKey(currentEnd[0], currentEnd[1]);

    // Chercher dans les cellules voisines (3x3)
    let bestData = null;
    let bestDist = Infinity;
    let bestReverse = false;

    const cx = Math.floor(currentEnd[0] / CELL_SIZE);
    const cy = Math.floor(currentEnd[1] / CELL_SIZE);

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const k = `${cx + dx},${cy + dy}`;
        const candidates = grid[k];
        if (!candidates) continue;
        for (const cand of candidates) {
          if (cand.used) continue;
          const dStart = fastDistSq(currentEnd, cand.start);
          const dEnd = fastDistSq(currentEnd, cand.end);
          if (dStart < bestDist) {
            bestDist = dStart;
            bestData = cand;
            bestReverse = false;
          }
          if (dEnd < bestDist) {
            bestDist = dEnd;
            bestData = cand;
            bestReverse = true;
          }
        }
      }
    }

    // Si rien trouvé dans le voisinage immédiat, chercher plus large (fallback)
    if (!bestData) {
      for (const cand of featureData) {
        if (cand.used) continue;
        const dStart = fastDistSq(currentEnd, cand.start);
        const dEnd = fastDistSq(currentEnd, cand.end);
        if (dStart < bestDist) {
          bestDist = dStart;
          bestData = cand;
          bestReverse = false;
        }
        if (dEnd < bestDist) {
          bestDist = dEnd;
          bestData = cand;
          bestReverse = true;
        }
      }
    }

    if (!bestData) break;

    bestData.used = true;
    if (bestReverse) {
      features[bestData.idx].coordinates = [...features[bestData.idx].coordinates].reverse();
      const tmp = bestData.start;
      bestData.start = bestData.end;
      bestData.end = tmp;
    }
    sorted.push(features[bestData.idx]);
    currentEnd = bestData.end;
  }

  console.log(`Tri spatial : ${sorted.length}/${features.length} segments chaînés`);
  return sorted;
}

/**
 * Calcule les métriques d'altitude selon la méthodologie FVT.
 *
 * - Relief : score max par tranche de 10 km (D+ de la tranche → 0-3 pts)
 * - Pics : montées continues > 4% de pente ET > 200m de longueur
 * - Pente : somme des scores de pente par pic (4-8% → 0,25 pt, >8% → 0,5 pt)
 *
 * Retourne { elevationGain, elevationLoss, reliefScore, numPics, slopeScore, maxSlope }
 */
function computeElevationMetrics(coords) {
  const hasEle = coords.some(c => c.length >= 3 && c[2] !== 0);
  if (!hasEle) return {
    elevationGain: null, elevationLoss: null,
    reliefScore: null, numPics: null, slopeScore: null, maxSlope: null
  };

  // 1. Calcul du D+ total et par tranche de 10 km
  let totalGain = 0, totalLoss = 0;
  let trancheDist = 0, trancheGain = 0;
  let maxTrancheScore = 0;

  // 2. Détection des pics (montée continue > 4% sur > 200m)
  let pics = [];
  let climbDist = 0, climbGain = 0, climbMaxSlope = 0;
  let inClimb = false;
  let overallMaxSlope = 0;

  for (let i = 1; i < coords.length; i++) {
    const ele1 = coords[i - 1][2] || 0;
    const ele2 = coords[i][2] || 0;
    const diff = ele2 - ele1;
    const segDist = haversineDistance(coords[i - 1], coords[i]) * 1000; // mètres

    if (segDist < 2) continue;

    const slope = (diff / segDist) * 100; // pente signée

    // D+ / D-
    if (diff > 0) totalGain += diff;
    else if (diff < 0) totalLoss += Math.abs(diff);

    // Relief par tranche de 10 km
    trancheDist += segDist;
    if (diff > 0) trancheGain += diff;
    if (trancheDist >= 10000) {
      const trancheScore = trancheGain <= 100 ? 0 : trancheGain <= 200 ? 1 : trancheGain <= 400 ? 2 : 3;
      if (trancheScore > maxTrancheScore) maxTrancheScore = trancheScore;
      trancheDist = 0;
      trancheGain = 0;
    }

    // Détection des pics
    if (slope > 4) {
      // On est en montée raide
      climbDist += segDist;
      climbGain += diff;
      if (slope > climbMaxSlope) climbMaxSlope = slope;
      if (slope > overallMaxSlope) overallMaxSlope = slope;
      inClimb = true;
    } else {
      if (inClimb && climbDist >= 200) {
        // Fin de montée significative → pic confirmé
        pics.push({ dist: climbDist, gain: climbGain, maxSlope: climbMaxSlope });
      }
      inClimb = false;
      climbDist = 0;
      climbGain = 0;
      climbMaxSlope = 0;
    }
  }

  // Dernière tranche (même partielle)
  if (trancheDist > 1000) {
    const trancheScore = trancheGain <= 100 ? 0 : trancheGain <= 200 ? 1 : trancheGain <= 400 ? 2 : 3;
    if (trancheScore > maxTrancheScore) maxTrancheScore = trancheScore;
  }

  // Dernier pic en cours
  if (inClimb && climbDist >= 200) {
    pics.push({ dist: climbDist, gain: climbGain, maxSlope: climbMaxSlope });
  }

  // Score pente : somme des scores par pic
  let slopeScore = 0;
  pics.forEach(p => {
    if (p.maxSlope >= 8) slopeScore += 0.5;
    else if (p.maxSlope >= 4) slopeScore += 0.25;
  });

  return {
    elevationGain: Math.round(totalGain),
    elevationLoss: Math.round(totalLoss),
    reliefScore: maxTrancheScore,
    numPics: pics.length,
    slopeScore: Math.round(slopeScore * 100) / 100,
    maxSlope: Math.round(overallMaxSlope * 10) / 10
  };
}

/**
 * Découpe les features triées en étapes de stageLength km.
 */
function splitIntoStages(flatFeatures, stageLength = 10) {
  const stages = [];
  let stageIdx = 0;
  let stageCoords = [];
  let stageDist = 0;
  let stageAttrs = { propre: 0, partage: 0, lisse: 0, rugueux: 0, meuble: 0 };
  let stageRegion = '';
  let stageDept = '';

  function pushStage(nameOverride) {
    const totalAttr = stageAttrs.propre + stageAttrs.partage;
    const elev = computeElevationMetrics(stageCoords);
    stages.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: stageCoords },
      properties: {
        index: stageIdx,
        name: nameOverride || `Étape ${stageIdx + 1}`,
        distance: Math.round(stageDist * 100) / 100,
        pctSitePropre: totalAttr > 0 ? Math.round((stageAttrs.propre / totalAttr) * 100) : 0,
        pctSitePartage: totalAttr > 0 ? Math.round((stageAttrs.partage / totalAttr) * 100) : 0,
        pctLisse: totalAttr > 0 ? Math.round((stageAttrs.lisse / totalAttr) * 100) : 0,
        pctRugueux: totalAttr > 0 ? Math.round((stageAttrs.rugueux / totalAttr) * 100) : 0,
        pctMeuble: totalAttr > 0 ? Math.round((stageAttrs.meuble / totalAttr) * 100) : 0,
        elevationGain: elev.elevationGain,
        elevationLoss: elev.elevationLoss,
        reliefScore: elev.reliefScore,
        numPics: elev.numPics,
        slopeScore: elev.slopeScore,
        maxSlope: elev.maxSlope,
        region: stageRegion,
        departement: stageDept
      }
    });
    stageIdx++;
    stageCoords = [stageCoords[stageCoords.length - 1]];
    stageDist = 0;
    stageAttrs = { propre: 0, partage: 0, lisse: 0, rugueux: 0, meuble: 0 };
  }

  flatFeatures.forEach(feat => {
    const coords = feat.coordinates;
    const isPropre = (feat.site || '').includes('propre');
    const rev = feat.revetement || '';
    const isLisse = rev === 'Lisse';
    const isRugueux = rev === 'Rugueux';
    const isMeuble = rev === 'Meuble';

    for (let i = 0; i < coords.length; i++) {
      if (stageCoords.length === 0) {
        stageCoords.push(coords[i]);
        stageRegion = feat.region;
        stageDept = feat.departement;
        continue;
      }

      const lastPt = stageCoords[stageCoords.length - 1];
      const segDist = haversineDistance(lastPt, coords[i]);

      // Saut > 0.5 km = discontinuité, ne pas compter la distance
      if (segDist > 0.5) {
        // On ferme l'étape en cours si elle a assez de contenu
        if (stageDist > 0.5 && stageCoords.length >= 2) {
          pushStage();
        }
        stageCoords = [coords[i]];
        stageDist = 0;
        stageRegion = feat.region;
        stageDept = feat.departement;
        continue;
      }

      stageDist += segDist;
      stageCoords.push(coords[i]);

      if (isPropre) stageAttrs.propre += segDist;
      else stageAttrs.partage += segDist;
      if (isLisse) stageAttrs.lisse += segDist;
      else if (isRugueux) stageAttrs.rugueux += segDist;
      else if (isMeuble) stageAttrs.meuble += segDist;

      if (!stageRegion) stageRegion = feat.region;
      if (!stageDept) stageDept = feat.departement;

      if (stageDist >= stageLength) {
        pushStage();
        stageRegion = feat.region;
        stageDept = feat.departement;
      }
    }
  });

  // Dernière étape
  if (stageCoords.length >= 2 && stageDist > 0.5) {
    pushStage();
  }

  const totalDistance = stages.reduce((sum, s) => sum + s.properties.distance, 0);

  return {
    type: 'FeatureCollection',
    features: stages,
    properties: {
      name: 'EV1 / La Vélodyssée',
      totalDistance: Math.round(totalDistance * 100) / 100,
      totalStages: stages.length
    }
  };
}

/**
 * Découpe les features en étapes touristiques basées sur les distances cumulées.
 * Chaque étape touristique a un nom (ville → ville) et une distance officielle.
 */
function splitIntoTouristicStages(flatFeatures, etapesConfig) {
  const stages = [];
  let stageIdx = 0;
  let stageCoords = [];
  let stageDist = 0;
  let stageAttrs = { propre: 0, partage: 0, lisse: 0, rugueux: 0, meuble: 0 };
  let stageRegion = '';
  let stageDept = '';
  let cumulDist = 0;

  // Distances cumulées cibles pour couper
  const cumulTargets = [];
  let cumul = 0;
  etapesConfig.forEach(e => {
    cumul += e.distance;
    cumulTargets.push(cumul);
  });

  function pushStage() {
    const totalAttr = stageAttrs.propre + stageAttrs.partage;
    const etape = etapesConfig[stageIdx] || {};
    const elev = computeElevationMetrics(stageCoords);
    stages.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: stageCoords },
      properties: {
        index: stageIdx,
        name: etape.name || `Étape ${stageIdx + 1}`,
        distance: Math.round(stageDist * 100) / 100,
        pctSitePropre: totalAttr > 0 ? Math.round((stageAttrs.propre / totalAttr) * 100) : 0,
        pctSitePartage: totalAttr > 0 ? Math.round((stageAttrs.partage / totalAttr) * 100) : 0,
        pctLisse: totalAttr > 0 ? Math.round((stageAttrs.lisse / totalAttr) * 100) : 0,
        pctRugueux: totalAttr > 0 ? Math.round((stageAttrs.rugueux / totalAttr) * 100) : 0,
        pctMeuble: totalAttr > 0 ? Math.round((stageAttrs.meuble / totalAttr) * 100) : 0,
        elevationGain: elev.elevationGain,
        elevationLoss: elev.elevationLoss,
        reliefScore: elev.reliefScore,
        numPics: elev.numPics,
        slopeScore: elev.slopeScore,
        maxSlope: elev.maxSlope,
        region: stageRegion,
        departement: stageDept
      }
    });
    stageIdx++;
    stageCoords = [stageCoords[stageCoords.length - 1]];
    stageDist = 0;
    stageAttrs = { propre: 0, partage: 0, lisse: 0, rugueux: 0, meuble: 0 };
  }

  flatFeatures.forEach(feat => {
    const coords = feat.coordinates;
    const isPropre = (feat.site || '').includes('propre');
    const rev = feat.revetement || '';
    const isLisse = rev === 'Lisse';
    const isRugueux = rev === 'Rugueux';
    const isMeuble = rev === 'Meuble';

    for (let i = 0; i < coords.length; i++) {
      if (stageCoords.length === 0) {
        stageCoords.push(coords[i]);
        stageRegion = feat.region;
        stageDept = feat.departement;
        continue;
      }

      const lastPt = stageCoords[stageCoords.length - 1];
      const segDist = haversineDistance(lastPt, coords[i]);

      // En mode touristique : absorber les discontinuités, ne pas couper
      // On ajoute le point mais on ne compte la distance que si < 0.5 km
      if (segDist > 0.5) {
        stageCoords.push(coords[i]);
        continue;
      }

      cumulDist += segDist;
      stageDist += segDist;
      stageCoords.push(coords[i]);

      if (isPropre) stageAttrs.propre += segDist;
      else stageAttrs.partage += segDist;
      if (isLisse) stageAttrs.lisse += segDist;
      else if (isRugueux) stageAttrs.rugueux += segDist;
      else if (isMeuble) stageAttrs.meuble += segDist;

      if (!stageRegion) stageRegion = feat.region;
      if (!stageDept) stageDept = feat.departement;

      // Couper UNIQUEMENT à la distance cumulée de l'étape touristique
      const target = cumulTargets[stageIdx];
      if (target && cumulDist >= target && stageIdx < etapesConfig.length - 1) {
        pushStage();
        stageRegion = feat.region;
        stageDept = feat.departement;
      }
    }
  });

  // Dernière étape (tout ce qui reste)
  if (stageCoords.length >= 2 && stageDist > 0.5) {
    pushStage();
  }

  // Si on a trop d'étapes (erreur de cumul), fusionner les excédentaires dans la dernière
  if (stages.length > etapesConfig.length) {
    console.warn(`Trop d'étapes (${stages.length}), fusion des excédentaires...`);
    while (stages.length > etapesConfig.length && stages.length > 1) {
      const last = stages.pop();
      const prev = stages[stages.length - 1];
      prev.geometry.coordinates.push(...last.geometry.coordinates);
      prev.properties.distance = Math.round((prev.properties.distance + last.properties.distance) * 100) / 100;
      // Recalculer les métriques
      const elev = computeElevationMetrics(prev.geometry.coordinates);
      prev.properties.elevationGain = elev.elevationGain;
      prev.properties.elevationLoss = elev.elevationLoss;
      prev.properties.numPics = elev.numPics;
      prev.properties.maxSlope = elev.maxSlope;
    }
  }

  const totalDistance = stages.reduce((sum, s) => sum + s.properties.distance, 0);

  return {
    type: 'FeatureCollection',
    features: stages,
    properties: {
      name: 'EV1 / La Vélodyssée',
      totalDistance: Math.round(totalDistance * 100) / 100,
      totalStages: stages.length
    }
  };
}
