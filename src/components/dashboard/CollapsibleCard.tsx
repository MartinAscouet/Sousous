"use client";

import React from "react";
import { ChevronDown } from "lucide-react";

interface CollapsibleCardProps {
  id: string;
  isOpen: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
  iconBgColor?: string;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  totalAmount: number;
  percentage?: string;
  performanceBadge?: React.ReactNode;
  isMasked?: boolean;
  formatCurrency: (amount: number) => string;
  children: React.ReactNode;
  headerAction?: React.ReactNode;
  accentBorderColor?: string;
}

export default function CollapsibleCard({
  id,
  isOpen,
  onToggle,
  icon,
  iconBgColor = "bg-slate-800/80 text-slate-300 border-slate-700/50",
  title,
  subtitle,
  badge,
  totalAmount,
  percentage,
  performanceBadge,
  isMasked = false,
  formatCurrency,
  children,
  headerAction,
  accentBorderColor = "hover:border-slate-700",
}: CollapsibleCardProps) {
  return (
    <div
      className={`rounded-2xl sm:rounded-3xl border border-slate-800/80 bg-slate-900/50 backdrop-blur transition-all duration-200 overflow-hidden shadow-lg ${
        isOpen ? "ring-1 ring-emerald-500/20 bg-slate-900/80" : accentBorderColor
      }`}
    >
      {/* En-tête cliquable de l'accordéon */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        aria-controls={`content-${id}`}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
        className="w-full text-left p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 select-none cursor-pointer group hover:bg-slate-800/30 transition-colors"
      >
        {/* Partie gauche : Icône + Titre + Badges */}
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 border ${iconBgColor} transition-transform group-hover:scale-105`}
          >
            {icon}
          </div>

          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight truncate">
                {title}
              </h3>
              {badge}
            </div>
            {subtitle && (
              <p className="text-xs text-slate-400 truncate">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Partie droite : Solde + % + Performance Badge + Chevron */}
        <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0 pl-13 sm:pl-0 border-t sm:border-t-0 border-slate-800/60 pt-2 sm:pt-0">
          <div className="text-left sm:text-right space-y-1">
            <div className="text-base sm:text-lg font-extrabold text-white tracking-tight font-mono sm:font-sans">
              {isMasked ? "•••• €" : formatCurrency(totalAmount)}
            </div>
            <div className="flex items-center sm:justify-end gap-2 flex-wrap">
              {percentage !== undefined && (
                <div className="text-[11px] font-semibold text-slate-400">
                  <span className="text-emerald-400">{percentage}%</span> du total
                </div>
              )}
              {performanceBadge}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {headerAction && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="cursor-default"
              >
                {headerAction}
              </div>
            )}

            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center bg-slate-800/60 text-slate-400 group-hover:text-white group-hover:bg-slate-800 transition-all duration-300 ${
                isOpen ? "rotate-180 bg-slate-800 text-white" : "rotate-0"
              }`}
            >
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      {/* Contenu déroulant / Déplié avec animation fluide */}
      <div
        id={`content-${id}`}
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          isOpen ? "max-h-[2000px] opacity-100 border-t border-slate-800/80" : "max-h-0 opacity-0"
        }`}
      >
        <div className="p-4 sm:p-6 bg-slate-950/40">{children}</div>
      </div>
    </div>
  );
}
