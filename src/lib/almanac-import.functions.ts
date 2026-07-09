import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AlmanacEntryDraft = {
  date: string; // YYYY-MM-DD
  day_name: string;
  theme: string;
  colour: string;
  morning_readings: string[];
  evening_readings: string[];
  ls_ot?: string[];
  ls_psalm?: string[];
  ls_second?: string[];
  ls_gospel?: string[];
  memorial?: string | null;
  is_sunday?: boolean;
};

export type AlmanacExtractResult = {
  year: number;
  month: number; // 1-12
  month_name: string;
  entries: AlmanacEntryDraft[];
};

const MASTER_PROMPT = `Liturgical Calendar Extraction
You are extracting structured calendar/lectionary data from a PDF or document. Follow these parsing rules exactly.

## Source Format Rules
1. Numbers on the left (1, 2, 3...) are the date of the month.
2. Letters beside the date (Th, F, S, etc.) indicate the Day of the Week (Th=Thursday, F=Friday, S=Saturday, etc.).
3. The descriptive sentence next to the date/day (e.g., "Naming of Jesus: The Renewal of the Covenant – Vedanayagam Samuel Azariah (Bp. EV)") is the Theme of the day.
4. Worship labels: MW = Morning Worship, EW = Evening Worship, M/EW = combined Morning/Evening Worship, L.S = Lord's Supper.
5. On Sundays/special days, Bible readings are listed vertically (one per line). On regular weekdays, readings are listed horizontally (in a single line, separated).
6. On the right side of the page, a single letter denotes the liturgical color: W = White, G = Green, V = Violet, R = Red.
7. OT = Old Testament, NT = New Testament.

## Bible Book Naming Rule
- Every Bible book name must be rendered in "English / Hindi" format, e.g. "Genesis / उत्पत्ति : Chapter 1, Verse 1–10".

## General Instructions
- Process the document date-by-date, in order, for the entire month/file.
- Do not skip, merge, or summarize any day.
- Do not invent themes, readings, or colors. If a Theme is missing, use exactly "No theme". Do not fabricate other fields.
- Always list readings as a numbered vertical list regardless of source layout.

## Output — JSON ONLY
Return ONE JSON object (no prose, no code fences) with this exact shape:
{
  "year": number,           // e.g. 2026
  "month": number,          // 1-12
  "month_name": string,     // e.g. "January"
  "entries": [
    {
      "date": "YYYY-MM-DD",
      "day_name": "Monday" | "Tuesday" | ...,   // full weekday name
      "theme": string,                            // or "No theme"
      "colour": "White" | "Green" | "Violet" | "Red",
      "memorial": string | null,                  // optional saint/memorial line if given
      "is_sunday": boolean,
      "morning_readings": string[],               // for MW; if only M/EW given, put combined here and leave evening_readings []
      "evening_readings": string[],               // for EW; [] if only combined M/EW
      "ls_ot": string[],                          // Lord's Supper Old Testament readings (empty [] if none)
      "ls_psalm": string[],
      "ls_second": string[],                      // NT epistle/second reading
      "ls_gospel": string[]
    }
  ]
}
Rules for arrays: use [] (never null). Every entry MUST include all fields. Use ISO dates. Do not include any commentary outside the JSON.`;

type ExtractInput = { text: string };

export const extractAlmanacFromText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: ExtractInput) => {
    if (!data || typeof data.text !== "string") throw new Error("text is required");
    const text = data.text.trim();
    if (text.length < 20) throw new Error("Text is too short to extract almanac data");
    if (text.length > 200_000) throw new Error("Text is too large (>200k chars)");
    return { text };
  })
  .handler(async ({ data, context }): Promise<AlmanacExtractResult> => {
    // Admin/super_admin only
    const { data: roles, error: roleError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (roleError) throw new Error(roleError.message);
    const isAdmin = (roles ?? []).some((r) => r.role === "admin" || r.role === "super_admin");
    if (!isAdmin) throw new Error("Forbidden");

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: MASTER_PROMPT },
          { role: "user", content: `Extract the liturgical calendar from the following source text. Return JSON only.\n\n---\n${data.text}` },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (res.status === 429) throw new Error("AI rate limit reached. Please try again in a minute.");
    if (res.status === 402) throw new Error("AI credits exhausted. Please top up in Settings.");
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`AI extraction failed (${res.status}): ${t.slice(0, 300)}`);
    }

    const json: any = await res.json();
    const raw = json?.choices?.[0]?.message?.content;
    if (typeof raw !== "string") throw new Error("AI returned no content");

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // strip code fences if any
      const stripped = raw.replace(/^```json\s*|\s*```$/g, "").trim();
      parsed = JSON.parse(stripped);
    }

    if (!parsed || typeof parsed !== "object") throw new Error("Invalid AI output");
    const year = Number(parsed.year);
    const month = Number(parsed.month);
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
      throw new Error("AI output missing year/month");
    }
    const entries = Array.isArray(parsed.entries) ? parsed.entries : [];
    const cleaned: AlmanacEntryDraft[] = entries.map((e: any) => ({
      date: String(e.date ?? "").slice(0, 10),
      day_name: String(e.day_name ?? ""),
      theme: String(e.theme ?? "No theme"),
      colour: String(e.colour ?? "White"),
      morning_readings: Array.isArray(e.morning_readings) ? e.morning_readings.map(String) : [],
      evening_readings: Array.isArray(e.evening_readings) ? e.evening_readings.map(String) : [],
      ls_ot: Array.isArray(e.ls_ot) ? e.ls_ot.map(String) : [],
      ls_psalm: Array.isArray(e.ls_psalm) ? e.ls_psalm.map(String) : [],
      ls_second: Array.isArray(e.ls_second) ? e.ls_second.map(String) : [],
      ls_gospel: Array.isArray(e.ls_gospel) ? e.ls_gospel.map(String) : [],
      memorial: e.memorial == null ? null : String(e.memorial),
      is_sunday: Boolean(e.is_sunday),
    })).filter((e: AlmanacEntryDraft) => /^\d{4}-\d{2}-\d{2}$/.test(e.date));

    return {
      year,
      month,
      month_name: String(parsed.month_name ?? ""),
      entries: cleaned,
    };
  });
