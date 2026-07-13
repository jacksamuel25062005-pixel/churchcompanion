import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "../../components/AppShell";
import { BackButton } from "../../components/ui-bits";
import { StainedGlass } from "../../components/StainedGlass";
import { Church, Clock } from "lucide-react";

export const Route = createFileRoute("/about/")({
  head: () => ({
    meta: [
      { title: "About — Church Companion" },
      { name: "description", content: "About our church and the parish timeline." },
    ],
  }),
  component: AboutHome,
});

function AboutHome() {
  return (
    <AppShell>
      <div className="mt-2"><BackButton to="/" label="Home" /></div>

      <section className="relative mt-2 overflow-hidden rounded-[24px] elev-1"
        style={{ background: "linear-gradient(150deg, color-mix(in oklab, var(--lit-purple) 16%, var(--card)) 0%, color-mix(in oklab, var(--lit-gold) 10%, var(--card)) 100%)" }}>
        <StainedGlass variant="hero" />
        <div className="relative px-4 py-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">About</p>
          <h1 className="font-display text-2xl font-bold">Our Church &amp; Story</h1>
          <p className="text-sm text-muted-foreground mt-1">Learn about the parish and browse day-wise history.</p>
        </div>
      </section>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Link to="/about/church" className="tap-card relative overflow-hidden rounded-2xl p-4 min-h-32 flex flex-col justify-end text-white shadow-md"
          style={{ background: "linear-gradient(140deg, #7C3AED, #4C1D95)" }}>
          <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-lg bg-white/20 backdrop-blur-sm">
            <Church className="h-3.5 w-3.5 opacity-90" />
          </span>
          <p className="text-[11px] uppercase tracking-wide font-semibold opacity-90">About Church</p>
          <p className="font-hi text-base font-semibold leading-tight">कलीसिया के बारे में</p>
        </Link>

        <Link to="/about/timeline" className="tap-card relative overflow-hidden rounded-2xl p-4 min-h-32 flex flex-col justify-end text-white shadow-md"
          style={{ background: "linear-gradient(140deg, #B45309, #78350F)" }}>
          <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-lg bg-white/20 backdrop-blur-sm">
            <Clock className="h-3.5 w-3.5 opacity-90" />
          </span>
          <p className="text-[11px] uppercase tracking-wide font-semibold opacity-90">Church Timeline</p>
          <p className="font-hi text-base font-semibold leading-tight">कलीसिया का इतिहास</p>
        </Link>
      </div>
    </AppShell>
  );
}
