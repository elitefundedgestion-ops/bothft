/**
 * core/threshold_sweep.js
 *
 * Teste plusieurs combinaisons de seuils (durée, pips) sur le même jeu
 * de patterns, pour identifier la calibration qui minimise à la fois :
 *   - les faux positifs sur les patterns légitimes (EA bloqués à tort)
 *   - les faux négatifs sur les patterns d'abus (latency arbitrage non détecté)
 */

const { classifyBatch } = require("./classifier");

function sweepThresholds(patternRuns, candidateThresholds) {
  const sweepResults = candidateThresholds.map(({ durationSec, pipThreshold }) => {
    const rules = { DURATION_THRESHOLD_SEC: durationSec, PIP_THRESHOLD: pipThreshold };

    const perPattern = patternRuns.map((run) =>
      classifyBatch(run.positions, run.label, run.expected, rules)
    );

    const totalFalsePositives = perPattern.reduce((sum, r) => sum + r.falsePositives, 0);
    const totalFalseNegatives = perPattern.reduce((sum, r) => sum + r.falseNegatives, 0);

    return {
      rules,
      totalFalsePositives,
      totalFalseNegatives,
      errorScore: totalFalsePositives + totalFalseNegatives,
      perPattern: perPattern.map(({ details, patternDiagnosis, ...rest }) => rest),
    };
  });

  sweepResults.sort((a, b) => a.errorScore - b.errorScore);

  return sweepResults;
}

module.exports = { sweepThresholds };
