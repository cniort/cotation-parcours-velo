/**
 * Grille de cotation France Vélo Tourisme
 * Alignée sur le fichier Excel FVT recapitulatif_la-velodyssee
 *
 * Score Relief : calculé PAR TRANCHE DE 10 KM, pas sur l'étape entière
 * Score Pente : somme des scores de pente de chaque pic (0,25 si 4-8%, 0,5 si >8%)
 */

const COLORS = {
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#3b82f6',
  muted: '#6b6b80'
};

const SCORING_GRID = {
  securite: {
    label: 'Sécurité',
    description: '% voies cyclables',
    maxPoints: 3,
    compute(props) {
      const pct = props.pctSitePropre;
      if (pct >= 90) return 0;
      if (pct >= 60) return 1;
      if (pct >= 20) return 2;
      return 3;
    }
  },
  relief: {
    label: 'Relief',
    description: 'D+ par tranche 10 km',
    maxPoints: 3,
    compute(props) {
      if (props.reliefScore === undefined || props.reliefScore === null) return null;
      return props.reliefScore;
    }
  },
  pics: {
    label: 'Pics',
    description: 'Nb pics (>4%, >200m)',
    maxPoints: 3,
    compute(props) {
      if (props.numPics === undefined || props.numPics === null) return null;
      const n = props.numPics;
      if (n <= 1) return 0;
      if (n <= 3) return 1;
      if (n <= 5) return 2;
      return 3;
    }
  },
  pente: {
    label: 'Pente',
    description: '% pente des pics',
    maxPoints: 1,
    compute(props) {
      if (props.slopeScore === undefined || props.slopeScore === null) return null;
      return props.slopeScore;
    }
  },
  provisoire: {
    label: 'Provisoire',
    description: '% de provisoire',
    maxPoints: 3,
    compute() { return 0; }
  }
};

function computeStageScore(stage) {
  const props = stage.properties;
  const subScores = {};
  let total = 0;
  let maxPossible = 0;

  for (const [key, config] of Object.entries(SCORING_GRID)) {
    const points = config.compute(props);
    subScores[key] = {
      label: config.label,
      description: config.description,
      points,
      maxPoints: config.maxPoints,
      available: points !== null
    };
    if (points !== null) {
      total += points;
      maxPossible += config.maxPoints;
    }
  }

  return { total, maxPossible, category: getCategory(total, subScores.securite.points), subScores };
}

function getCategory(totalScore, securiteScore) {
  if (totalScore <= 2) {
    if (securiteScore === 0) return { name: 'Je débute / Famille', key: 'debute', color: COLORS.success };
    return { name: 'Je débute', key: 'debute', color: COLORS.success };
  }
  if (totalScore <= 6) return { name: "J'ai l'habitude", key: 'habitude', color: COLORS.warning };
  return { name: 'Aventure', key: 'aventure', color: COLORS.danger };
}

function subScoreColor(points, maxPoints) {
  if (points === null) return COLORS.muted;
  if (maxPoints === 0) return COLORS.success;
  const ratio = points / maxPoints;
  if (ratio <= 0.33) return COLORS.success;
  if (ratio <= 0.66) return COLORS.warning;
  return COLORS.danger;
}

function scoreToColor(total) {
  if (total <= 2) return COLORS.success;
  if (total <= 6) return COLORS.warning;
  return COLORS.danger;
}
