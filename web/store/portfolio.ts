"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { normalizeSymbol } from "../lib/symbol";

export type Portfolio = { id: number; name: string };
export type Tx = {
  id: number;
  portfolioId: number;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  price: number;
  executed_at: string;
};
export type Position = { symbol: string; quantity: number; avgCost: number; realizedPnl: number };

type PortfolioState = {
  portfolios: Portfolio[];
  transactions: Tx[];
  nextId: number;
  addTransaction: (tx: Omit<Tx, "id">) => string | null;
  removeTransaction: (id: number) => void;
};

/**
 * Portfolios live in this browser's localStorage, not on the API: each
 * visitor gets their own, and the API stays stateless so it can run on
 * serverless hosts with no disk.
 */
export const usePortfolio = create<PortfolioState>()(
  persist(
    (set) => ({
      portfolios: [{ id: 1, name: "Main" }],
      transactions: [],
      nextId: 1,
      addTransaction: (tx) => {
        const symbol = normalizeSymbol(tx.symbol);
        if (!symbol) return "invalid ticker";
        if (!(tx.quantity > 0)) return "quantity must be positive";
        if (!(tx.price >= 0)) return "price must be zero or more";
        set((st) => ({
          transactions: [...st.transactions, { ...tx, symbol, id: st.nextId }],
          nextId: st.nextId + 1,
        }));
        return null;
      },
      removeTransaction: (id) =>
        set((st) => ({ transactions: st.transactions.filter((t) => t.id !== id) })),
    }),
    { name: "openterminal-portfolios" }
  )
);

/** Aggregated positions with average cost and realized PnL (average-cost method). */
export function computePositions(txs: Tx[]): Position[] {
  const sorted = [...txs].sort(
    (a, b) => a.executed_at.localeCompare(b.executed_at) || a.id - b.id
  );
  const positions = new Map<string, { qty: number; avgCost: number; realizedPnl: number }>();
  for (const tx of sorted) {
    let p = positions.get(tx.symbol);
    if (!p) {
      p = { qty: 0, avgCost: 0, realizedPnl: 0 };
      positions.set(tx.symbol, p);
    }
    if (tx.side === "BUY") {
      const totalCost = p.avgCost * p.qty + tx.price * tx.quantity;
      p.qty += tx.quantity;
      p.avgCost = p.qty > 0 ? totalCost / p.qty : 0;
    } else {
      const sold = Math.min(tx.quantity, p.qty);
      p.realizedPnl += (tx.price - p.avgCost) * sold;
      p.qty -= sold;
      if (p.qty === 0) p.avgCost = 0;
    }
  }
  return [...positions.entries()]
    .filter(([, p]) => p.qty > 0 || p.realizedPnl !== 0)
    .map(([symbol, p]) => ({ symbol, quantity: p.qty, avgCost: p.avgCost, realizedPnl: p.realizedPnl }));
}
