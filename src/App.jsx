import React, { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

function parseMoney(value) {
  if (value === null || value === undefined) return 0;
  return Number(String(value).replace(/[$,]/g, "").trim()) || 0;
}

function parseNumber(value) {
  if (value === null || value === undefined) return 0;
  return Number(String(value).replace(/,/g, "").trim()) || 0;
}

function cleanText(value) {
  return String(value || "").trim();
}

function titleCase(value) {
  const text = cleanText(value).toLowerCase();
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function uniqueSorted(values) {
  return [...new Set(values)].filter(Boolean).sort((a, b) => a.localeCompare(b));
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

const money = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 0,
});

const numberFmt = new Intl.NumberFormat("en-CA", {
  maximumFractionDigits: 0,
});

export default function App() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedMake, setSelectedMake] = useState("ALL");
  const [selectedModel, setSelectedModel] = useState("ALL");
  const [selectedTrim, setSelectedTrim] = useState("ALL");
  const [selectedMarkets, setSelectedMarkets] = useState([]);

  useEffect(() => {
    Papa.parse("/all_cars.csv", {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const cleaned = results.data
            .map((row, index) => ({
              id: `${index}-${cleanText(row.vin) || "row"}`,
              year: parseNumber(row.year),
              make: cleanText(row.make).toUpperCase(),
              model: cleanText(row.model),
              trim: cleanText(row.trim),
              vin: cleanText(row.vin),
              odometer: parseNumber(row.odometer),
              grade: parseNumber(row.grade),
              price: parseMoney(row.price),
              province: titleCase(row.province),

              claim: parseNumber(row.claim),
              estimate: parseNumber(row.estimate),
              history_report: parseNumber(row.history_report),
              glass_record: parseNumber(row.glass_record),
              repair: parseNumber(row.repair),
              previous_repair: parseNumber(row.previous_repair),
              accident_repair: parseNumber(row.accident_repair),
              additional_repair: parseNumber(row.additional_repair),
              rebuild: parseNumber(row.rebuild),
              total_disclosure_amount: parseNumber(row.total_disclosure_amount),
            }))
            .filter(
              (row) =>
                row.make &&
                row.model &&
                row.trim &&
                row.province &&
                row.price > 0
            );

          setData(cleaned);
          setLoading(false);
        } catch (err) {
          console.error(err);
          setError("Failed to clean CSV data.");
          setLoading(false);
        }
      },
      error: (err) => {
        console.error(err);
        setError("Failed to load all_cars.csv");
        setLoading(false);
      },
    });
  }, []);

  const makeOptions = useMemo(() => {
    return uniqueSorted(data.map((row) => row.make));
  }, [data]);

  const modelOptions = useMemo(() => {
    const rows =
      selectedMake === "ALL"
        ? data
        : data.filter((row) => row.make === selectedMake);

    return uniqueSorted(rows.map((row) => row.model));
  }, [data, selectedMake]);

  const trimOptions = useMemo(() => {
    const rows = data.filter(
      (row) =>
        (selectedMake === "ALL" || row.make === selectedMake) &&
        (selectedModel === "ALL" || row.model === selectedModel)
    );

    return uniqueSorted(rows.map((row) => row.trim));
  }, [data, selectedMake, selectedModel]);

  const marketOptions = useMemo(() => {
    return uniqueSorted(data.map((row) => row.province));
  }, [data]);

  const activeMarkets = selectedMarkets.length ? selectedMarkets : marketOptions;

  const filteredRows = useMemo(() => {
    return data.filter(
      (row) =>
        (selectedMake === "ALL" || row.make === selectedMake) &&
        (selectedModel === "ALL" || row.model === selectedModel) &&
        (selectedTrim === "ALL" || row.trim === selectedTrim) &&
        activeMarkets.includes(row.province)
    );
  }, [data, selectedMake, selectedModel, selectedTrim, activeMarkets]);

  const marketSummary = useMemo(() => {
    return activeMarkets
      .map((market) => {
        const rows = filteredRows.filter((row) => row.province === market);
        const prices = rows.map((row) => row.price).filter((v) => v > 0);
        const odometers = rows.map((row) => row.odometer).filter((v) => v > 0);
        const grades = rows.map((row) => row.grade).filter((v) => v > 0);

        return {
          market,
          listings: rows.length,
          medianPrice: median(prices),
          avgPrice: average(prices),
          minPrice: prices.length ? Math.min(...prices) : 0,
          maxPrice: prices.length ? Math.max(...prices) : 0,
          avgOdometer: average(odometers),
          avgGrade: average(grades),
        };
      })
      .filter((item) => item.listings > 0)
      .sort((a, b) => a.medianPrice - b.medianPrice);
  }, [filteredRows, activeMarkets]);

  const bestRoutes = useMemo(() => {
    const routes = [];

    for (let i = 0; i < marketSummary.length; i += 1) {
      for (let j = 0; j < marketSummary.length; j += 1) {
        if (i === j) continue;

        const buy = marketSummary[i];
        const sell = marketSummary[j];
        const spread = sell.medianPrice - buy.medianPrice;

        if (spread > 0) {
          routes.push({
            buyMarket: buy.market,
            sellMarket: sell.market,
            buyMedian: buy.medianPrice,
            sellMedian: sell.medianPrice,
            spread,
          });
        }
      }
    }

    return routes.sort((a, b) => b.spread - a.spread);
  }, [marketSummary]);

  const bestRoute = bestRoutes[0] || null;
  const cheapestMarket = marketSummary[0] || null;
  const strongestMarket = marketSummary[marketSummary.length - 1] || null;

  const chartData = useMemo(() => {
    return marketSummary.map((item) => ({
      market: item.market,
      medianPrice: item.medianPrice,
      avgPrice: item.avgPrice,
    }));
  }, [marketSummary]);

  const vehicleLabel = useMemo(() => {
    const parts = [selectedMake, selectedModel, selectedTrim].filter(
      (item) => item !== "ALL"
    );
    return parts.length ? parts.join(" • ") : "All vehicles";
  }, [selectedMake, selectedModel, selectedTrim]);

  function toggleMarket(market) {
    setSelectedMarkets((prev) => {
      if (prev.includes(market)) {
        return prev.filter((item) => item !== market);
      }

      const next = [...prev, market];

      if (next.length === marketOptions.length) {
        return [];
      }

      return next;
    });
  }

  function resetFilters() {
    setSelectedMake("ALL");
    setSelectedModel("ALL");
    setSelectedTrim("ALL");
    setSelectedMarkets([]);
  }

  if (loading) {
    return (
      <div style={{ padding: 40, fontFamily: "Arial" }}>
        <h2>Loading CSV data...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 40, fontFamily: "Arial", color: "red" }}>
        <h2>{error}</h2>
      </div>
    );
  }

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body {
          margin: 0;
          font-family: Inter, Arial, sans-serif;
          background: #f8fafc;
          color: #0f172a;
        }
        .page {
          min-height: 100vh;
          padding: 24px;
          background:
            radial-gradient(circle at top right, rgba(37,99,235,0.08), transparent 22%),
            linear-gradient(180deg, #f8fafc 0%, #f8fafc 100%);
        }
        .container {
          max-width: 1400px;
          margin: 0 auto;
        }
        .hero {
          background: linear-gradient(135deg, #020617 0%, #0f172a 55%, #1d4ed8 100%);
          color: white;
          border-radius: 26px;
          padding: 28px;
          box-shadow: 0 12px 35px rgba(15,23,42,0.10);
        }
        .hero-badge {
          display: inline-block;
          background: rgba(255,255,255,0.12);
          padding: 8px 14px;
          border-radius: 999px;
          font-size: 13px;
          margin-bottom: 18px;
        }
        .hero h1 {
          margin: 0 0 12px;
          font-size: 36px;
          line-height: 1.15;
        }
        .hero p {
          margin: 0;
          color: rgba(255,255,255,0.86);
          line-height: 1.7;
        }
        .hero-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 18px;
        }
        .tag {
          background: rgba(255,255,255,0.12);
          border-radius: 999px;
          padding: 8px 13px;
          font-size: 13px;
        }
        .card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 22px;
          padding: 22px;
          box-shadow: 0 10px 30px rgba(15,23,42,0.06);
        }
        .section-title {
          font-size: 22px;
          font-weight: 700;
          margin-bottom: 8px;
        }
        .section-subtitle {
          color: #64748b;
          line-height: 1.6;
          margin-bottom: 18px;
        }
        .top-grid {
          display: grid;
          grid-template-columns: 1.2fr 0.8fr;
          gap: 20px;
          margin-bottom: 20px;
        }
        .filters-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
          margin-bottom: 18px;
        }
        .field label {
          display: block;
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 8px;
        }
        .field select {
          width: 100%;
          border: 1px solid #dbe2ea;
          border-radius: 14px;
          padding: 12px 14px;
          background: white;
          font-size: 14px;
        }
        .market-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 10px;
        }
        .chips {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }
        .chip {
          border: 1px solid #dbe2ea;
          background: white;
          color: #0f172a;
          border-radius: 999px;
          padding: 10px 14px;
          cursor: pointer;
          transition: 0.2s ease;
        }
        .chip:hover {
          background: #f1f5f9;
        }
        .chip.active {
          background: #0f172a;
          color: white;
          border-color: #0f172a;
        }
        .reset-btn {
          border: 1px solid #dbe2ea;
          background: white;
          border-radius: 999px;
          padding: 10px 14px;
          cursor: pointer;
          font-weight: 600;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-bottom: 20px;
        }
        .stat {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          padding: 20px;
          box-shadow: 0 10px 30px rgba(15,23,42,0.06);
        }
        .stat-title {
          color: #64748b;
          font-size: 14px;
        }
        .stat-value {
          font-size: 28px;
          font-weight: 700;
          margin-top: 10px;
          line-height: 1.2;
        }
        .stat-hint {
          color: #64748b;
          font-size: 14px;
          margin-top: 10px;
          line-height: 1.6;
        }
        .main-grid {
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          gap: 20px;
          margin-bottom: 20px;
        }
        .chart-box {
          height: 380px;
        }
        .routes {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .route-card {
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          padding: 16px;
          background: #fff;
        }
        .route-top {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: flex-start;
        }
        .route-rank {
          color: #64748b;
          font-size: 13px;
        }
        .route-name {
          font-size: 20px;
          font-weight: 700;
          margin-top: 6px;
        }
        .route-profit {
          background: #ecfdf5;
          color: #047857;
          border-radius: 999px;
          padding: 8px 12px;
          font-weight: 700;
          white-space: nowrap;
        }
        .route-grid {
          margin-top: 14px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .route-box {
          background: #f8fafc;
          border-radius: 14px;
          padding: 12px;
        }
        .route-label {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #64748b;
        }
        .route-value {
          margin-top: 6px;
          font-weight: 600;
        }
        .table-wrap {
          overflow: hidden;
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          background: white;
        }
        .table-head, .table-row {
          display: grid;
          grid-template-columns: 1.2fr 0.8fr 1fr 1fr 1fr 0.8fr;
          gap: 12px;
          padding: 14px 16px;
          align-items: center;
        }
        .table-head {
          background: #f1f5f9;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #64748b;
        }
        .table-row {
          border-top: 1px solid #e2e8f0;
          font-size: 14px;
        }
        .strong {
          font-weight: 700;
        }
        .note-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 22px;
          padding: 22px;
          margin-bottom: 20px;
          box-shadow: 0 10px 30px rgba(15,23,42,0.06);
        }
        .note-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
          margin-top: 14px;
        }
        .note-box {
          background: #f8fafc;
          border-radius: 16px;
          padding: 16px;
          line-height: 1.6;
        }
        .empty {
          border: 1px dashed #cbd5e1;
          border-radius: 18px;
          padding: 22px;
          color: #64748b;
          text-align: center;
          background: #fff;
        }
        @media (max-width: 1200px) {
          .top-grid,
          .main-grid,
          .stats-grid,
          .note-grid,
          .filters-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="page">
        <div className="container">
             <div className="note-card">
            <div className="section-title">How to use it</div>

            <div className="note-grid">
              <div className="note-box">
                <strong>1. Pick the car</strong>
                <div>Choose make, model, and trim to isolate the exact vehicle.</div>
              </div>

              <div className="note-box">
                <strong>2. Compare markets</strong>
                <div>Select one or more provinces or cities from your CSV.</div>
              </div>

              <div className="note-box">
                <strong>3. Follow the spread</strong>
                <div>Buy from the lowest median market and sell in the highest one.</div>
              </div>
            </div>
          </div>
          <div className="top-grid">
            <div className="hero">
              <div className="hero-badge">Vehicle Market Profit Dashboard</div>
              <h1>Compare buy market and resale market for the same car.</h1>
              <p>
                Select make, model, trim, and one or more provinces or cities from
                your CSV. The dashboard shows the lowest market, the strongest
                resale market, and the best possible price spread.
              </p>

              <div className="hero-tags">
                <span className="tag">{vehicleLabel}</span>
                {activeMarkets.map((market) => (
                  <span key={market} className="tag">
                    {market}
                  </span>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="section-title">Filters</div>
              <div className="section-subtitle">
                Choose the exact vehicle and the markets you want to compare.
              </div>

              <div className="filters-grid">
                <div className="field">
                  <label>Make</label>
                  <select
                    value={selectedMake}
                    onChange={(e) => {
                      setSelectedMake(e.target.value);
                      setSelectedModel("ALL");
                      setSelectedTrim("ALL");
                    }}
                  >
                    <option value="ALL">All makes</option>
                    {makeOptions.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label>Model</label>
                  <select
                    value={selectedModel}
                    onChange={(e) => {
                      setSelectedModel(e.target.value);
                      setSelectedTrim("ALL");
                    }}
                  >
                    <option value="ALL">All models</option>
                    {modelOptions.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label>Trim</label>
                  <select
                    value={selectedTrim}
                    onChange={(e) => setSelectedTrim(e.target.value)}
                  >
                    <option value="ALL">All trims</option>
                    {trimOptions.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="market-header">
                <strong>Province / Market</strong>
                <button className="reset-btn" onClick={resetFilters}>
                  Reset
                </button>
              </div>

              <div className="chips">
                <button
                  className={`chip ${selectedMarkets.length === 0 ? "active" : ""}`}
                  onClick={() => setSelectedMarkets([])}
                >
                  All markets
                </button>

                {marketOptions.map((market) => (
                  <button
                    key={market}
                    className={`chip ${selectedMarkets.includes(market) ? "active" : ""}`}
                    onClick={() => toggleMarket(market)}
                  >
                    {market}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="stats-grid">
            <div className="stat">
              <div className="stat-title">Matching listings</div>
              <div className="stat-value">{numberFmt.format(filteredRows.length)}</div>
              <div className="stat-hint">
                Rows that match the current make / model / trim / market filters.
              </div>
            </div>

            <div className="stat">
              <div className="stat-title">Cheapest market</div>
              <div className="stat-value">
                {cheapestMarket
                  ? `${cheapestMarket.market} • ${money.format(cheapestMarket.medianPrice)}`
                  : "—"}
              </div>
              <div className="stat-hint">Lowest median asking price.</div>
            </div>

            <div className="stat">
              <div className="stat-title">Best resale market</div>
              <div className="stat-value">
                {strongestMarket
                  ? `${strongestMarket.market} • ${money.format(strongestMarket.medianPrice)}`
                  : "—"}
              </div>
              <div className="stat-hint">Highest median asking price.</div>
            </div>

            <div className="stat">
              <div className="stat-title">Top spread</div>
              <div className="stat-value">
                {bestRoute ? money.format(bestRoute.spread) : "—"}
              </div>
              <div className="stat-hint">
                {bestRoute
                  ? `Buy in ${bestRoute.buyMarket}, sell in ${bestRoute.sellMarket}.`
                  : "Choose at least two markets with matching data."}
              </div>
            </div>
          </div>

          <div className="main-grid">
            <div className="card">
              <div className="section-title">Median vs average price by market</div>
              <div className="section-subtitle">
                Quick comparison of where the selected vehicle is cheaper or stronger.
              </div>

              <div className="chart-box">
                {chartData.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="market" tickLine={false} axisLine={false} />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `$${Math.round(value / 1000)}k`}
                      />
                      <Tooltip formatter={(value) => money.format(value)} />
                      <Legend />
                      <Bar dataKey="medianPrice" name="Median price" fill="#0f172a" radius={[10, 10, 0, 0]} />
                      <Bar dataKey="avgPrice" name="Average price" fill="#2563eb" radius={[10, 10, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="empty">No chart data available.</div>
                )}
              </div>
            </div>

            <div className="card">
              <div className="section-title">Best trade routes</div>
              <div className="section-subtitle">
                Estimated spread between buy median and sell median.
              </div>

              {bestRoutes.length ? (
                <div className="routes">
                  {bestRoutes.slice(0, 6).map((route, index) => (
                    <div className="route-card" key={`${route.buyMarket}-${route.sellMarket}-${index}`}>
                      <div className="route-top">
                        <div>
                          <div className="route-rank">Route #{index + 1}</div>
                          <div className="route-name">
                            {route.buyMarket} → {route.sellMarket}
                          </div>
                        </div>
                        <div className="route-profit">
                          {money.format(route.spread)}
                        </div>
                      </div>

                      <div className="route-grid">
                        <div className="route-box">
                          <div className="route-label">Buy median</div>
                          <div className="route-value">
                            {route.buyMarket} • {money.format(route.buyMedian)}
                          </div>
                        </div>

                        <div className="route-box">
                          <div className="route-label">Sell median</div>
                          <div className="route-value">
                            {route.sellMarket} • {money.format(route.sellMedian)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty">
                  No profitable routes found. This usually means you only have one
                  market in the filtered data, or the selected filters are too narrow.
                </div>
              )}
            </div>
          </div>

          <div className="card" style={{ marginBottom: 20 }}>
            <div className="section-title">Market snapshot</div>
            <div className="section-subtitle">
              Summary table for the selected vehicle across the chosen markets.
            </div>

            {marketSummary.length ? (
              <div className="table-wrap">
                <div className="table-head">
                  <div>Market</div>
                  <div>Listings</div>
                  <div>Median</div>
                  <div>Average</div>
                  <div>Avg KM</div>
                  <div>Avg Grade</div>
                </div>

                {marketSummary.map((row) => (
                  <div className="table-row" key={row.market}>
                    <div className="strong">{row.market}</div>
                    <div>{numberFmt.format(row.listings)}</div>
                    <div className="strong">{money.format(row.medianPrice)}</div>
                    <div>{money.format(row.avgPrice)}</div>
                    <div>{row.avgOdometer ? numberFmt.format(row.avgOdometer) : "—"}</div>
                    <div>{row.avgGrade ? row.avgGrade.toFixed(2) : "—"}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty">No rows matched the current filters.</div>
            )}
          </div>

       
        </div>
      </div>
    </>
  );
}