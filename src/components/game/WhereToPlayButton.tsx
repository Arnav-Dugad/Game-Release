"use client";

import { ShoppingBag } from "lucide-react";

export function WhereToPlayButton() {
  const open = () => {
    const target = document.getElementById("where-to-play");
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    target.focus({ preventScroll: true });
    window.history.replaceState(null, "", "#where-to-play");
  };

  return (
    <button
      type="button"
      onClick={open}
      className="glass relative inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold tracking-[-0.01em] text-text transition-[background-color,border-color,color,transform] duration-300 active:scale-[0.97] hover:border-line-strong hover:bg-panel-2/70"
    >
      <ShoppingBag size={16} />
      Where to play
    </button>
  );
}
