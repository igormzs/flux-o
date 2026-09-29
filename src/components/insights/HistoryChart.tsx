import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney } from "@/lib/currencies";
import type { DateRange } from "@/lib/date-utils";

export interface HistoryBar {
  range: DateRange;
  total: number;
  selected: boolean;
  inProgress: boolean;
  chip: string;
  tick: string;
  span: string;
}

interface HistoryChartProps {
  bars: HistoryBar[];
  average: number | null;
  currency: string;
  onSelect: (bar: HistoryBar) => void;
}

/** The selected period next to the ones before it, with their average as a dashed line. */
const HistoryChart = ({ bars, average, currency, onSelect }: HistoryChartProps) => (
  <div className="h-56" data-testid="history-chart">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={bars} margin={{ top: 18, right: 4, left: 4, bottom: 0 }}>
        <XAxis dataKey="tick" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} interval={0} />
        <YAxis hide domain={[0, "dataMax"]} />
        <Tooltip
          cursor={{ fill: "hsl(var(--muted) / 0.4)", radius: 8 }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const b = payload[0].payload as HistoryBar;
            return (
              <div className="bg-card border border-glass-border rounded-xl px-3 py-2 text-xs shadow-xl">
                <p className="text-muted-foreground">{b.span}{b.inProgress ? " · so far" : ""}</p>
                <p className="font-bold text-foreground">{formatMoney(b.total, currency)}</p>
              </div>
            );
          }}
        />
        {average !== null && (
          <ReferenceLine
            y={average}
            stroke="hsl(var(--muted-foreground))"
            strokeDasharray="4 4"
          />
        )}
        <Bar dataKey="total" radius={[8, 8, 0, 0]} onClick={(d) => onSelect(d as unknown as HistoryBar)} className="cursor-pointer">
          {bars.map((b) => (
            <Cell
              key={b.range.start.toISOString()}
              fill={b.selected ? "hsl(var(--primary))" : "hsl(var(--muted-foreground) / 0.35)"}
              fillOpacity={b.inProgress ? 0.6 : 1}
              stroke={b.inProgress ? "hsl(var(--primary))" : undefined}
              strokeDasharray={b.inProgress ? "4 3" : undefined}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  </div>
);

export default HistoryChart;
