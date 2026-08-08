"use client";

/**
 * Signed-in profile: identity, stats, review history and settings.
 *
 * Review history is fetched once rather than subscribed — unlike the watchlist,
 * it doesn't change from other surfaces while this page is open, so a live
 * listener would be pure overhead.
 */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LogOut, MessageSquare, Pencil, Star, Bookmark } from "lucide-react";
import { OwnedLibrary } from "./OwnedLibrary";
import { PlayHistory } from "./PlayHistory";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useWatchlist } from "@/lib/firebase/WatchlistProvider";
import { getUserProfile, getUserReviews, updateUserProfile, type Review } from "@/lib/firebase/db";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/SectionHeading";
import { Skeleton } from "@/components/ui/Skeleton";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/Reveal";
import { CountUp } from "@/components/motion/text";
import { Spotlight } from "@/components/motion/effects";
import { cn } from "@/lib/utils/cn";

export function ProfileView() {
  const { user, signOut, setDisplayName } = useAuth();
  const { entries } = useWatchlist();
  const { toast } = useToast();
  const router = useRouter();

  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [bio, setBio] = useState("");
  const [name, setName] = useState(user?.displayName ?? "");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    getUserReviews(user.uid)
      .then((list) => {
        if (!cancelled) setReviews(list);
      })
      .catch(() => {
        if (!cancelled) setReviews([]);
      });

    getUserProfile(user.uid)
      .then((profile) => {
        if (!cancelled && profile) setBio(profile.bio ?? "");
      })
      .catch(() => {
        /* profile doc is optional — the page works without it */
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const averageGiven = useMemo(() => {
    if (!reviews || reviews.length === 0) return null;
    return Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10) / 10;
  }, [reviews]);

  if (!user) return null;

  const displayName = user.displayName || user.email?.split("@")[0] || "Player";

  const saveProfile = async () => {
    setSaving(true);
    try {
      if (name.trim() && name.trim() !== user.displayName) {
        await setDisplayName(name.trim());
      }
      await updateUserProfile(user.uid, { displayName: name.trim() || displayName, bio });
      toast("Profile updated", "success");
      setEditing(false);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't save your profile.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    toast("Signed out", "info");
    router.push("/");
  };

  return (
    <Container className="py-8 lg:py-12">
      <Reveal className="glass flex flex-col gap-5 rounded-3xl p-5 sm:flex-row sm:items-center sm:gap-6 sm:p-7">
        <ProfileAvatar name={displayName} photo={user.photoURL} uid={user.uid} />

        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-2xl font-bold sm:text-3xl">{displayName}</h2>
          {user.email && <p className="mt-1 truncate text-sm text-muted">{user.email}</p>}
          {bio && <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted">{bio}</p>}
        </div>

        <div className="flex shrink-0 flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setEditing((e) => !e)}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-4 text-sm font-medium text-muted transition-colors hover:border-line-strong hover:text-text"
          >
            <Pencil size={14} />
            Edit
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-flare/30 px-4 text-sm font-medium text-flare transition-colors hover:bg-flare/10"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </Reveal>

      <Stagger className="mt-4 grid grid-cols-3 gap-3">
        <Stat icon={Bookmark} label="Tracked" value={entries.length} />
        <Stat icon={MessageSquare} label="Reviews" value={reviews?.length ?? 0} />
        <Stat
          icon={Star}
          label="Avg score"
          value={averageGiven ?? 0}
          decimals={averageGiven === null ? 0 : 1}
          suffix={averageGiven === null ? "" : "/10"}
        />
      </Stagger>

      {editing && (
        <Reveal id="settings" className="mt-4 rounded-3xl border border-line bg-panel/50 p-5 sm:p-7">
          <h3 className="text-lg font-semibold">Account settings</h3>

          <label htmlFor="profile-name" className="mt-5 mb-1.5 block text-[13px] font-medium text-muted">
            Display name
          </label>
          <input
            id="profile-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            className="min-h-12 w-full rounded-xl border border-line bg-white/[0.03] px-4 text-base outline-none transition-colors focus:border-brand"
          />

          <label htmlFor="profile-bio" className="mt-4 mb-1.5 block text-[13px] font-medium text-muted">
            Bio <span className="font-normal text-faint">(optional)</span>
          </label>
          <textarea
            id="profile-bio"
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, 280))}
            rows={3}
            placeholder="Tell people what you play."
            className="w-full resize-y rounded-xl border border-line bg-white/[0.03] p-3.5 text-sm outline-none transition-colors placeholder:text-faint focus:border-brand"
          />
          <p className="mt-1 text-right text-[11px] text-faint tabular-nums">{bio.length}/280</p>

          <div className="mt-4 flex items-center gap-3">
            <Button onClick={saveProfile} loading={saving} size="sm" icon={<Check size={15} />}>
              Save changes
            </Button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-sm text-muted transition-colors hover:text-text"
            >
              Cancel
            </button>
          </div>
        </Reveal>
      )}

      <section id="library" className="mt-12 scroll-mt-28">
        <h2 className="text-2xl font-bold sm:text-3xl">Games you own</h2>
        <p className="mt-1.5 text-sm text-muted">
          Your collection, grouped by where you bought it.
        </p>
        <OwnedLibrary />
      </section>

      <section id="history" className="mt-12 scroll-mt-28">
        <h2 className="text-2xl font-bold sm:text-3xl">Play history</h2>
        <p className="mt-1.5 text-sm text-muted">
          What you&rsquo;ve played, and where you played it.
        </p>
        <PlayHistory />
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-bold sm:text-3xl">Your reviews</h2>

        {reviews === null ? (
          <div className="mt-6 space-y-3">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="mt-6 flex flex-col items-center rounded-3xl border border-dashed border-line py-16 text-center">
            <MessageSquare size={22} className="text-faint" />
            <p className="mt-3 max-w-xs text-sm text-muted">
              You haven&rsquo;t reviewed anything yet. Rate a game and it&rsquo;ll show up here.
            </p>
            <Button href="/browse" variant="secondary" size="sm" className="mt-5">
              Find something to rate
            </Button>
          </div>
        ) : (
          <ul className="mt-6 space-y-3">
            {reviews.map((review, i) => (
              <Reveal as="li" key={review.id} delay={Math.min(i, 5) * 0.05} blur={false}>
                <Link
                  href={`/game/${review.slug}`}
                  className="block rounded-2xl border border-line bg-panel/50 p-4 transition-colors fine:hover:border-line-strong sm:p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="min-w-0 flex-1 truncate font-semibold">{review.gameName}</h3>
                    <span className="flex shrink-0 items-center gap-1 rounded-lg bg-gold/12 px-2 py-1 text-sm font-bold text-gold tabular-nums">
                      <Star size={12} className="fill-gold" />
                      {review.rating}
                    </span>
                  </div>
                  {review.body && (
                    <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">
                      {review.body}
                    </p>
                  )}
                </Link>
              </Reveal>
            ))}
          </ul>
        )}
      </section>
    </Container>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  decimals = 0,
  suffix = "",
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: number;
  decimals?: number;
  suffix?: string;
}) {
  return (
    <StaggerItem>
      <Spotlight className="glass h-full rounded-2xl p-4">
        <Icon size={16} className="text-brand-soft" />
        <p className="mt-3 font-display text-2xl font-bold leading-none">
          <CountUp value={value} decimals={decimals} suffix={suffix} />
        </p>
        <p className="mt-1.5 text-[12px] text-muted">{label}</p>
      </Spotlight>
    </StaggerItem>
  );
}

function ProfileAvatar({
  name,
  photo,
  uid,
}: {
  name: string;
  photo: string | null;
  uid: string;
}) {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) hash = (hash << 5) - hash + uid.charCodeAt(i);
  const hue = Math.abs(hash) % 360;

  return (
    <div
      className={cn(
        "grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl border border-line-strong",
      )}
      style={{
        background: photo
          ? undefined
          : `linear-gradient(140deg, hsl(${hue} 68% 46%), hsl(${(hue + 50) % 360} 68% 30%))`,
      }}
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="font-display text-2xl font-black text-white">
          {name.slice(0, 1).toUpperCase()}
        </span>
      )}
    </div>
  );
}
