"use client";

/**
 * Settings.
 *
 * Every control here applies immediately — there is no save button, because a
 * save button on a preferences screen is a promise the reader has to trust.
 * Changing the currency reloads the current route so server-rendered prices
 * re-fetch in the new region rather than showing a stale figure.
 */

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import {
  BellRing,
  Bookmark,
  Check,
  Coins,
  Gauge,
  LogOut,
  Sparkles,
  UserRound,
  Wifi,
} from "lucide-react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useWatchlist } from "@/lib/firebase/WatchlistProvider";
import { usePreferences } from "@/lib/preferences/PreferencesProvider";
import { STEAM_REGIONS } from "@/lib/games/stores-catalog";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/SectionHeading";
import { useToast } from "@/components/ui/Toast";
import { Reveal } from "@/components/motion/Reveal";
import { cn } from "@/lib/utils/cn";

export function SettingsView() {
  return (
    <Container className="max-w-3xl py-10 lg:py-14">
      <div className="space-y-5">
        <RegionCard />
        <NotificationCard />
        <MotionCard />
        <AccountCard />
        <DataCard />
      </div>
    </Container>
  );
}

function SettingCard({
  id,
  icon,
  title,
  description,
  children,
  delay = 0,
}: {
  id?: string;
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
  delay?: number;
}) {
  return (
    <Reveal id={id} delay={delay} blur={false}>
      <section className="glass rounded-3xl p-5 sm:p-7">
        <header className="flex items-start gap-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-line bg-white/[0.04] text-brand-soft">
            {icon}
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">{description}</p>
          </div>
        </header>
        <div className="mt-6">{children}</div>
      </section>
    </Reveal>
  );
}

function NotificationCard() {
  const {
    notificationDeals,
    setNotificationDeals,
    notificationReleases,
    setNotificationReleases,
  } = usePreferences();

  return (
    <SettingCard
      id="notifications"
      icon={<BellRing size={19} />}
      title="Notification center"
      description="Choose which live signals appear in your header inbox and notification center."
      delay={0.05}
    >
      <div className="space-y-2.5">
        <Toggle
          checked={notificationReleases}
          onChange={setNotificationReleases}
          label="Release reminders"
          hint="From 14 days before launch through the first three days after release."
        />
        <Toggle
          checked={notificationDeals}
          onChange={setNotificationDeals}
          label="Watchlist deal alerts"
          hint="Checks wanted games against live prices in your selected Steam region."
        />
      </div>
    </SettingCard>
  );
}

function RegionCard() {
  const { region, regionInfo, setRegion, ready } = usePreferences();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  const choose = (cc: string) => {
    if (cc === region) return;
    setRegion(cc);
    // Prices are rendered on the server from the region cookie, so the route
    // has to re-run for the change to be visible.
    startTransition(() => {
      router.refresh();
      toast(`Prices now shown in ${STEAM_REGIONS.find((r) => r.cc === cc)?.currency}`, "success");
    });
  };

  return (
    <SettingCard
      icon={<Coins size={19} />}
      title="Store region & currency"
      description="Steam prices are shown for this country. Changing it changes the currency on every game page."
    >
      <div className="mb-4 flex items-center gap-2 text-sm">
        <span className="text-muted">Currently</span>
        <span className="inline-flex items-center gap-2 rounded-full border border-brand/40 bg-brand/12 px-3 py-1.5 font-semibold text-white">
          {regionInfo.name}
          <span className="text-brand-soft">{regionInfo.currency}</span>
        </span>
        {pending && <span className="text-xs text-faint">updating…</span>}
      </div>

      <ul
        className={cn(
          "grid grid-cols-2 gap-2 sm:grid-cols-3",
          !ready && "pointer-events-none opacity-60",
        )}
      >
        {STEAM_REGIONS.map((option) => {
          const active = option.cc === region;
          return (
            <li key={option.cc}>
              <button
                type="button"
                onClick={() => choose(option.cc)}
                aria-pressed={active}
                className={cn(
                  "flex w-full min-h-12 items-center justify-between gap-2 rounded-xl border px-3.5 text-left text-[13px] transition-colors",
                  active
                    ? "border-brand/50 bg-brand/15 text-white"
                    : "border-line bg-white/[0.03] text-muted fine:hover:border-line-strong fine:hover:text-text",
                )}
              >
                <span className="min-w-0 flex-1 truncate">{option.name}</span>
                <span className={cn("shrink-0 text-[11px]", active ? "text-brand-soft" : "text-faint")}>
                  {option.currency}
                </span>
                {active && <Check size={13} className="shrink-0 text-brand-soft" />}
              </button>
            </li>
          );
        })}
      </ul>
    </SettingCard>
  );
}

function MotionCard() {
  const { reduceMotion, setReduceMotion } = usePreferences();

  return (
    <SettingCard
      icon={<Sparkles size={19} />}
      title="Motion"
      description="The interface uses parallax, reveals and hover effects. Turn them down if you'd rather it stayed still."
      delay={0.05}
    >
      <Toggle
        checked={reduceMotion}
        onChange={setReduceMotion}
        label="Reduce motion"
        hint="Also follows your system setting when that's enabled."
      />
    </SettingCard>
  );
}

function AccountCard() {
  const { user, loading, enabled, signOut } = useAuth();
  const { entries } = useWatchlist();
  const router = useRouter();
  const { toast } = useToast();

  if (loading) {
    return (
      <SettingCard
        icon={<UserRound size={19} />}
        title="Account"
        description="Your sign-in and synced data."
        delay={0.1}
      >
        <div className="shimmer-bg h-12 rounded-xl" />
      </SettingCard>
    );
  }

  const owned = entries.filter((entry) => (entry.ownedOn ?? []).length > 0).length;

  return (
    <SettingCard
      icon={<UserRound size={19} />}
      title="Account"
      description={
        enabled
          ? "Your watchlist, library and reviews sync to this account."
          : "Sign-in isn't configured for this deployment."
      }
      delay={0.1}
    >
      {!enabled ? (
        <p className="text-sm text-muted">
          Add Firebase credentials to enable accounts. Everything else works without them.
        </p>
      ) : user ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white/[0.04] px-4 py-2 text-sm">
              <span className="truncate font-medium">{user.displayName || user.email}</span>
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white/[0.04] px-4 py-2 text-sm">
              <Bookmark size={14} className="text-brand-soft" />
              <span className="font-semibold tabular-nums">{entries.length}</span>
              <span className="text-muted">tracked</span>
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white/[0.04] px-4 py-2 text-sm">
              <span className="font-semibold tabular-nums">{owned}</span>
              <span className="text-muted">owned</span>
            </span>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button href="/profile" variant="secondary" size="sm">
              Edit profile
            </Button>
            <Button
              variant="danger"
              size="sm"
              icon={<LogOut size={15} />}
              onClick={async () => {
                await signOut();
                toast("Signed out", "info");
                router.push("/");
              }}
            >
              Sign out
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          <Button href="/login?next=%2Fsettings" size="sm">
            Sign in
          </Button>
          <Button href="/signup?next=%2Fsettings" variant="secondary" size="sm">
            Create an account
          </Button>
        </div>
      )}
    </SettingCard>
  );
}

function DataCard() {
  const [status, setStatus] = useState<
    { ok: boolean; label: string; hint: string | null } | null
  >(null);
  const [checking, setChecking] = useState(false);

  const check = async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      const body = (await res.json()) as {
        ok: boolean;
        igdb: { problem: string | null; hint: string | null };
      };
      setStatus({
        ok: body.ok,
        label: body.ok ? "IGDB is responding normally." : (body.igdb.problem ?? "Unavailable"),
        hint: body.igdb.hint,
      });
    } catch {
      setStatus({ ok: false, label: "Couldn't reach the health endpoint.", hint: null });
    } finally {
      setChecking(false);
    }
  };

  return (
    <SettingCard
      icon={<Wifi size={19} />}
      title="Data source"
      description="Game data comes from IGDB, with Steam supplying live prices and system requirements."
      delay={0.15}
    >
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" size="sm" onClick={check} loading={checking} icon={<Gauge size={15} />}>
          Check connection
        </Button>
        {status && (
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[13px]",
              status.ok
                ? "border-mint/30 bg-mint/10 text-mint"
                : "border-flare/30 bg-flare/10 text-flare",
            )}
          >
            {status.ok && <Check size={14} />}
            {status.label}
          </span>
        )}
      </div>
      {status?.hint && !status.ok && (
        <p className="mt-3 text-[13px] leading-relaxed text-muted">{status.hint}</p>
      )}
    </SettingCard>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-4 rounded-2xl border border-line bg-white/[0.03] px-4 py-3.5 text-left transition-colors hover:border-line-strong"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
      </span>
      <span
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-300",
          checked ? "bg-brand" : "bg-white/15",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
            checked ? "translate-x-[22px]" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}
