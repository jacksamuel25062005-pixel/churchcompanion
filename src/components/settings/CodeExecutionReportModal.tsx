import { X, CheckCircle2, AlertTriangle, XCircle, FileText } from "lucide-react";

export interface CodeExecutionReport {
  id: string;
  created_at: string;
  session_label: string | null;
  files_changed: Array<{ path: string; reason?: string; type?: string }>;
  compatibility_status: string | null;
  security_issues: Array<{ severity?: string; description: string }>;
  performance_notes: Array<{ area?: string; note: string }>;
  break_risks: Array<{ file?: string; risk: string }>;
  build_success: boolean | null;
  stopped_early: boolean;
  stop_reason: string | null;
}

function StatusIcon({ level }: { level: "ok" | "warn" | "err" }) {
  if (level === "ok") return <CheckCircle2 className="h-4 w-4 text-green-600" />;
  if (level === "warn") return <AlertTriangle className="h-4 w-4 text-amber-600" />;
  return <XCircle className="h-4 w-4 text-red-600" />;
}

function statusFromArray(arr: unknown[]): "ok" | "warn" | "err" {
  return arr.length === 0 ? "ok" : "warn";
}

export function CodeExecutionReportModal({
  report,
  onClose,
}: {
  report: CodeExecutionReport;
  onClose: () => void;
}) {
  const compat = (report.compatibility_status ?? "ok") as "ok" | "warning" | "error";
  const compatLevel: "ok" | "warn" | "err" =
    compat === "ok" ? "ok" : compat === "warning" ? "warn" : "err";
  const date = new Date(report.created_at).toLocaleDateString(undefined, {
    day: "numeric", month: "short", year: "numeric",
  });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl bg-card shadow-xl border max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b p-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 brand-text" />
            <h2 className="font-semibold">Code Execution Report</h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{date}</span>
            <button onClick={onClose} aria-label="Close" className="p-1 rounded hover:bg-secondary">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4 text-sm">
          {report.session_label && (
            <p className="text-xs text-muted-foreground">Session: {report.session_label}</p>
          )}

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Files changed ({report.files_changed.length})
            </h3>
            {report.files_changed.length === 0 ? (
              <p className="text-xs text-muted-foreground">No files changed.</p>
            ) : (
              <ul className="space-y-1">
                {report.files_changed.map((f, i) => (
                  <li key={i} className="text-xs font-mono break-all">
                    ✏️ {f.path}{f.reason ? <span className="text-muted-foreground"> — {f.reason}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="rounded-xl border divide-y">
            <Row label="Compatibility" level={compatLevel} text={compat === "ok" ? "All clear" : compat} />
            <Row label="Security" level={statusFromArray(report.security_issues)} text={report.security_issues.length ? `${report.security_issues.length} issue(s)` : "No issues found"} />
            <Row label="Performance" level={statusFromArray(report.performance_notes)} text={report.performance_notes[0]?.note ?? "No notes"} />
            <Row label="Break risk" level={statusFromArray(report.break_risks)} text={report.break_risks.length ? `${report.break_risks.length} risk(s)` : "No existing features affected"} />
            <Row label="Build" level={report.build_success === false ? "err" : "ok"} text={report.build_success === false ? "Failed" : "Successful"} />
          </div>

          <div className="rounded-xl border p-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pipeline halted early?</span>
            <span className="text-sm font-medium">{report.stopped_early ? `Yes — ${report.stop_reason ?? ""}` : "No"}</span>
          </div>
        </div>

        <div className="border-t p-3 flex justify-end">
          <button onClick={onClose} className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, level, text }: { label: string; level: "ok" | "warn" | "err"; text: string }) {
  return (
    <div className="flex items-center justify-between p-3">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2 text-sm">
        <StatusIcon level={level} />
        {text}
      </span>
    </div>
  );
}
