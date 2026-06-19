/**
 * core/daily_circuit_breaker.js
 *
 * Suit le P&L cumulé du jour pour un compte, et déclenche un arrêt total
 * dès que la perte atteint le seuil configuré (par défaut -3% du solde
 * de référence du jour).
 */

class DailyCircuitBreaker {
  constructor(opts) {
    const { referenceBalance, dailyLossLimitPct = 3.0 } = opts;

    if (referenceBalance <= 0) {
      throw new Error("referenceBalance doit être > 0");
    }

    this.referenceBalance = referenceBalance;
    this.dailyLossLimitPct = dailyLossLimitPct;
    this.dailyLossLimitUsd = referenceBalance * (dailyLossLimitPct / 100);

    this.cumulativePnl = 0;
    this.triggered = false;
    this.triggerLog = null;
  }

  recordClosedTrade(closedTradePnl) {
    if (this.triggered) {
      this.cumulativePnl += closedTradePnl;
      return this._status();
    }

    this.cumulativePnl += closedTradePnl;

    if (this.cumulativePnl <= -this.dailyLossLimitUsd) {
      this.triggered = true;
      this.triggerLog = {
        triggered_at: new Date().toISOString(),
        cumulative_pnl: this.cumulativePnl,
        daily_loss_limit_usd: this.dailyLossLimitUsd,
        daily_loss_limit_pct: this.dailyLossLimitPct,
        reference_balance: this.referenceBalance,
      };
    }

    return this._status();
  }

  canOpenNewPosition() {
    return !this.triggered;
  }

  emergencyFlattenAll(openPositions, pendingOrders, getCurrentPrice) {
    if (!this.triggered) {
      throw new Error("emergencyFlattenAll appelé alors que le breaker n'est pas déclenché");
    }

    const closedPositions = openPositions.map((pos) => {
      const marketPrice = getCurrentPrice(pos.symbol);
      return {
        ...pos,
        status: "CLOSED",
        close_price: marketPrice,
        closed_at: new Date().toISOString(),
        close_reason: "breach",
      };
    });

    const cancelledOrders = pendingOrders.map((order) => ({
      ...order,
      status: "failed",
      cancelled_reason: "daily_circuit_breaker_triggered",
    }));

    return { closedPositions, cancelledOrders };
  }

  _status() {
    return {
      triggered: this.triggered,
      cumulativePnl: this.cumulativePnl,
      remainingBudgetUsd: Math.max(0, this.dailyLossLimitUsd + this.cumulativePnl),
    };
  }
}

module.exports = { DailyCircuitBreaker };
