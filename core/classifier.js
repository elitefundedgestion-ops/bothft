/**
 * core/classifier.js
 *
 * Applique les règles de détection actuellement utilisées par TopTraderPrime
 * (telles que documentées : duration ≤60-100s ET variation ≤1.5 pips
 * = trade suspect / HFT interdit).
 */

const { priceDeltaInPips } = require("./schema");

const CURRENT_RULES = {
  DURATION_THRESHOLD_SEC: 100,
  PIP_THRESHOLD: 1.5,
};

function classifyPosition(position, rules = CURRENT_RULES) {
  if (position.status !== "CLOSED") {
    return {
      verdict: "ALLOWED",
      reason: "position_still_open",
      metrics: {},
    };
  }

  const durationSec = position.duration_seconds;
  const pipDelta = priceDeltaInPips(
    position.open_price,
    position.close_price,
    position.symbol
  );

  const isFastTrade = durationSec !== null && durationSec <= rules.DURATION_THRESHOLD_SEC;
  const isTinyMove = pipDelta <= rules.PIP_THRESHOLD;

  const metrics = { durationSec, pipDelta };

  if (isFastTrade && isTinyMove) {
    return {
      verdict: "FLAGGED",
      reason: `fast_trade_tiny_move (duration=${durationSec}s <= ${rules.DURATION_THRESHOLD_SEC}s, pips=${pipDelta.toFixed(2)} <= ${rules.PIP_THRESHOLD})`,
      metrics,
    };
  }

  return {
    verdict: "ALLOWED",
    reason: "within_normal_parameters",
    metrics,
  };
}

function classifyBatch(positions, patternLabel, expectedCategory, rules = CURRENT_RULES) {
  const closedPositions = positions.filter((p) => p.status === "CLOSED");

  const results = closedPositions.map((p) => ({
    position_id: p.position_id,
    ...classifyPosition(p, rules),
  }));

  const flaggedCount = results.filter((r) => r.verdict === "FLAGGED").length;
  const allowedCount = results.filter((r) => r.verdict === "ALLOWED").length;

  let falsePositives = 0;
  let falseNegatives = 0;

  if (expectedCategory === "legit") {
    falsePositives = flaggedCount;
  } else if (expectedCategory === "abuse") {
    falseNegatives = allowedCount;
  }

  const patternDiagnosis = detectDisguisedPatternInBatch(closedPositions, results, rules);

  const caughtByPatternOnly =
    expectedCategory === "abuse" && falseNegatives > 0 && patternDiagnosis.patternFlag;

  return {
    pattern: patternLabel,
    expectedCategory,
    totalClosedTrades: closedPositions.length,
    flaggedCount,
    allowedCount,
    falsePositives,
    falseNegatives,
    flagRate: closedPositions.length > 0 ? flaggedCount / closedPositions.length : 0,
    patternDiagnosis,
    caughtByPatternOnly,
    details: results,
  };
}

const PATTERN_RULES = {
  MIN_TRADES_FOR_PATTERN_CHECK: 5,
  TINY_MOVE_RATIO_THRESHOLD: 0.7,
  DURATION_NEAR_THRESHOLD_MARGIN_SEC: 60,
};

function detectDisguisedPatternInBatch(positions, classificationResults, rules = CURRENT_RULES, patternRules = PATTERN_RULES) {
  const closedResults = classificationResults.filter((r) => r.metrics && r.metrics.pipDelta !== undefined);

  if (closedResults.length < patternRules.MIN_TRADES_FOR_PATTERN_CHECK) {
    return { patternFlag: false, reason: "not_enough_trades_to_assess_pattern" };
  }

  const tinyMoveCount = closedResults.filter(
    (r) => r.metrics.pipDelta <= rules.PIP_THRESHOLD
  ).length;
  const tinyMoveRatio = tinyMoveCount / closedResults.length;

  const nearThresholdCount = closedResults.filter(
    (r) =>
      r.metrics.durationSec > rules.DURATION_THRESHOLD_SEC &&
      r.metrics.durationSec <= rules.DURATION_THRESHOLD_SEC + patternRules.DURATION_NEAR_THRESHOLD_MARGIN_SEC
  ).length;
  const nearThresholdRatio = nearThresholdCount / closedResults.length;

  const suspicious =
    tinyMoveRatio >= patternRules.TINY_MOVE_RATIO_THRESHOLD &&
    nearThresholdRatio >= patternRules.TINY_MOVE_RATIO_THRESHOLD;

  return {
    patternFlag: suspicious,
    reason: suspicious
      ? `pattern_suspect: ${(tinyMoveRatio * 100).toFixed(0)}% des trades ont un mouvement <=${rules.PIP_THRESHOLD} pips et ${(nearThresholdRatio * 100).toFixed(0)}% ont une durée juste au-dessus du seuil (${rules.DURATION_THRESHOLD_SEC}-${rules.DURATION_THRESHOLD_SEC + patternRules.DURATION_NEAR_THRESHOLD_MARGIN_SEC}s)`
      : "no_suspicious_pattern_detected",
    tinyMoveRatio,
    nearThresholdRatio,
  };
}

module.exports = {
  CURRENT_RULES,
  PATTERN_RULES,
  classifyPosition,
  classifyBatch,
  detectDisguisedPatternInBatch,
};
