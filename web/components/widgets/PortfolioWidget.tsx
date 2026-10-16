"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { apiGet, fmt, pctClass, type Quote } from "../../lib/api";
import { symbolsParam } from "../../lib/symbol";
import { computePositions, usePortfolio } from "../../store/portfolio";

export default function PortfolioWidget() {
  const portfolios = usePortfolio((s) => s.portfolios);
  const allTxs = usePortfolio((s) => s.transactions);
  const addTransaction = usePortfolio((s) => s.addTransaction);
  const removeTransaction = usePortfolio((s) => s.removeTransaction);
  const [portfolioId, setPortfolioId] = useState<number | null>(null);
  const [showTx, setShowTx] = useState(false);
  const [form, setForm] = useState({ symbol: "", side: "BUY", quantity: "", price: "" });
  const [error, setError] = useState<string | null>(null);

  const pid = portfolioId ?? portfolios[0]?.id;

  const txs = useMemo(
    () =>
      allTxs
        .filter((t) => t.portfolioId === pid)
        .sort((a, b) => b.executed_at.localeCompare(a.executed_at) || b.id - a.id),
    [allTxs, pid]
  );
  const positions = useMemo(() => computePositions(txs), [txs]);

  const symbols = positions.map((p) => p.symbol);
  const { data: quotes = [] } = useQuery({
    queryKey: ["pf-quotes", symbols.join(",")],
    queryFn: () => apiGet<Quote[]>(`/api/quotes?symbols=${symbolsParam(symbols)}`),
    enabled: symbols.length > 0,
    refetchInterval: 30_000,
  });

  const addTx = () => {
    if (pid === undefined) return;
    const err = addTransaction({
      portfolioId: pid,
      symbol: form.symbol,
      side: form.side === "SELL" ? "SELL" : "BUY",
      quantity: Number(form.quantity),
      price: Number(form.price),
      executed_at: new Date().toISOString(),
    });
    setError(err);
    if (!err) setForm({ symbol: "", side: "BUY", quantity: "", price: "" });
  };

  const totals = positions.reduce(
    (acc, p) => {
      const q = quotes.find((x) => x.symbol === p.symbol);
      const mv = (q?.price ?? p.avgCost) * p.quantity;
      acc.marketValue += mv;
      acc.cost += p.avgCost * p.quantity;
      acc.realized += p.realizedPnl;
      return acc;
    },
    { marketValue: 0, cost: 0, realized: 0 }
  );
  const unrealized = totals.marketValue - totals.cost;

  return (
    <div>
      <div className="flex gap-2 p-1 items-center flex-wrap">
        <select value={pid ?? ""} onChange={(e) => setPortfolioId(Number(e.target.value))}>
          {portfolios.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <button className={`term-btn ${showTx ? "active" : ""}`} onClick={() => setShowTx(!showTx)}>
          TRANSACTIONS
        </button>
        <span className="ml-auto">
          MV <span className="amber">{fmt(totals.marketValue)}</span>{" "}
          <span className="dim">Unrl</span> <span className={pctClass(unrealized)}>{fmt(unrealized)}</span>{" "}
          <span className="dim">Rlzd</span> <span className={pctClass(totals.realized)}>{fmt(totals.realized)}</span>
        </span>
      </div>

      <form
        className="flex gap-1 p-1 border-b border-[var(--border)]"
        onSubmit={(e) => {
          e.preventDefault();
          if (form.symbol && form.quantity && form.price) addTx();
        }}
      >
        <input className="w-20" placeholder="Ticker" value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value.toUpperCase() })} />
        <select value={form.side} onChange={(e) => setForm({ ...form, side: e.target.value })}>
          <option>BUY</option><option>SELL</option>
        </select>
        <input className="w-20" placeholder="Qty" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
        <input className="w-24" placeholder="Price" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
        <button className="term-btn" type="submit">ADD</button>
        {error && <span className="down">{error}</span>}
      </form>

      {!showTx ? (
        <table className="data-table">
          <thead>
            <tr><th>Sym</th><th>Qty</th><th>Avg Cost</th><th>Last</th><th>Mkt Val</th><th>Unrl PnL</th><th>Rlzd PnL</th></tr>
          </thead>
          <tbody>
            {positions.map((p) => {
              const q = quotes.find((x) => x.symbol === p.symbol);
              const last = q?.price ?? null;
              const mv = last !== null ? last * p.quantity : null;
              const upnl = last !== null ? (last - p.avgCost) * p.quantity : null;
              return (
                <tr key={p.symbol}>
                  <td className="font-bold">{p.symbol}</td>
                  <td>{fmt(p.quantity, 4)}</td>
                  <td>{fmt(p.avgCost)}</td>
                  <td>{fmt(last)}</td>
                  <td>{fmt(mv)}</td>
                  <td className={pctClass(upnl)}>{fmt(upnl)}</td>
                  <td className={pctClass(p.realizedPnl)}>{fmt(p.realizedPnl)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <table className="data-table">
          <thead>
            <tr><th>Date</th><th>Sym</th><th>Side</th><th>Qty</th><th>Price</th><th></th></tr>
          </thead>
          <tbody>
            {txs.map((t) => (
              <tr key={t.id}>
                <td className="!text-left dim">{new Date(t.executed_at).toLocaleDateString()}</td>
                <td className="font-bold">{t.symbol}</td>
                <td className={t.side === "BUY" ? "up" : "down"}>{t.side}</td>
                <td>{fmt(t.quantity, 4)}</td>
                <td>{fmt(t.price)}</td>
                <td>
                  <button
                    className="dim hover:text-[var(--down)]"
                    onClick={() => removeTransaction(t.id)}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
