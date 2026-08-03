import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/** 0-4 heuristic password strength score (length + character variety). */
export function passwordScore(pw: string): number {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(4, s);
}

export function scoreLabel(score: number): string {
  return ["Very weak", "Weak", "Fair", "Good", "Strong"][score] ?? "Weak";
}

export function PasswordField({
  label,
  value,
  onChange,
  autoComplete = "new-password",
  showMeter = true,
  required = true,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  showMeter?: boolean;
  required?: boolean;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const score = passwordScore(value);
  const meter = autoComplete === "new-password" && showMeter;

  return (
    <label htmlFor={id} className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="relative mt-1">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          minLength={8}
          autoComplete={autoComplete}
          className="w-full rounded-xl border border-border bg-secondary px-3.5 py-2.5 pr-11 text-sm outline-none focus:ring-2 focus:ring-[var(--brand)]"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="focus-ring absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {meter && (
        <div className="mt-2 flex gap-1" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className="h-1 flex-1 rounded-full transition-colors duration-200"
              style={{
                background:
                  i < score
                    ? score <= 1
                      ? "var(--color-destructive)"
                      : score === 2
                        ? "#d9a441"
                        : "var(--brand)"
                    : "color-mix(in oklab, var(--color-foreground) 14%, transparent)",
              }}
            />
          ))}
        </div>
      )}
    </label>
  );
}
