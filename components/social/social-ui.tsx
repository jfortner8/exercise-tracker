"use client";

import { Check, Copy, RefreshCw, Share2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, useTransition, type ReactNode } from "react";
import {
  createClubAction,
  deleteClubAction,
  joinWithCodeAction,
  leaveClubAction,
  makeAdminAction,
  removeFriendAction,
  removeMemberAction,
  renameClubAction,
  resetClubCodeAction,
  resetFriendCodeAction,
  type SocialResult,
} from "@/lib/social-actions";
import { formatCode } from "@/lib/social";
import { Button, cx, Input } from "../ui";

/** Runs a social action, then shows its message or error, or goes where it says. */
function useSocialAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<SocialResult | null>(null);
  const run = (action: () => Promise<SocialResult>, then?: () => void) =>
    start(async () => {
      try {
        const r = await action();
        setResult(r);
        if ("ok" in r) {
          then?.();
          if (r.href) router.push(r.href);
        }
      } catch {
        setResult({ error: "Something went wrong. Try again." });
      }
    });
  return { pending, result, run };
}

function Feedback({ result }: { result: SocialResult | null }) {
  if (!result) return null;
  if ("error" in result) return <p className="text-sm text-danger" role="alert">{result.error}</p>;
  return result.message ? <p className="text-sm text-muted" role="status">{result.message}</p> : null;
}

/** Phones have a share sheet; the server and most desktops don't, so it's read after hydration. */
const noSubscribe = () => () => {};
const useCanShare = () =>
  useSyncExternalStore(noSubscribe, () => typeof navigator.share === "function", () => false);

/** A friend or club code, big enough to read out, with copy, share and (when allowed) reset. */
export function CodeCard({
  code,
  shareText,
  reset,
  resetConfirm,
  children,
}: {
  code: string;
  shareText: string;
  reset?: "friend" | { clubId: string };
  resetConfirm?: string;
  children?: ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const { pending, result, run } = useSocialAction();
  const shown = formatCode(code);
  const canShare = useCanShare();
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-lg border border-dashed border-accent bg-accent/5 px-3 py-1.5 font-mono text-xl font-semibold tracking-[0.15em] tabular-nums">
          {shown}
        </span>
        <Button
          type="button"
          size="sm"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(shown);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {}
          }}
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? "Copied" : "Copy"}
        </Button>
        {canShare && (
          <Button
            type="button"
            size="sm"
            onClick={() => navigator.share({ text: `${shareText} ${shown}`, url: location.origin }).catch(() => {})}
          >
            <Share2 className="size-4" /> Share
          </Button>
        )}
        {reset && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            className="text-muted"
            onClick={() => {
              if (resetConfirm && !confirm(resetConfirm)) return;
              run(() => (reset === "friend" ? resetFriendCodeAction() : resetClubCodeAction(reset.clubId)));
            }}
          >
            <RefreshCw className="size-4" /> New code
          </Button>
        )}
      </div>
      {children}
      <Feedback result={result} />
    </div>
  );
}

/** One box for both kinds of code: a friend's adds them, a club's joins it. */
export function JoinWithCode() {
  const [code, setCode] = useState("");
  const { pending, result, run } = useSocialAction();
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => joinWithCodeAction(code), () => setCode(""));
      }}
    >
      <div className="flex gap-2">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ABCD-EFGH"
          aria-label="Friend or club code"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          className="font-mono tracking-widest"
          maxLength={20}
        />
        <Button type="submit" variant="primary" disabled={pending || !code.trim()} className="shrink-0">
          {pending ? "Adding…" : "Add"}
        </Button>
      </div>
      <Feedback result={result} />
    </form>
  );
}

export function RemoveFriendButton({ sub, name }: { sub: string; name: string }) {
  const { pending, result, run } = useSocialAction();
  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={pending}
        className="text-muted hover:text-danger"
        onClick={() => confirm(`Remove ${name} from your friends? You'll stop seeing each other on your Friends boards.`) && run(() => removeFriendAction(sub))}
      >
        Remove
      </Button>
      {result && "error" in result && <Feedback result={result} />}
    </>
  );
}

export function CreateClub() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const { pending, result, run } = useSocialAction();
  if (!open)
    return (
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        + Create a club
      </Button>
    );
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => createClubAction(name));
      }}
    >
      <div className="flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Club name, e.g. Derby team" autoFocus maxLength={60} />
        <Button type="submit" variant="primary" disabled={pending || !name.trim()} className="shrink-0">
          {pending ? "Creating…" : "Create"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="shrink-0">
          Cancel
        </Button>
      </div>
      <Feedback result={result} />
    </form>
  );
}

/** The club's name, renamable in place by its admin. */
export function ClubName({ clubId, name, isAdmin }: { clubId: string; name: string; isAdmin: boolean }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const { pending, result, run } = useSocialAction();
  if (!editing)
    return (
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
        {isAdmin && (
          <Button type="button" size="sm" variant="ghost" className="text-muted" onClick={() => setEditing(true)}>
            Rename
          </Button>
        )}
      </div>
    );
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => renameClubAction(clubId, value), () => setEditing(false));
      }}
    >
      <div className="flex max-w-md gap-2">
        <Input value={value} onChange={(e) => setValue(e.target.value)} autoFocus maxLength={60} aria-label="Club name" />
        <Button type="submit" variant="primary" disabled={pending} className="shrink-0">
          Save
        </Button>
        <Button type="button" variant="ghost" onClick={() => setEditing(false)} className="shrink-0">
          Cancel
        </Button>
      </div>
      <Feedback result={result} />
    </form>
  );
}

/** Admin controls on another member's row. */
export function MemberActions({ clubId, sub, name }: { clubId: string; sub: string; name: string }) {
  const { pending, result, run } = useSocialAction();
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-1">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          className="text-muted"
          onClick={() =>
            confirm(`Make ${name} the admin? You'll stay a member, but only ${name} will be able to manage the club.`) &&
            run(() => makeAdminAction(clubId, sub))
          }
        >
          Make admin
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          className="text-muted hover:text-danger"
          onClick={() => confirm(`Remove ${name} from the club?`) && run(() => removeMemberAction(clubId, sub))}
        >
          Remove
        </Button>
      </div>
      {result && "error" in result && <Feedback result={result} />}
    </div>
  );
}

/** Leave (anyone), and delete (admin). The confirm says who becomes admin, or that the club goes. */
export function ClubExit({
  clubId,
  clubName,
  isAdmin,
  heirName,
}: {
  clubId: string;
  clubName: string;
  isAdmin: boolean;
  /** Who'd become admin if the admin left; null when you're the only member. */
  heirName: string | null;
}) {
  const { pending, result, run } = useSocialAction();
  const leaveConfirm = !heirName
    ? `You're the only member, so leaving deletes ${clubName}. Continue?`
    : isAdmin
      ? `Leave ${clubName}? ${heirName} will become the admin.`
      : `Leave ${clubName}?`;
  return (
    <div className="space-y-2">
      <div className={cx("flex flex-wrap gap-2")}>
        <Button type="button" disabled={pending} onClick={() => confirm(leaveConfirm) && run(() => leaveClubAction(clubId))}>
          Leave club
        </Button>
        {isAdmin && (
          <Button
            type="button"
            variant="danger"
            disabled={pending}
            onClick={() =>
              confirm(`Delete ${clubName} for everyone? Its board and invite code go away. This can't be undone.`) &&
              run(() => deleteClubAction(clubId))
            }
          >
            Delete club
          </Button>
        )}
      </div>
      <Feedback result={result} />
    </div>
  );
}
