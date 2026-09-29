// Score, stage and archetype from metrics + config/scoring.json. Pure functions.

export const clamp01 = (x) => Math.min(1, Math.max(0, x));

/** Linear ramp: 0 at `from`, 1 at `to`. */
export function linear(value, from, to) {
  if (to === from) return value >= to ? 1 : 0;
  return clamp01((value - from) / (to - from));
}

export function scoreMetrics(metrics, windowDays, config) {
  const breakdown = [];
  let earned = 0;
  let possible = 0;

  for (const [key, c] of Object.entries(config.criteria)) {
    const missingPart = c.parts.find((p) => !metrics[p.metric] || !metrics[p.metric].available);
    if (missingPart) {
      breakdown.push({
        key,
        label: c.label,
        points: c.points,
        available: false,
        reason: metrics[missingPart.metric] ? metrics[missingPart.metric].reason : 'not computed',
      });
      continue;
    }
    const totalWeight = c.parts.reduce((s, p) => s + p.weight, 0);
    let ratio = 0;
    const parts = c.parts.map((p) => {
      const to = p.capToWindow ? Math.min(p.to, windowDays) : p.to;
      const r = linear(metrics[p.metric].value, p.from, to);
      ratio += (r * p.weight) / totalWeight;
      return { metric: p.metric, value: metrics[p.metric].value, from: p.from, to, ratio: r };
    });
    const pts = ratio * c.points;
    earned += pts;
    possible += c.points;
    breakdown.push({ key, label: c.label, points: c.points, available: true, ratio, earned: pts, parts });
  }

  const maxPoints = Object.values(config.criteria).reduce((s, c) => s + c.points, 0);
  const total = possible > 0 ? Math.round((earned / possible) * 100) : 0;
  return {
    total,
    earnedPoints: earned,
    availablePoints: possible,
    maxPoints,
    renormalized: possible < maxPoints,
    breakdown,
  };
}

export function stageFor(total, config) {
  const s = config.stages.find((st) => total <= st.max);
  return s ? s.stage : config.stages[config.stages.length - 1].stage;
}

/** Dominant criterion = highest ratio; ties go to the criterion worth more points. */
export function archetypeFor(breakdown, config) {
  const ranked = breakdown
    .filter((b) => b.available)
    .sort((a, b) => b.ratio - a.ratio || b.points - a.points);
  const top = ranked[0];
  if (!top || top.ratio < config.archetypes.minRatio) {
    return { slug: config.archetypes.fallback, dominant: top ? top.key : null };
  }
  return { slug: config.criteria[top.key].archetype, dominant: top.key };
}
