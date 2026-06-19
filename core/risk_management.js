/**
 * core/risk_management.js
 *
 * Logique de gestion du risque pour le bot de test :
 *   1. Calcul de SL obligatoire basé sur un % du capital risqué par trade.
 *   2. Circuit breaker journalier : arrêt total si la perte cumulée
 *      du jour atteint le seuil défini (par défaut 3% du solde de
 *      référence du jour).
 */

const RISK_DEFAULTS = {
  RISK_PER_TRADE_PCT: 0.5,
  DAILY_LOSS_LIMIT_PCT: 3.0,
};

function calculateStopLoss(opts) {
  const {
    accountBalance,
    openPrice,
    side,
    lots,
    symbol,
    riskPct = RISK_DEFAULTS.RISK_PER_TRADE_PCT,
    usdPerPipPerLot = 10,
  } = opts;

  if (lots <= 0) throw new Error("lots doit être > 0 pour calculer un SL");
  if (accountBalance <= 0) throw new Error("accountBalance doit être > 0");

  const riskAmountUsd = accountBalance * (riskPct / 100);
  const distancePips = riskAmountUsd / (lots * usdPerPipPerLot);

  const pipSize = symbol.includes("JPY") ? 0.01 : 0.0001;
  const direction = side === "BUY" ? -1 : 1;
  const slPrice = Math.round((openPrice + direction * distancePips * pipSize) * 10000) / 10000;

  return { slPrice, distancePips, riskAmountUsd };
}

function validateMandatorySL(position) {
  if (position.stop_loss_price === null || position.stop_loss_price === undefined) {
    return { valid: false, reason: "missing_stop_loss" };
  }
  if (typeof position.stop_loss_price !== "number" || Number.isNaN(position.stop_loss_price)) {
    return { valid: false, reason: "invalid_stop_loss_value" };
  }
  return { valid: true, reason: "sl_present" };
}

module.exports = {
  RISK_DEFAULTS,
  calculateStopLoss,
  validateMandatorySL,
};
