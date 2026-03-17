/**
 * Donuts SVG style Lighthouse — sans glow, sobre
 */

function createDonutSVG(value, max, color, size = 80, label = '') {
  const isAvailable = value !== null;
  const displayValue = isAvailable ? String(value).replace('.', ',') : '—';
  const ratio = isAvailable ? (max > 0 ? value / max : 0) : 0;

  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeLen = circumference * ratio;
  const gapLen = circumference - strokeLen;

  let fontSize, strokeWidth;
  if (size >= 100) { fontSize = 30; strokeWidth = 8; }
  else if (size >= 72) { fontSize = 26; strokeWidth = 7; }
  else if (size >= 60) { fontSize = 22; strokeWidth = 7; }
  else if (size >= 40) { fontSize = 24; strokeWidth = 6; }
  else { fontSize = 22; strokeWidth = 5; }

  return `
    <div class="donut-container" style="width:${size}px; height:${size + (label ? 22 : 0)}px;">
      <svg viewBox="0 0 100 100" width="${size}" height="${size}" class="donut-svg">
        <circle cx="50" cy="50" r="${radius}"
          fill="none"
          stroke="var(--donut-bg, rgba(255,255,255,0.08))"
          stroke-width="${strokeWidth}" />
        <circle cx="50" cy="50" r="${radius}"
          fill="none"
          stroke="${isAvailable ? color : 'var(--text-muted, #555)'}"
          stroke-width="${strokeWidth}"
          stroke-linecap="round"
          stroke-dasharray="${strokeLen} ${gapLen}"
          stroke-dashoffset="${circumference * 0.25}"
          class="donut-arc" />
        <text x="50" y="50" text-anchor="middle" dominant-baseline="central"
          fill="var(--text-primary, #fff)"
          font-size="${fontSize}" font-weight="800"
          font-family="Inter, -apple-system, sans-serif">
          ${displayValue}
        </text>
      </svg>
      ${label ? `<div class="donut-label">${label}</div>` : ''}
    </div>
  `;
}

function createTotalDonutSVG(score) {
  return `
    <div class="total-donut-wrapper">
      ${createDonutSVG(score.total, score.maxPossible, score.category.color, 120)}
      <div class="total-category" style="color: ${score.category.color};">
        <span class="category-name">${score.category.name}</span>
      </div>
    </div>
  `;
}

function createSubScoresHTML(score) {
  let html = '<div class="subscores-grid">';
  for (const [key, sub] of Object.entries(score.subScores)) {
    const color = subScoreColor(sub.points, sub.maxPoints);
    html += `
      <div class="subscore-item ${sub.available ? '' : 'subscore-unavailable'}">
        ${createDonutSVG(sub.points, sub.maxPoints, color, 60, sub.label)}
        <div class="subscore-desc">${sub.description}</div>
      </div>
    `;
  }
  return html + '</div>';
}

function createStageDetailHTML(stage, score) {
  const props = stage.properties;
  const color = score.category.color;
  return `
    <div class="stage-detail-panel">
      <div class="detail-top">
        ${createTotalDonutSVG(score)}
        <div class="detail-info">
          <h3>${props.name}</h3>
          <div class="detail-badge" style="background:${color};">
            ${score.category.name}
          </div>
          <div class="detail-meta-line">${String(props.distance).replace('.', ',')} km · ${props.departement} · ${props.region}</div>
          <div class="detail-meta-line">${props.pctSitePropre}% site propre</div>
          ${props.elevationGain !== null ? `<div class="detail-meta-line">D+ ${props.elevationGain}m · D- ${props.elevationLoss}m · ${props.numPics} pic${props.numPics > 1 ? 's' : ''} · pente max ${String(props.maxSlope).replace('.', ',')}%</div>` : ''}
        </div>
      </div>
      ${createSubScoresHTML(score)}
    </div>
  `;
}
