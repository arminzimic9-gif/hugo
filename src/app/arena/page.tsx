"use client";

import dynamic from "next/dynamic";

const ArenaGame = dynamic(() => import("@/components/arena/ArenaGame"), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-full items-center justify-center bg-[#05070d] font-mono text-xs tracking-[0.3em] text-gray-500">
      LOADING ARENA PROTOCOL…
    </div>
  ),
});

export default function ArenaPage() {
  return <ArenaGame />;
}
