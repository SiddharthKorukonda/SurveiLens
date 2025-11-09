// src/components/RadarBackground.tsx
import React from "react"

/** Centered radar with perfectly concentric rings + spinning sweep. */
export default function RadarBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* vignette + perfectly centered rings */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            // soft vignette
            `radial-gradient(circle at 50% 50%, rgba(16,255,120,0.06) 0%, rgba(0,0,0,0.55) 60%, rgba(0,0,0,0.9) 100%),` +
            // the rings (every 90px with 1px line)
            `repeating-radial-gradient(circle at 50% 50%, rgba(16,255,120,0.16) 0 1px, transparent 1px 90px)`,
          backgroundBlendMode: "screen",
          backgroundPosition: "center, center",
          backgroundSize: "100% 100%, 120vmin 120vmin",
        }}
      />

      {/* spinning sweep */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div
          className="h-[120vmin] w-[120vmin] animate-[spin_6s_linear_infinite]"
          style={{
            maskImage:
              "conic-gradient(from 0deg, transparent 0deg, rgba(0,0,0,1) 24deg, transparent 26deg)",
            WebkitMaskImage:
              "conic-gradient(from 0deg, transparent 0deg, rgba(0,0,0,1) 24deg, transparent 26deg)",
            filter: "blur(0.4px)",
          }}
        >
          <div
            className="h-full w-full rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(16,255,120,0.35) 0%, rgba(16,255,120,0.18) 40%, rgba(16,255,120,0.05) 70%, transparent 75%)",
            }}
          />
        </div>
      </div>

      {/* faint scan lines */}
      <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_14px,rgba(16,255,120,0.05)_15px)]" />
    </div>
  )
}
