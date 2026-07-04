// Song Import Engine — parses a document containing many songs into individual entries.
// Marker examples: "Song #01", "Song #1", "Song 01", "Song 1" (case-insensitive, line-start).

export interface ParsedSong {
  number: number;
  title: string | null;
  body: string;
}

const MARKER_RE = /^[ \t]*song[ \t]*#?[ \t]*(\d+)[ \t]*[:\-–—.)]?[ \t]*(.*)$/gim;

export function parseSongs(text: string): ParsedSong[] {
  if (!text) return [];
  const src = text.replace(/\r\n?/g, "\n");
  const matches: { index: number; end: number; number: number; rest: string }[] = [];
  MARKER_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MARKER_RE.exec(src))) {
    matches.push({
      index: m.index,
      end: m.index + m[0].length,
      number: parseInt(m[1], 10),
      rest: (m[2] ?? "").trim(),
    });
  }
  if (matches.length === 0) return [];

  const out: ParsedSong[] = [];
  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i];
    const next = matches[i + 1];
    const chunk = src.slice(cur.end, next ? next.index : src.length);
    const lines = chunk.split("\n");
    // Drop leading blank lines but preserve inner spacing/verse breaks.
    while (lines.length && lines[0].trim() === "") lines.shift();
    while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();

    let title: string | null = cur.rest || null;
    let bodyLines = lines;
    if (!title && lines.length) {
      // If first non-empty line looks short, treat as title.
      const first = lines[0].trim();
      if (first.length > 0 && first.length <= 120 && !/[।.!?]$/.test(first) && lines.length > 1) {
        title = first;
        bodyLines = lines.slice(1);
        while (bodyLines.length && bodyLines[0].trim() === "") bodyLines.shift();
      }
    }

    out.push({
      number: cur.number,
      title: title && title.length ? title : null,
      body: bodyLines.join("\n").trim(),
    });
  }
  return out.filter((s) => s.body.length > 0);
}

export type ConflictAction = "skip" | "replace" | "duplicate";

export interface ImportSummary {
  detected: number;
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: { number: number; message: string }[];
}
