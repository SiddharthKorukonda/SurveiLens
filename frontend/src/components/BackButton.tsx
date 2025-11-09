import React from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

export default function BackButton({ label = "Back" }: { label?: string }) {
  const nav = useNavigate();
  return (
    <button
      onClick={() => nav(-1)}
      className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10"
    >
      <ChevronLeft size={16} />
      {label}
    </button>
  );
}
