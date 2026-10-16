"use client";

import React, { useState } from "react";
import { TrendingUp, PieChart, Activity, Layers, ArrowUpRight, ArrowDownRight } from "lucide-react";

export type TrendPoint = {
  label: string;
  subLabel: string;
  income: number;
  expense: number;
};

export type CategorySlice = {
  name: string;
  amount: number;
  color: string;
  percentage: number;
};

export type CashFlowStatus = {
  income: number;
  expense: number;
  net: number;
  currency: string;
};

export function InteractiveChartsSuite({
  trendData,
  categoryData,
  cashFlow,
  currency,
}: {
  trendData: TrendPoint[];
  categoryData: CategorySlice[];
  cashFlow: CashFlowStatus;
  currency: string;
}) {
  const [activeTab, setActiveTab] = useState<"line" | "pie" | "circle">("line");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const formatMoney = (val: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "NPR",
      maximumFractionDigits: 0,
    }).format(val);

  // SVG Line Chart Dimensions & Computations
  const width = 560;
  const height = 180;
  const padding = 28;

  const maxVal = Math.max(1, ...trendData.flatMap((d) => [d.income, d.expense]));
  const pointsIncome = trendData.map((d, i) => {
    const x = padding + (i / Math.max(1, trendData.length - 1)) * (width - padding * 2);
    const y = height - padding - (d.income / maxVal) * (height - padding * 2);
    return { x, y, ...d };
  });

  const pointsExpense = trendData.map((d, i) => {
    const x = padding + (i / Math.max(1, trendData.length - 1)) * (width - padding * 2);
    const y = height - padding - (d.expense / maxVal) * (height - padding * 2);
    return { x, y, ...d };
  });

  const createSmoothPath = (pts: { x: number; y: number }[]) => {
    if (pts.length === 0) return "";
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
    return pts.reduce((acc, pt, i, arr) => {
      if (i === 0) return `M ${pt.x} ${pt.y}`;
      const prev = arr[i - 1];
      const cx = (prev.x + pt.x) / 2;
      return `${acc} C ${cx} ${prev.y}, ${cx} ${pt.y}, ${pt.x} ${pt.y}`;
    }, "");
  };

  const incomeLinePath = createSmoothPath(pointsIncome);
  const expenseLinePath = createSmoothPath(pointsExpense);

  const incomeAreaPath =
    pointsIncome.length > 0
      ? `${incomeLinePath} L ${pointsIncome[pointsIncome.length - 1].x} ${height - padding} L ${pointsIncome[0].x} ${height - padding} Z`
      : "";

  // Circle (Donut) Geometry
  const circleSize = 160;
  const strokeWidth = 20;
  const radius = (circleSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Pie & Donut Angle Calculations
  let accumulatedAngle = 0;
  const pieSlices = categoryData.map((cat) => {
    const strokeDasharray = `${(cat.percentage / 100) * circumference} ${circumference}`;
    const strokeDashoffset = -(accumulatedAngle / 100) * circumference;
    accumulatedAngle += cat.percentage;
    return {
      ...cat,
      strokeDasharray,
      strokeDashoffset,
    };
  });

  // Circle Meter Progress: Inflow vs Outflow Ratio
  const totalFlow = (cashFlow.income || 0) + (cashFlow.expense || 0);
  const incomeRatio = totalFlow > 0 ? (cashFlow.income / totalFlow) * 100 : 50;
  const expenseRatio = totalFlow > 0 ? (cashFlow.expense / totalFlow) * 100 : 50;
  const circleDasharray = `${(incomeRatio / 100) * circumference} ${circumference}`;

  return (
    <div className="panel" style={{ height: "100%", display: "flex", flexDirection: "column", gap: 14 }}>
      {/* HEADER WITH TABS */}
      <div className="panel-head" style={{ paddingBottom: 10, borderBottom: "1px solid var(--line)" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Activity size={16} style={{ color: "var(--brand)" }} />
            <h3 style={{ margin: 0, fontSize: 14 }}>Operational Analytics &amp; Visual Flow</h3>
          </div>
          <span style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
            Interactive vector charts with animated curves &amp; category breakdowns
          </span>
        </div>

        {/* Chart View Switcher */}
        <div style={{ display: "flex", alignItems: "center", background: "var(--soft)", padding: 2, borderRadius: 6, border: "1px solid var(--line)" }}>
          <button
            type="button"
            onClick={() => setActiveTab("line")}
            style={{
              padding: "4px 8px",
              fontSize: 11,
              fontWeight: 700,
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              gap: 4,
              background: activeTab === "line" ? "var(--surface)" : "transparent",
              color: activeTab === "line" ? "var(--brand)" : "var(--text-muted)",
              boxShadow: activeTab === "line" ? "var(--shadow-sm)" : "none",
              transition: "all 0.15s ease",
            }}
          >
            <TrendingUp size={12} /> Line Curve
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("pie")}
            style={{
              padding: "4px 8px",
              fontSize: 11,
              fontWeight: 700,
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              gap: 4,
              background: activeTab === "pie" ? "var(--surface)" : "transparent",
              color: activeTab === "pie" ? "var(--brand)" : "var(--text-muted)",
              boxShadow: activeTab === "pie" ? "var(--shadow-sm)" : "none",
              transition: "all 0.15s ease",
            }}
          >
            <PieChart size={12} /> Expense Pie
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("circle")}
            style={{
              padding: "4px 8px",
              fontSize: 11,
              fontWeight: 700,
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              gap: 4,
              background: activeTab === "circle" ? "var(--surface)" : "transparent",
              color: activeTab === "circle" ? "var(--brand)" : "var(--text-muted)",
              boxShadow: activeTab === "circle" ? "var(--shadow-sm)" : "none",
              transition: "all 0.15s ease",
            }}
          >
            <Layers size={12} /> Cash Meter
          </button>
        </div>
      </div>

      {/* VIEW 1: ANIMATED VECTOR LINE & AREA CURVE */}
      {activeTab === "line" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11.5 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "var(--success)", fontWeight: 700 }}>
                <span style={{ width: 10, height: 3, borderRadius: 2, background: "var(--success)" }} /> Inflow Curve
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "var(--danger)", fontWeight: 700 }}>
                <span style={{ width: 10, height: 3, borderRadius: 2, background: "var(--danger)" }} /> Outflow Curve
              </span>
            </div>
            <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>Hover points for exact values</span>
          </div>

          <div style={{ width: "100%", overflowX: "auto", position: "relative" }}>
            <svg
              viewBox={`0 0 ${width} ${height}`}
              style={{ width: "100%", height: "180px", overflow: "visible" }}
            >
              <defs>
                <linearGradient id="incomeAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--success)" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="var(--success)" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Horizontal Guide Lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
                const y = padding + (1 - pct) * (height - padding * 2);
                return (
                  <line
                    key={idx}
                    x1={padding}
                    y1={y}
                    x2={width - padding}
                    y2={y}
                    stroke="var(--line)"
                    strokeDasharray="3 3"
                    strokeWidth="1"
                  />
                );
              })}

              {/* Inflow Area Fill */}
              {incomeAreaPath && (
                <path d={incomeAreaPath} fill="url(#incomeAreaGrad)" />
              )}

              {/* Expense Line */}
              {expenseLinePath && (
                <path
                  d={expenseLinePath}
                  fill="none"
                  stroke="var(--danger)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              )}

              {/* Inflow Line */}
              {incomeLinePath && (
                <path
                  d={incomeLinePath}
                  fill="none"
                  stroke="var(--success)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              )}

              {/* Inflow Interactive Nodes */}
              {pointsIncome.map((pt, idx) => (
                <g key={`inc-${idx}`}>
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={hoveredIndex === idx ? 6 : 4}
                    fill="var(--surface)"
                    stroke="var(--success)"
                    strokeWidth={hoveredIndex === idx ? 3 : 2}
                    style={{ cursor: "pointer", transition: "all 0.15s ease" }}
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  />
                  {hoveredIndex === idx && (
                    <text
                      x={pt.x}
                      y={Math.max(16, pt.y - 10)}
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="bold"
                      fill="var(--success)"
                    >
                      {formatMoney(pt.income)}
                    </text>
                  )}
                  {/* Month Label */}
                  <text
                    x={pt.x}
                    y={height - 6}
                    textAnchor="middle"
                    fontSize="9.5"
                    fill="var(--text-muted)"
                    fontWeight="600"
                  >
                    {pt.label}
                  </text>
                </g>
              ))}

              {/* Expense Interactive Nodes */}
              {pointsExpense.map((pt, idx) => (
                <g key={`exp-${idx}`}>
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={hoveredIndex === idx ? 6 : 4}
                    fill="var(--surface)"
                    stroke="var(--danger)"
                    strokeWidth={hoveredIndex === idx ? 3 : 2}
                    style={{ cursor: "pointer", transition: "all 0.15s ease" }}
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  />
                  {hoveredIndex === idx && (
                    <text
                      x={pt.x}
                      y={Math.min(height - 18, pt.y + 16)}
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="bold"
                      fill="var(--danger)"
                    >
                      {formatMoney(pt.expense)}
                    </text>
                  )}
                </g>
              ))}
            </svg>
          </div>
        </div>
      )}

      {/* VIEW 2: CATEGORICAL DONUT / PIE CHART */}
      {activeTab === "pie" && (
        <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 16, alignItems: "center" }}>
          {/* Donut SVG */}
          <div style={{ position: "relative", width: circleSize, height: circleSize, margin: "0 auto" }}>
            <svg width={circleSize} height={circleSize} style={{ transform: "rotate(-90deg)" }}>
              <circle
                cx={circleSize / 2}
                cy={circleSize / 2}
                r={radius}
                fill="transparent"
                stroke="var(--soft)"
                strokeWidth={strokeWidth}
              />
              {pieSlices.map((slice, i) => (
                <circle
                  key={i}
                  cx={circleSize / 2}
                  cy={circleSize / 2}
                  r={radius}
                  fill="transparent"
                  stroke={slice.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={slice.strokeDasharray}
                  strokeDashoffset={slice.strokeDashoffset}
                  strokeLinecap="round"
                  style={{ transition: "stroke-dashoffset 0.6s ease" }}
                />
              ))}
            </svg>
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
              }}
            >
              <span style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>Categories</span>
              <strong style={{ fontSize: 15, fontWeight: 800 }}>{categoryData.length}</strong>
            </div>
          </div>

          {/* Slices Legend List */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {categoryData.slice(0, 5).map((cat, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: 11.5,
                  padding: "4px 8px",
                  borderRadius: 4,
                  background: "var(--soft)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: cat.color, flexShrink: 0 }} />
                  <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {cat.name}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <span style={{ color: "var(--text-muted)", fontSize: 10.5 }}>{cat.percentage}%</span>
                  <strong>{formatMoney(cat.amount)}</strong>
                </div>
              </div>
            ))}
            {!categoryData.length && (
              <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: 12 }}>
                No categorized expenses registered yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 3: RADIAL CASH FLOW EFFICIENCY METER */}
      {activeTab === "circle" && (
        <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 16, alignItems: "center" }}>
          {/* Radial Meter */}
          <div style={{ position: "relative", width: 140, height: 140, margin: "0 auto" }}>
            <svg width={140} height={140} style={{ transform: "rotate(-90deg)" }}>
              <circle
                cx={70}
                cy={70}
                r={54}
                fill="transparent"
                stroke="var(--danger-soft, #fee2e2)"
                strokeWidth={14}
              />
              <circle
                cx={70}
                cy={70}
                r={54}
                fill="transparent"
                stroke="var(--success)"
                strokeWidth={14}
                strokeDasharray={circleDasharray}
                strokeDashoffset={0}
                strokeLinecap="round"
                style={{ transition: "stroke-dasharray 0.8s ease" }}
              />
            </svg>
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
              }}
            >
              <span style={{ fontSize: 9.5, color: "var(--text-muted)", textTransform: "uppercase" }}>Inflow Share</span>
              <strong style={{ fontSize: 16, fontWeight: 800, color: "var(--success)" }}>
                {Math.round(incomeRatio)}%
              </strong>
            </div>
          </div>

          {/* Metric Comparison Cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ padding: "8px 10px", background: "var(--soft)", borderRadius: 6, border: "1px solid var(--line)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)" }}>
                <span>Total Inflow</span>
                <span style={{ color: "var(--success)", fontWeight: 700 }}>+{Math.round(incomeRatio)}%</span>
              </div>
              <strong style={{ fontSize: 13, color: "var(--success)", display: "block", marginTop: 2 }}>
                {formatMoney(cashFlow.income)}
              </strong>
            </div>

            <div style={{ padding: "8px 10px", background: "var(--soft)", borderRadius: 6, border: "1px solid var(--line)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)" }}>
                <span>Operational Outflow</span>
                <span style={{ color: "var(--danger)", fontWeight: 700 }}>-{Math.round(expenseRatio)}%</span>
              </div>
              <strong style={{ fontSize: 13, color: "var(--danger)", display: "block", marginTop: 2 }}>
                {formatMoney(cashFlow.expense)}
              </strong>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11.5, padding: "2px 4px" }}>
              <span style={{ color: "var(--text-muted)" }}>Net Operating Balance:</span>
              <strong style={{ color: cashFlow.net >= 0 ? "var(--success)" : "var(--danger)", fontWeight: 800 }}>
                {formatMoney(cashFlow.net)}
              </strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
