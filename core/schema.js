/**
 * core/schema.js
 *
 * Génère des objets Position conformes au schéma réel Base44
 * (exporté depuis entities/Position.json le 2026-06-19).
 *
 * Ce module ne touche à AUCUNE base de données réelle. Il produit uniquement
 * des objets en mémoire / fichiers JSON pour rejouer contre le classificateur.
 */

let positionCounter = 0;

function createPosition(opts) {
  positionCounter += 1;

  const {
    accountId,
    accountNumber,
    symbol,
    side,
    lots,
    openPrice,
    openedAt,
    closePrice = null,
    closedAt = null,
    closeReason = null,
  } = opts;

  const position = {
    position_id: `sim_pos_${positionCounter}`,
    account_id: accountId,
    account_number: accountNumber,
    user_email: "simulated-test@internal.toptraderprime",
    symbol,
    side,
    lots,
    open_price: openPrice,
    status: closePrice !== null ? "CLOSED" : "OPEN",
    opened_at: openedAt.toISOString(),
  };

  if (closePrice !== null) {
    position.close_price = closePrice;
    position.closed_at = closedAt ? closedAt.toISOString() : null;
    position.close_reason = closeReason || "manual";
    position.pnl = computePnl({ side, lots, openPrice, closePrice, symbol });
    position.duration_seconds = closedAt
      ? Math.round((closedAt.getTime() - openedAt.getTime()) / 1000)
      : null;
  }

  return position;
}

function computePnl({ side, lots, openPrice, closePrice, symbol }) {
  const direction = side === "BUY" ? 1 : -1;
  const priceDelta = (closePrice - openPrice) * direction;
  const pipSize = symbol.includes("JPY") ? 0.01 : 0.0001;
  const pips = priceDelta / pipSize;
  const usdPerPipPerLot = 10;
  return Math.round(pips * usdPerPipPerLot * lots * 100) / 100;
}

function priceDeltaInPips(price1, price2, symbol) {
  const pipSize = symbol.includes("JPY") ? 0.01 : 0.0001;
  return Math.abs(price1 - price2) / pipSize;
}

module.exports = {
  createPosition,
  computePnl,
  priceDeltaInPips,
};
