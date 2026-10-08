"use client";

import React from "react";
import { DotsSequence, DotsSequencePlayer } from "dots-swarm";

/**
 * One short looping sequence that mirrors the inspection story:
 * part arrives -> scanned -> sensors read -> verdict.
 * Built once at module scope so the swarm keeps its particles across steps.
 */
const HERO_SEQUENCE = new DotsSequence(
  [
    { shape: "package", label: "Part arrives", duration: 3.6 },
    { shape: "lattice", label: "Surface scanned", duration: 3.6 },
    { shape: "equalizer", label: "Sensors checked", duration: 3.6 },
    { shape: "check", label: "Verdict ready", duration: 3.6 },
  ],
  {
    name: "qastra-hero",
    loop: true,
    defaults: {
      color: "#1C1917",
      count: 900,
      dotSize: 1.6,
      speed: 0.8,
      choreography: "flow",
    },
  }
);

export function HeroSwarm({ className = "" }: { className?: string }) {
  return (
    <div
      role="img"
      aria-label="Animated dots morphing from a part, to a scan grid, to sensor bars, to a check mark"
      className={className}
    >
      <DotsSequencePlayer sequence={HERO_SEQUENCE} className="w-full h-full" />
    </div>
  );
}

export default HeroSwarm;
