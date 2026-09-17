import React from "react";
import {
  Compass,
  FileText,
  Handshake,
  Trophy,
  XCircle,
  Layers,
} from "lucide-react";

export interface StageTheme {
  name: string;
  accentGradient: string;
  headerBg: string;
  columnBg: string;
  borderColor: string;
  borderHover: string;
  dropHighlight: string;
  titleColor: string;
  badgeBg: string;
  badgeText: string;
  valueBadgeBg: string;
  valueBadgeText: string;
  cardLeftStripe: string;
  icon: React.ElementType;
}

export function getStageTheme(stageName: string, isWon?: boolean, isClosed?: boolean): StageTheme {
  const norm = stageName.toLowerCase().trim();

  if (isWon || norm.includes("won")) {
    return {
      name: stageName,
      accentGradient: "from-emerald-500 via-teal-500 to-emerald-600",
      headerBg: "bg-emerald-50/90 text-emerald-950 border-emerald-200",
      columnBg: "bg-gradient-to-b from-emerald-50/40 via-white/90 to-emerald-50/20",
      borderColor: "border-emerald-200/80",
      borderHover: "hover:border-emerald-300",
      dropHighlight: "bg-emerald-100/50 border-dashed border-2 border-emerald-400",
      titleColor: "text-emerald-900",
      badgeBg: "bg-emerald-100 text-emerald-800 border-emerald-300",
      badgeText: "text-emerald-800",
      valueBadgeBg: "bg-emerald-50 text-emerald-900 border-emerald-200",
      valueBadgeText: "text-emerald-700",
      cardLeftStripe: "border-l-4 border-l-emerald-500",
      icon: Trophy,
    };
  }

  if ((isClosed && !isWon) || norm.includes("lost") || norm.includes("dead")) {
    return {
      name: stageName,
      accentGradient: "from-rose-400 via-pink-500 to-rose-500",
      headerBg: "bg-rose-50/90 text-rose-950 border-rose-200",
      columnBg: "bg-gradient-to-b from-rose-50/30 via-white/90 to-slate-50/20",
      borderColor: "border-rose-200/70",
      borderHover: "hover:border-rose-300",
      dropHighlight: "bg-rose-100/50 border-dashed border-2 border-rose-400",
      titleColor: "text-rose-900",
      badgeBg: "bg-rose-100 text-rose-800 border-rose-300",
      badgeText: "text-rose-800",
      valueBadgeBg: "bg-rose-50 text-rose-900 border-rose-200",
      valueBadgeText: "text-rose-700",
      cardLeftStripe: "border-l-4 border-l-rose-400",
      icon: XCircle,
    };
  }

  if (norm.includes("negotiat") || norm.includes("review") || norm.includes("contract")) {
    return {
      name: stageName,
      accentGradient: "from-amber-500 via-orange-500 to-amber-600",
      headerBg: "bg-amber-50/90 text-amber-950 border-amber-200",
      columnBg: "bg-gradient-to-b from-amber-50/40 via-white/90 to-amber-50/20",
      borderColor: "border-amber-200/80",
      borderHover: "hover:border-amber-300",
      dropHighlight: "bg-amber-100/50 border-dashed border-2 border-amber-400",
      titleColor: "text-amber-900",
      badgeBg: "bg-amber-100 text-amber-900 border-amber-300",
      badgeText: "text-amber-900",
      valueBadgeBg: "bg-amber-50 text-amber-950 border-amber-200",
      valueBadgeText: "text-amber-800",
      cardLeftStripe: "border-l-4 border-l-amber-500",
      icon: Handshake,
    };
  }

  if (norm.includes("proposal") || norm.includes("quote") || norm.includes("pitch")) {
    return {
      name: stageName,
      accentGradient: "from-sky-500 via-blue-500 to-cyan-600",
      headerBg: "bg-sky-50/90 text-sky-950 border-sky-200",
      columnBg: "bg-gradient-to-b from-sky-50/40 via-white/90 to-sky-50/20",
      borderColor: "border-sky-200/80",
      borderHover: "hover:border-sky-300",
      dropHighlight: "bg-sky-100/50 border-dashed border-2 border-sky-400",
      titleColor: "text-sky-900",
      badgeBg: "bg-sky-100 text-sky-900 border-sky-300",
      badgeText: "text-sky-900",
      valueBadgeBg: "bg-sky-50 text-sky-950 border-sky-200",
      valueBadgeText: "text-sky-800",
      cardLeftStripe: "border-l-4 border-l-sky-500",
      icon: FileText,
    };
  }

  if (norm.includes("scope") || norm.includes("discovery") || norm.includes("qualif") || norm.includes("lead")) {
    return {
      name: stageName,
      accentGradient: "from-indigo-500 via-purple-500 to-indigo-600",
      headerBg: "bg-indigo-50/90 text-indigo-950 border-indigo-200",
      columnBg: "bg-gradient-to-b from-indigo-50/40 via-white/90 to-indigo-50/20",
      borderColor: "border-indigo-200/80",
      borderHover: "hover:border-indigo-300",
      dropHighlight: "bg-indigo-100/50 border-dashed border-2 border-indigo-400",
      titleColor: "text-indigo-900",
      badgeBg: "bg-indigo-100 text-indigo-900 border-indigo-300",
      badgeText: "text-indigo-900",
      valueBadgeBg: "bg-indigo-50 text-indigo-950 border-indigo-200",
      valueBadgeText: "text-indigo-800",
      cardLeftStripe: "border-l-4 border-l-indigo-500",
      icon: Compass,
    };
  }

  // Default Fallback Theme (Violet / Slate)
  return {
    name: stageName,
    accentGradient: "from-violet-500 to-purple-600",
    headerBg: "bg-violet-50/90 text-violet-950 border-violet-200",
    columnBg: "bg-gradient-to-b from-violet-50/30 via-white/90 to-slate-50/20",
    borderColor: "border-violet-200/80",
    borderHover: "hover:border-violet-300",
    dropHighlight: "bg-violet-100/50 border-dashed border-2 border-violet-400",
    titleColor: "text-violet-900",
    badgeBg: "bg-violet-100 text-violet-900 border-violet-300",
    badgeText: "text-violet-900",
    valueBadgeBg: "bg-violet-50 text-violet-950 border-violet-200",
    valueBadgeText: "text-violet-800",
    cardLeftStripe: "border-l-4 border-l-violet-500",
    icon: Layers,
  };
}
