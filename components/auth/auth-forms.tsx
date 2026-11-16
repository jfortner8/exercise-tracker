"use client";

import { Eye, EyeOff, Loader2, MailCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import {
  confirmAndSignInAction,
  forgotPasswordAction,
  resendCodeAction,
  resetPasswordAction,
  signInAction,
  signUpAction,
  type AuthResult,
} from "@/lib/auth/actions";
import { PASSWORD_RULES } from "@/lib/auth/errors";
import { Field, Input, cx } from "../ui";

// ---------- shared bits ----------

function SubmitButton({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent text-sm font-semibold text-accent-fg transition hover:brightness-110 disabled:opacity-60"
    >
      {pending && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
      {message}
    </p>
  );
}

function PasswordInput({
  value,
  onChange,
  autoComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  autoComplete: "current-password" | "new-password";
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required
        className="h-11 pr-10"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted hover:text-text"
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

function useAuthFlow() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<AuthResult>, onOk?: () => void, onFail?: (r: AuthResult & { ok: false }) => void) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (r.ok) {
        if (onOk) onOk();
        else {
          router.replace("/");
          router.refresh();
        }
      } else {
        setError(r.error);
        onFail?.(r);
      }
    });
  return { pending, error, setError, run };
}

/** Enter the emailed code, then finish (sign in). */
function CodeStep({
  email,
  onSubmit,
  pending,
  error,
  extra,
  submitLabel,
}: {
  email: string;
  onSubmit: (code: string) => void;
  pending: boolean;
  error: string | null;
  extra?: ReactNode;
  submitLabel: string;
}) {
  const [code, setCode] = useState("");
  const [resent, setResent] = useState<"idle" | "sending" | "sent">("idle");
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(code);
      }}
    >
      <div className="flex gap-3 rounded-lg border border-border bg-surface p-3 text-sm">
        <MailCheck className="mt-0.5 size-5 shrink-0 text-accent" />
        <p>
          We sent a code to <strong className="break-all">{email}</strong>. It can take a minute to arrive.
        </p>
      </div>
      <Field label="Code">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          autoFocus
          required
          className="h-11 text-center font-mono text-lg tracking-[0.4em]"
        />
      </Field>
      {extra}
      <ErrorNote message={error} />
      <SubmitButton pending={pending}>{submitLabel}</SubmitButton>
      <p className="text-center text-sm text-muted">
        Didn&apos;t get it?{" "}
        <button
          type="button"
          disabled={resent === "sending"}
          className="font-medium text-accent hover:underline disabled:opacity-60"
          onClick={async () => {
            setResent("sending");
            await resendCodeAction({ email });
            setResent("sent");
          }}
        >
          {resent === "sent" ? "Sent again" : "Resend code"}
        </button>
      </p>
    </form>
  );
}

// ---------- sign in ----------

export function SignInForm() {
  const { pending, error, run } = useAuthFlow();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [unconfirmed, setUnconfirmed] = useState(false);

  if (unconfirmed) {
    return (
      <CodeStep
        email={email}
        pending={pending}
        error={error}
        submitLabel="Confirm and sign in"
        onSubmit={(code) => run(() => confirmAndSignInAction({ email, password, code }))}
      />
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () => signInAction({ email, password }),
          undefined,
          (r) => r.code === "UNCONFIRMED" && setUnconfirmed(true),
        );
      }}
    >
      <Field label="Email">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          autoFocus
          required
          className="h-11"
        />
      </Field>
      <div className="space-y-1">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium text-muted">Password</span>
          <Link href="/forgot-password" className="text-xs font-medium text-accent hover:underline">
            Forgot password?
          </Link>
        </div>
        <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" />
      </div>
      <ErrorNote message={error} />
      <SubmitButton pending={pending}>Sign in</SubmitButton>
    </form>
  );
}

// ---------- sign up ----------

export function SignUpForm() {
  const { pending, error, run } = useAuthFlow();
  const [step, setStep] = useState<"details" | "code">("details");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  if (step === "code") {
    return (
      <CodeStep
        email={email}
        pending={pending}
        error={error}
        submitLabel="Confirm and get started"
        onSubmit={(code) => run(() => confirmAndSignInAction({ email, password, code }))}
      />
    );
  }

  const checks = [
    { ok: password.length >= 10, label: "10+ characters" },
    { ok: /[A-Z]/.test(password), label: "Uppercase" },
    { ok: /[a-z]/.test(password), label: "Lowercase" },
    { ok: /\d/.test(password), label: "Number" },
  ];

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => signUpAction({ name, email, password }), () => setStep("code"));
      }}
    >
      <Field label="First name">
        <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" autoFocus className="h-11" />
      </Field>
      <Field label="Email">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
          className="h-11"
        />
      </Field>
      <div className="space-y-1.5">
        <span className="text-sm font-medium text-muted">Password</span>
        <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" />
        <ul className="flex flex-wrap gap-1.5 pt-0.5" aria-label={PASSWORD_RULES}>
          {checks.map((c) => (
            <li
              key={c.label}
              className={cx(
                "rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors",
                c.ok ? "bg-accent/15 text-accent" : "bg-surface-2 text-muted",
              )}
            >
              {c.label}
            </li>
          ))}
        </ul>
      </div>
      <ErrorNote message={error} />
      <SubmitButton pending={pending}>Create account</SubmitButton>
    </form>
  );
}

// ---------- forgot / reset ----------

export function ForgotPasswordForm() {
  const { pending, error, run } = useAuthFlow();
  const [step, setStep] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  if (step === "reset") {
    return (
      <CodeStep
        email={email}
        pending={pending}
        error={error}
        submitLabel="Set password and sign in"
        onSubmit={(code) => run(() => resetPasswordAction({ email, code, password }))}
        extra={
          <div className="space-y-1">
            <span className="text-sm font-medium text-muted">New password</span>
            <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" />
            <p className="text-xs text-muted">{PASSWORD_RULES}</p>
          </div>
        }
      />
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => forgotPasswordAction({ email }), () => setStep("reset"));
      }}
    >
      <Field label="Email">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          autoFocus
          required
          className="h-11"
        />
      </Field>
      <ErrorNote message={error} />
      <SubmitButton pending={pending}>Send reset code</SubmitButton>
    </form>
  );
}
