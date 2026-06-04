import { useState } from "react";
import { BarChart2 } from "lucide-react";
import type { AmmChartPoint } from "@/hooks/useAmmIndexedData";
import { fmtUSD, fmtSignedPct, fmtDateTime } from "@/utils/ammFormatters";

interface CandlestickChartProps {
  points: AmmChartPoint[];
  isLoading?: boolean;
}

export function CandlestickChart({
  points,
  isLoading,
}: CandlestickChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const candles = points.filter(
    (p) => p.open > 0 && p.high > 0 && p.low > 0 && p.close > 0
  );

  if (candles.length === 0) {
    return (
      <div className="flex h-[360px] items-center justify-center rounded-lg border border-border/60 bg-[#090d12]">
        {isLoading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-5 h-5 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
            <p className="text-[10px] text-muted-foreground">Loading chart...</p>
          </div>
        ) : (
          <div className="text-center">
            <BarChart2 className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">
              No market candles yet.
            </p>
          </div>
        )}
      </div>
    );
  }

  const W = 1000;
  const H = 360;
  const priceH = 250;
  const volumeTop = 270;
  const volumeH = 70;
  const marginT = 10;
  const plotW = W;
  const plotH = priceH - marginT;

  const bodyMin = Math.min(...candles.map((p) => Math.min(p.open, p.close)));
  const bodyMax = Math.max(...candles.map((p) => Math.max(p.open, p.close)));
  const bodyRange = Math.max(bodyMax - bodyMin, bodyMax * 0.005, 0.000001);
  const wickCap = bodyRange * 3;
  const rawMin = Math.max(
    Math.min(...candles.map((p) => p.low)),
    bodyMin - wickCap
  );
  const rawMax = Math.min(
    Math.max(...candles.map((p) => p.high)),
    bodyMax + wickCap
  );
  const rawRange = Math.max(rawMax - rawMin, rawMax * 0.01, 0.000001);
  const yPad = rawRange * 0.18;
  const minP = rawMin - yPad;
  const maxP = rawMax + yPad;
  const priceRange = maxP - minP;

  const toY = (p: number) => marginT + ((maxP - p) / priceRange) * plotH;
  const maxVolume = Math.max(...candles.map((p) => p.volumeUsdc), 0.000001);
  const toVolumeH = (v: number) => Math.max(1, (v / maxVolume) * volumeH);

  const maxSlot = candles.length <= 8 ? 30 : 24;
  const rawSlot = plotW / Math.max(candles.length, 1);
  const candleSlot = Math.min(rawSlot, maxSlot);
  const candleW = Math.max(3, Math.min(7, candleSlot * 0.3));
  const groupW = candleSlot * candles.length;
  const offsetX = (plotW - groupW) / 2;

  const LABEL_W = 58;
  const gridLines = [0, 1, 2, 3, 4].map((i) => ({
    pct: i / 4,
    price: maxP - (i / 4) * priceRange,
  }));

  const latest = candles[candles.length - 1];
  const first = candles[0];
  const changePct =
    first.open > 0 ? ((latest.close - first.open) / first.open) * 100 : 0;
  const activeIndex = hovered ?? candles.length - 1;
  const activeCandle = candles[activeIndex];
  const activeX = offsetX + candleSlot * activeIndex + candleSlot / 2;

  return (
    <div className="overflow-hidden rounded-lg border border-border/60 bg-[#090d12]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 bg-black/25 px-3 py-2 text-[10px] font-mono min-h-[34px]">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-muted-foreground">
            {fmtDateTime(activeCandle.ts)}
          </span>
          <span className="text-muted-foreground">
            O{" "}
            <span className="text-foreground">
              {fmtUSD(activeCandle.open)}
            </span>
          </span>
          <span className="text-muted-foreground">
            H <span className="text-emerald-400">{fmtUSD(activeCandle.high)}</span>
          </span>
          <span className="text-muted-foreground">
            L <span className="text-rose-400">{fmtUSD(activeCandle.low)}</span>
          </span>
          <span className="text-muted-foreground">
            C{" "}
            <span className="text-foreground">
              {fmtUSD(activeCandle.close)}
            </span>
          </span>
          <span className="text-muted-foreground">
            V{" "}
            <span className="text-foreground">
              {fmtUSD(activeCandle.volumeUsdc)}
            </span>
          </span>
        </div>
        <span
          className={`font-semibold ${
            changePct >= 0 ? "text-emerald-400" : "text-rose-400"
          }`}
        >
          {fmtSignedPct(changePct)}
        </span>
      </div>

      <div className="flex" style={{ height: H }}>
        <div className="shrink-0 border-r border-border/30" style={{ width: LABEL_W }}>
          <div
            className="flex flex-col justify-between py-[10px]"
            style={{ height: priceH }}
          >
            {gridLines.map(({ price }, i) => (
              <span
                key={i}
                className="block pr-2 text-right text-[9px] font-mono leading-none text-slate-500"
              >
                {fmtUSD(price)}
              </span>
            ))}
          </div>
          <div className="border-t border-border/30 pt-2 pr-2 text-right text-[9px] font-mono text-slate-500">
            Vol
          </div>
        </div>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-full flex-1"
          preserveAspectRatio="none"
          onMouseLeave={() => setHovered(null)}
        >
          {gridLines.map(({ pct }, i) => {
            const yy = marginT + pct * plotH;
            return (
              <line
                key={i}
                x1={0}
                x2={W}
                y1={yy}
                y2={yy}
                stroke="rgba(148,163,184,0.18)"
                strokeWidth="0.8"
                strokeDasharray="4,5"
              />
            );
          })}
          <line
            x1={0}
            x2={W}
            y1={volumeTop - 8}
            y2={volumeTop - 8}
            stroke="rgba(148,163,184,0.16)"
            strokeWidth="1"
          />

          {candles.map((point, i) => {
            const cx = offsetX + candleSlot * i + candleSlot / 2;
            const up = point.close >= point.open;
            const color = up ? "#22c55e" : "#ef4444";
            const bodyTop = toY(Math.max(point.open, point.close));
            const bodyBottom = toY(Math.min(point.open, point.close));
            const bh = Math.max(2, bodyBottom - bodyTop);
            const isHov = hovered === i;
            const volH = toVolumeH(point.volumeUsdc);
            return (
              <g
                key={`${point.ts}-${i}`}
                onMouseEnter={() => setHovered(i)}
                style={{ cursor: "crosshair" }}
              >
                <rect
                  x={cx - candleW / 2}
                  y={volumeTop + volumeH - volH}
                  width={candleW}
                  height={volH}
                  rx="1"
                  fill={up ? "rgba(34,197,94,0.24)" : "rgba(239,68,68,0.24)"}
                />
                {isHov && (
                  <line
                    x1={cx}
                    x2={cx}
                    y1={marginT}
                    y2={volumeTop + volumeH}
                    stroke="rgba(226,232,240,0.55)"
                    strokeWidth="0.8"
                    strokeDasharray="3,3"
                  />
                )}
                <line
                  x1={cx}
                  x2={cx}
                  y1={toY(point.high)}
                  y2={toY(point.low)}
                  stroke={color}
                  strokeWidth="1.5"
                />
                <rect
                  x={cx - candleW / 2}
                  y={bodyTop}
                  width={candleW}
                  height={bh}
                  rx="1.5"
                  fill={
                    up ? "rgba(34,197,94,0.18)" : "rgba(239,68,68,0.16)"
                  }
                  stroke={color}
                  strokeWidth={isHov ? 2 : 1.4}
                />
                <rect
                  x={cx - candleSlot / 2}
                  y={marginT}
                  width={candleSlot}
                  height={volumeTop + volumeH - marginT}
                  fill="transparent"
                />
              </g>
            );
          })}

          <line
            x1={0}
            x2={W}
            y1={toY(activeCandle.close)}
            y2={toY(activeCandle.close)}
            stroke="rgba(226,232,240,0.45)"
            strokeWidth="0.8"
            strokeDasharray="3,3"
          />
          <rect
            x={Math.min(W - 86, activeX + 8)}
            y={Math.max(2, toY(activeCandle.close) - 10)}
            width="78"
            height="20"
            rx="4"
            fill="rgba(15,23,42,0.92)"
            stroke="rgba(148,163,184,0.25)"
          />
          <text
            x={Math.min(W - 47, activeX + 47)}
            y={Math.max(15, toY(activeCandle.close) + 4)}
            textAnchor="middle"
            fontSize="10"
            fill="#e2e8f0"
            fontFamily="monospace"
          >
            {fmtUSD(activeCandle.close)}
          </text>
        </svg>
      </div>
    </div>
  );
}
