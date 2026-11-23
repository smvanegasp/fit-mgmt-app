import {
  Barbell, Crown, Diamond, Fire, Flame, Hammer, Infinity as InfinityIcon, Medal, MedalMilitary, Meteor, Mountains,
  ShootingStar, Sparkle, Sun, Trophy, type Icon,
} from "@phosphor-icons/react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { STREAK_TIERS, WORKOUT_TIERS, nextTier, tierAt, type Tier, type TierIcon as IconName } from "../lib/tiers";
import { InfoTip } from "./InfoTip";

const ICONS: Record<IconName, Icon> = {
  Sparkle, Fire, Flame, Sun, Meteor, Hammer, Infinity: InfinityIcon,
  Barbell, Medal, MedalMilitary, Trophy, Crown, Diamond, Mountains, ShootingStar,
};

/** A tier's icon: brass once earned, a faint outline before. */
export function TierIcon({ tier, earned = true, size = 20, className = "" }: { tier: Tier; earned?: boolean; size?: number; className?: string }) {
  const Glyph = ICONS[tier.icon];
  return <Glyph size={size} weight={earned ? "fill" : "regular"} aria-hidden className={`${earned ? "text-amber-600" : "text-stone-300"} ${className}`} />;
}

/** Every tier in a row, earned ones in brass, the next one ringed, the best ever marked. */
function TierRow({ tiers, value, best, unit }: { tiers: Tier[]; value: number; best?: number; unit: string }) {
  const next = nextTier(tiers, value);
  return (
    <ol className="mt-3 grid grid-cols-4 gap-1.5 sm:grid-cols-8">
      {tiers.map((t) => {
        const earned = value >= t.at;
        const bestOnly = !earned && best !== undefined && best >= t.at;
        return (
          <li key={t.at} aria-label={`${t.name}, ${t.at} ${unit}${earned ? ", reached" : bestOnly ? ", your best" : ""}`}
            className={`flex flex-col items-center rounded-[3px] border px-1 py-2 ${t.at === next.at ? "border-stone-400" : earned || bestOnly ? "border-stone-200" : "border-dashed border-stone-200"}`}>
            <TierIcon tier={t} earned={earned || bestOnly} size={22} className={bestOnly ? "opacity-50" : ""} />
            <span className={`mt-1 text-[0.65rem] font-semibold tracking-wide uppercase ${earned ? "text-stone-800" : "text-stone-400"}`}>{t.name}</span>
            <span className="text-[0.65rem] text-stone-500 tabular-nums">{t.at}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** "Silver" with its icon, or "No tier yet". */
function TierName({ tier }: { tier: Tier | null }) {
  if (!tier) return <span className="text-stone-500">No tier yet</span>;
  return <span className="inline-flex items-center gap-1.5"><TierIcon tier={tier} size={18} />{tier.name}</span>;
}

/**
 * The tiers on Progress (Sergio, 2026-11-23): workouts ever logged and weeks of streak, each a
 * ladder of named tiers with their icons; the streak shows its best ever too.
 */
export function TiersCard({ workouts, current, longest }: { workouts: number; current: number; longest: number }) {
  const wNext = nextTier(WORKOUT_TIERS, workouts);
  const sNext = nextTier(STREAK_TIERS, current);
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-4">
      <h2 className="flex items-center gap-1 font-semibold">
        Tiers
        <InfoTip title="Tiers">Milestones for workouts logged and weeks of streak, each with its own badge.</InfoTip>
      </h2>

      <div className="mt-3">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-3xl tabular-nums">{workouts}</span>
          <span className="text-sm text-stone-500">workouts</span>
          <span className="ml-auto text-sm font-semibold"><TierName tier={tierAt(WORKOUT_TIERS, workouts)} /></span>
        </div>
        <p className="text-xs text-stone-500 tabular-nums">{wNext.at - workouts} more to {wNext.name} ({wNext.at})</p>
        <TierRow tiers={WORKOUT_TIERS} value={workouts} unit="workouts" />
      </div>

      <div className="mt-5 border-t border-stone-200 pt-4">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-3xl tabular-nums">{current}</span>
          <span className="text-sm text-stone-500">week streak</span>
          <span className="ml-auto text-sm font-semibold"><TierName tier={tierAt(STREAK_TIERS, current)} /></span>
        </div>
        <p className="text-xs text-stone-500 tabular-nums">
          {sNext.at - current} more week{sNext.at - current === 1 ? "" : "s"} to {sNext.name} ({sNext.at}) · best ever {longest} weeks
          {tierAt(STREAK_TIERS, longest) ? ` (${tierAt(STREAK_TIERS, longest)!.name})` : ""}
        </p>
        <TierRow tiers={STREAK_TIERS} value={current} best={longest} unit="weeks" />
      </div>
    </section>
  );
}

/** The congrats for a new workout tier: the same flash and shake as the streak's. */
export function WorkoutTierCelebration({ tier, onClose }: { tier: Tier; onClose: () => void }) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    navigator.vibrate?.([30, 50, 80, 50, 120]);
    const id = setTimeout(() => close.current(), 3600);
    return () => clearTimeout(id);
  }, []);
  const next = nextTier(WORKOUT_TIERS, tier.at);
  return createPortal(
    <div role="status" aria-live="polite" onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 motion-safe:animate-[fade-in_120ms_ease-out]">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-amber-600 opacity-0 motion-safe:animate-[flash_450ms_ease-out]" />
      <div className="relative w-full max-w-xs border border-amber-600 bg-white px-6 py-7 text-center shadow-[0_0_60px_-10px_var(--ember-glow)] motion-safe:animate-[pop-in_260ms_cubic-bezier(.2,1.4,.4,1),breakdown_520ms_260ms_ease-out]">
        <p className="text-xs font-semibold tracking-[0.2em] text-stone-500 uppercase">New tier</p>
        <TierIcon tier={tier} size={88} className="mx-auto mt-3" />
        <p className="mt-2 font-display text-3xl">{tier.name}</p>
        <p className="mt-1 font-display text-xl text-stone-600 tabular-nums">{tier.at} workouts</p>
        <p className="mt-3 text-sm text-stone-600">Next: {next.name} at {next.at}.</p>
      </div>
    </div>,
    document.body,
  );
}
