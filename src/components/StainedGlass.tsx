/**
 * StainedGlass — decorative, low-opacity abstract shapes evoking stained
 * glass window panes. Purely decorative; sits behind hero content and
 * never affects text contrast. Uses liturgical accent colors.
 */
export function StainedGlass({
  variant = "hero",
  className = "",
}: {
  variant?: "hero" | "arch" | "corner";
  className?: string;
}) {
  if (variant === "arch") {
    return (
      <svg
        aria-hidden
        viewBox="0 0 400 160"
        preserveAspectRatio="none"
        className={`pointer-events-none absolute inset-x-0 top-0 h-24 w-full opacity-[0.18] ${className}`}
      >
        <defs>
          <linearGradient id="sg-arch" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--lit-purple)" />
            <stop offset="60%" stopColor="var(--lit-gold)" />
            <stop offset="100%" stopColor="var(--lit-red)" />
          </linearGradient>
        </defs>
        <path
          d="M0 160 V60 Q100 -20 200 40 Q300 100 400 20 V160 Z"
          fill="url(#sg-arch)"
        />
      </svg>
    );
  }
  if (variant === "corner") {
    return (
      <svg
        aria-hidden
        viewBox="0 0 200 200"
        className={`pointer-events-none absolute -right-8 -top-8 h-40 w-40 opacity-25 ${className}`}
      >
        <circle cx="100" cy="100" r="60" fill="var(--lit-gold)" />
        <circle cx="140" cy="60" r="30" fill="var(--lit-purple)" opacity="0.6" />
        <circle cx="60" cy="140" r="24" fill="var(--lit-green)" opacity="0.6" />
      </svg>
    );
  }
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      <svg viewBox="0 0 600 300" className="absolute inset-0 h-full w-full opacity-[0.22]" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="sg-a" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--lit-purple)" />
            <stop offset="100%" stopColor="var(--lit-red)" />
          </linearGradient>
          <linearGradient id="sg-b" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--lit-gold)" />
            <stop offset="100%" stopColor="var(--lit-green)" />
          </linearGradient>
        </defs>
        {/* Arched top pane */}
        <path d="M60 240 V120 Q60 40 160 40 Q260 40 260 120 V240 Z" fill="url(#sg-a)" />
        {/* Diamond pane */}
        <path d="M360 40 L470 140 L360 240 L250 140 Z" fill="url(#sg-b)" opacity="0.85" />
        {/* Small round pane */}
        <circle cx="520" cy="80" r="46" fill="var(--lit-gold)" opacity="0.9" />
        {/* Lead lines */}
        <g stroke="rgba(20,10,5,0.35)" strokeWidth="1.5" fill="none">
          <path d="M60 240 V120 Q60 40 160 40 Q260 40 260 120 V240" />
          <path d="M360 40 L470 140 L360 240 L250 140 Z" />
          <circle cx="520" cy="80" r="46" />
        </g>
      </svg>
    </div>
  );
}
