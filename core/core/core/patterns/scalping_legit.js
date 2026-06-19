/**
 * patterns/scalping_legit.js
 *
 * Simule un EA de scalping LÉGITIME : trades fréquents mais basés sur une
 * logique de signal réelle, avec une durée de détention et une amplitude
 * de mouvement réalistes (plusieurs minutes, plusieurs pips de cible).
 */

const { createPosition } = require("../core/schema");

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function generateScalpingLegit(opts = {}) {
  const {
    count = 30,
    symbol = "EURUSD",
    startTime = new Date("2026-06-19T08:00:00Z"),
  } = opts;

  const positions = [];
  let currentTime = new Date(startTime);
  let basePrice = 1.0500;

  for (let i = 0; i < count; i++) {
    basePrice += randomBetween(-0.0008, 0.0008);

    const side = Math.random() > 0.5 ? "BUY" : "SELL";
    const lots = Math.round(randomBetween(0.05, 0.3) * 100) / 100;
    const openPrice = Math.round(basePrice * 10000) / 10000;

    const openedAt = new Date(currentTime);

    const holdSeconds = Math.round(randomBetween(180, 1500));
    const closedAt = new Date(openedAt.getTime() + holdSeconds * 1000);

    const targetPips = randomBetween(3, 12);
    const pipSize = symbol.includes("JPY") ? 0.01 : 0.0001;
    const direction = side === "BUY" ? 1 : -1;
    const isWin = Math.random() < 0.8;
    const signedPips = isWin ? targetPips : -randomBetween(2, 8);
    const closePrice = Math.round(
      (openPrice + direction * signedPips * pipSize) * 10000
    ) / 10000;

    positions.push(
      createPosition({
        accountId: "test_acc_scalping_legit",
        accountNumber: "TTP-TEST-SCALP-001",
        symbol,
        side,
        lots,
        openPrice,
        openedAt,
        closePrice,
        closedAt,
        closeReason: "take_profit",
      })
    );

    currentTime = new Date(closedAt.getTime() + randomBetween(30, 300) * 1000);
  }

  return positions;
}

module.exports = { generateScalpingLegit };
