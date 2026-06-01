import React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function TradingTrafficChart({ data = [] }) {
  const chartData = data.map((item, index) => {
    const hits = Number(item.views || 0);
    return {
      date: item.date,
      Hits: hits,
      Unique: Math.max(0, hits - (index % 2)),
    };
  });

  return (
    <div className="h-[390px] rounded-[30px] bg-white px-5 py-6">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 20, right: 25, left: -5, bottom: 10 }}>
          <defs>
            <linearGradient id="hitsGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b8ae" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#10b8ae" stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid vertical={false} stroke="#e6edf5" strokeDasharray="3 3" />

          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#52627a", fontSize: 13, fontWeight: 700 }}
            dy={12}
          />

          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#52627a", fontSize: 13, fontWeight: 700 }}
          />

          <Tooltip
            cursor={false}
            contentStyle={{
              background: "#ffffff",
              border: "1px solid #e7edf5",
              borderRadius: 18,
              boxShadow: "0 25px 60px rgba(15, 23, 42, 0.14)",
              fontWeight: 800,
            }}
          />

          <Legend
            verticalAlign="top"
            align="center"
            iconType="plainline"
            wrapperStyle={{ paddingBottom: 25, fontWeight: 900 }}
          />

          <Area
            type="linear"
            dataKey="Hits"
            stroke="#10b8ae"
            strokeWidth={3}
            fill="url(#hitsGradient)"
            dot={{ r: 5, fill: "#10b8ae", stroke: "#ffffff", strokeWidth: 2 }}
            activeDot={{ r: 7, fill: "#10b8ae", stroke: "#ffffff", strokeWidth: 3 }}
          />

          <Line
            type="linear"
            dataKey="Unique"
            stroke="#0f172a"
            strokeWidth={2.4}
            strokeDasharray="7 6"
            dot={{ r: 4, fill: "#ffffff", stroke: "#0f172a", strokeWidth: 2 }}
            activeDot={{ r: 6, fill: "#ffffff", stroke: "#0f172a", strokeWidth: 3 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
