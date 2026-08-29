"use client";

import type { CSSProperties } from "react";

type TelemetryRingProps = {
  accent: string;
  className?: string;
  compact?: boolean;
};

const TELEMETRY_MARKS = ["A1", "N7", "VX", "03", "H", "SYNC", "09", "R"];

export default function TelemetryRing({ accent, className = "", compact = false }: TelemetryRingProps) {
  return (
    <div
      aria-hidden="true"
      className={`telemetry-ring ${compact ? "telemetry-ring-compact" : ""} ${className}`}
      style={{ "--telemetry-accent": accent } as CSSProperties}
    >
      <span className="telemetry-ring-rotor">
        <span className="telemetry-ring-orbit" />
        <span className="telemetry-ring-orbit telemetry-ring-orbit-inner" />
        {TELEMETRY_MARKS.map((mark, index) => {
          const angle = (index / TELEMETRY_MARKS.length) * Math.PI * 2 - Math.PI / 2;
          const radius = compact ? 42 : 45;
          return (
            <span
              key={mark}
              className="telemetry-ring-mark"
              style={{
                left: `${50 + Math.cos(angle) * radius}%`,
                top: `${50 + Math.sin(angle) * radius}%`,
              }}
            >
              {mark}
            </span>
          );
        })}
        <span className="telemetry-ring-axis telemetry-ring-axis-x" />
        <span className="telemetry-ring-axis telemetry-ring-axis-y" />
      </span>
    </div>
  );
}
