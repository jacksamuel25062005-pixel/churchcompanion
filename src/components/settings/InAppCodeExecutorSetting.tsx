import { useEffect, useRef, useState } from "react";
import { ChevronDown, ShieldCheck, Loader2, CheckCircle2, AlertTriangle, XCircle, FileText, Play, Eraser, Copy } from "lucide-react";
import { Textarea } from "../ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "../ui-bits";
import { Switch } from "../ui/switch";
import { useAppSetting } from "@/hooks/useAppSetting";
import { CodeExecutionReportModal, type CodeExecutionReport } from "./CodeExecutionReportModal";

const PHASES = [
  { name: "THINK", body: "Read entire project. Map all dependencies: pages, components, database, auth, APIs, routes." },
  { name: "CHECK", body: "Simulate impact of new code. Identify all files that need changes. Flag risks. If a break is detected — STOP and explain before proceeding." },
  { name: "CODE", body: "Edit only necessary files. Never touch unrelated code. Apply minimum-footprint changes only." },
  { name: "TEST", body: "Verify errors, compatibility, security, performance, and build success. Generate report." },
];

export function InAppCodeExecutorSetting() {
  const { value: enabled, loading, updateSetting } = useAppSetting("in_app_code_executor_enabled", false);
  const [saving, setSaving] = useState(false);
  const [pipelineOpen, setPipelineOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [lastReport, setLastReport] = useState<CodeExecutionReport | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("code_execution_reports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) setLastReport(data as unknown as CodeExecutionReport);
    })();
  }, []);

  const handleToggle = async (next: boolean) => {
    setSaving(true);
    const prev = enabled;
    try {
      await updateSetting(next);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setSaveStatus("error");
      try { await updateSetting(prev); } catch { /* ignore revert error */ }
      setTimeout(() => setSaveStatus("idle"), 3000);
    } finally {
      setSaving(false);
    }
  };

  const badge = getBadge(enabled, lastReport);

  return (
    <>
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 brand-text" />
          <span className="text-sm font-semibold">In-App Code Executor</span>
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-secondary/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider">
            Super Admin
          </span>
        </div>

        <div className="flex items-start justify-between gap-3">
          <p className="text-xs text-muted-foreground flex-1">
            Controls how AI handles new code additions. When ON, all changes follow: Think → Check → Code → Test before any file is modified.
          </p>
          <div className="flex items-center gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            <Switch
              checked={enabled}
              onCheckedChange={handleToggle}
              disabled={saving || loading}
              aria-label="Toggle In-App Code Executor"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 min-h-[20px]">
          <span className={`inline-flex items-center gap-1.5 text-xs ${badge.color}`}>
            <span className="text-base leading-none">{enabled ? "●" : "○"}</span>
            {badge.label}
          </span>
          {saveStatus === "saved" && (
            <span className="ml-auto text-xs text-green-600 inline-flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Saved
            </span>
          )}
          {saveStatus === "error" && (
            <span className="ml-auto text-xs text-red-600 inline-flex items-center gap-1">
              <XCircle className="h-3 w-3" /> Failed to save
            </span>
          )}
        </div>

        <button
          onClick={() => setPipelineOpen((v) => !v)}
          className="flex items-center gap-1 text-xs font-medium text-foreground hover:underline"
        >
          View Pipeline Details
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${pipelineOpen ? "rotate-180" : ""}`} />
        </button>

        {pipelineOpen && (
          <div className="rounded-xl border overflow-hidden">
            {PHASES.map((p, i) => (
              <div
                key={p.name}
                className={`p-3 border-l-4 ${i > 0 ? "border-t" : ""}`}
                style={{ borderLeftColor: "hsl(var(--primary))" }}
              >
                <p className="font-mono text-xs font-semibold">Phase {i + 1} — {p.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{p.body}</p>
              </div>
            ))}
            <div className="bg-secondary/50 p-3 text-xs italic">
              Golden Rule: Think first. Check second. Code third. Test last. Never break existing features.
            </div>
          </div>
        )}

        {lastReport && (
          <button
            onClick={() => setModalOpen(true)}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm font-medium hover:bg-secondary"
          >
            <FileText className="h-4 w-4" /> View Last Report
          </button>
        )}

        <CodeScratchpad enabled={enabled} />
      </Card>

      {modalOpen && lastReport && (
        <CodeExecutionReportModal report={lastReport} onClose={() => setModalOpen(false)} />
      )}
    </>
  );
}

type ScratchLang = "javascript" | "typescript" | "html" | "css" | "json";

function CodeScratchpad({ enabled }: { enabled: boolean }) {
  const [lang, setLang] = useState<ScratchLang>("javascript");
  const [code, setCode] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem("in_app_code_executor_scratch") ?? "// Write code here…\nconsole.log('hello from scratchpad');";
  });
  const [output, setOutput] = useState<string>("");
  const [running, setRunning] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    try { window.localStorage.setItem("in_app_code_executor_scratch", code); } catch { /* ignore */ }
  }, [code]);

  const clear = () => { setCode(""); setOutput(""); };
  const copy = async () => {
    try { await navigator.clipboard.writeText(code); toast.success("Code copied"); }
    catch { toast.error("Copy failed"); }
  };

  const run = async () => {
    setRunning(true);
    setOutput("");
    const logs: string[] = [];
    try {
      if (lang === "html" || lang === "css") {
        const html = lang === "html" ? code : `<style>${code}</style><div>Preview</div>`;
        const iframe = iframeRef.current;
        if (iframe) iframe.srcdoc = html;
        logs.push(`[${lang}] rendered in preview below`);
      } else if (lang === "json") {
        const parsed = JSON.parse(code);
        logs.push(JSON.stringify(parsed, null, 2));
      } else {
        // js / ts — run TS as JS (strip types minimally is out of scope; treat as JS)
        const capture = (level: string) => (...args: unknown[]) => {
          logs.push(`[${level}] ` + args.map((a) => {
            try { return typeof a === "string" ? a : JSON.stringify(a); } catch { return String(a); }
          }).join(" "));
        };
        const sandboxConsole = {
          log: capture("log"), info: capture("info"), warn: capture("warn"), error: capture("error"),
        };
        // eslint-disable-next-line no-new-func
        const fn = new Function("console", `"use strict"; return (async () => { ${code}\n })();`);
        const result = await fn(sandboxConsole);
        if (result !== undefined) logs.push("=> " + (typeof result === "string" ? result : JSON.stringify(result, null, 2)));
      }
    } catch (e: any) {
      logs.push("Error: " + (e?.message ?? String(e)));
    } finally {
      setOutput(logs.join("\n"));
      setRunning(false);
    }
  };

  return (
    <div className="space-y-2 pt-2 border-t">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold">Scratchpad</span>
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value as ScratchLang)}
          className="ml-auto text-xs rounded-md border bg-card px-2 py-1"
          aria-label="Language"
        >
          <option value="javascript">JavaScript</option>
          <option value="typescript">TypeScript</option>
          <option value="html">HTML</option>
          <option value="css">CSS</option>
          <option value="json">JSON</option>
        </select>
      </div>
      <Textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        rows={10}
        spellCheck={false}
        className="font-mono text-xs min-h-[200px]"
        placeholder="Write code here…"
      />
      <div className="flex gap-2">
        <button
          onClick={run}
          disabled={running || !enabled}
          title={!enabled ? "Enable the executor above" : "Run code"}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl brand-bg py-2 text-sm font-medium disabled:opacity-50"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {running ? "Running…" : "Run"}
        </button>
        <button onClick={copy} className="inline-flex items-center justify-center rounded-xl border bg-card px-3 py-2 text-sm" aria-label="Copy code">
          <Copy className="h-4 w-4" />
        </button>
        <button onClick={clear} className="inline-flex items-center justify-center rounded-xl border bg-card px-3 py-2 text-sm" aria-label="Clear code">
          <Eraser className="h-4 w-4" />
        </button>
      </div>
      {output && (
        <pre className="rounded-xl bg-secondary/60 p-3 text-xs font-mono whitespace-pre-wrap max-h-60 overflow-auto">
{output}
        </pre>
      )}
      {(lang === "html" || lang === "css") && (
        <iframe
          ref={iframeRef}
          title="Preview"
          className="w-full h-48 rounded-xl border bg-white"
          sandbox="allow-scripts"
        />
      )}
      {!enabled && (
        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" /> Enable the executor above to run code.
        </p>
      )}
    </div>
  );
}

function getBadge(enabled: boolean, report: CodeExecutionReport | null) {
  if (!enabled) return { label: "Inactive", color: "text-muted-foreground" };
  if (!report) return { label: "Active — no reports yet", color: "text-muted-foreground" };
  if (report.stopped_early) return { label: "Active — pipeline halted last run", color: "text-red-600" };
  const hasWarnings =
    (report.compatibility_status && report.compatibility_status !== "ok") ||
    report.security_issues.length > 0 ||
    report.performance_notes.length > 0 ||
    report.break_risks.length > 0 ||
    report.build_success === false;
  if (hasWarnings) return { label: "Active — warnings in last run", color: "text-amber-600" };
  return { label: "Active — last run clean", color: "text-green-600" };
}

export function DeveloperControlsSection() {
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { if (!cancelled) setIsSuperAdmin(false); return; }
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", u.user.id);
      if (cancelled) return;
      setIsSuperAdmin((roles ?? []).some((r) => r.role === "super_admin"));
    })();
    return () => { cancelled = true; };
  }, []);

  if (!isSuperAdmin) return null;

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        Developer Controls
      </p>
      <InAppCodeExecutorSetting />
    </div>
  );
}
