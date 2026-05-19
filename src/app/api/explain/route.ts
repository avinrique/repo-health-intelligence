import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MODEL = process.env.HEALTH_NARRATIVE_MODEL || "anthropic/claude-haiku-4-5";

/**
 * Explain why health dropped between two commits.
 *
 * Cost discipline:
 *   - Only called when the user clicks a dip (UI annotation), never per-commit at ingest.
 *   - Result is cached in `narratives` keyed by (sha, prev_sha) and returned on repeat hits.
 *   - Prompt carries pre-computed deltas (numbers, top hotspots, top changed files) — no source
 *     code in the prompt — so tokens stay flat and small regardless of repo size.
 */
export async function POST(req: Request) {
  const { sha, prev } = await req.json();
  if (!sha || !prev) return NextResponse.json({ error: "need sha and prev" }, { status: 400 });

  const d = db();
  const cached = d.prepare("SELECT text, model FROM narratives WHERE sha = ? AND prev_sha = ?").get(sha, prev) as
    | { text: string; model: string }
    | undefined;
  if (cached) return NextResponse.json({ cached: true, ...cached });

  const summary = buildSummary(d, prev, sha);
  if (!summary) return NextResponse.json({ error: "commits not found" }, { status: 404 });

  if (!process.env.AI_GATEWAY_API_KEY) {
    // Deterministic fallback so the UI still renders something when no key is set.
    const text = deterministicNarrative(summary);
    return NextResponse.json({ cached: false, text, model: "fallback:rules" });
  }

  try {
    const { generateText } = await import("ai");
    const { createAnthropic } = await import("@ai-sdk/anthropic");
    const anthropic = createAnthropic({
      baseURL: "https://ai-gateway.vercel.sh/v1/anthropic",
      apiKey: process.env.AI_GATEWAY_API_KEY,
    });
    const { text } = await generateText({
      model: anthropic(MODEL.replace(/^anthropic\//, "")),
      maxTokens: 280,
      prompt: buildPrompt(summary),
    });
    d.prepare("INSERT OR REPLACE INTO narratives(sha, prev_sha, text, model, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(sha, prev, text, MODEL, Math.floor(Date.now() / 1000));
    return NextResponse.json({ cached: false, text, model: MODEL });
  } catch (e: any) {
    const text = deterministicNarrative(summary);
    return NextResponse.json({ cached: false, text, model: "fallback:rules", error: e?.message });
  }
}

interface Summary {
  prev: any;
  curr: any;
  topAddedHotspots: { path: string; churn: number; complexity: number; risk: number }[];
  topChangedFiles: { id: string; path: string; dLoc: number; dComplexity: number }[];
  addedFiles: number;
  removedFiles: number;
  message: string;
  author: string;
}

function buildSummary(d: any, prev: string, sha: string): Summary | null {
  const curr = d.prepare(`
    SELECT c.sha, c.message, c.author, c.ts,
           s.health, s.complexity_drift, s.test_coverage, s.hotspot_risk, s.dependency_rot,
           s.total_files, s.total_loc, s.total_complexity, s.num_deps
    FROM commits c JOIN scores s ON s.sha = c.sha WHERE c.sha = ?
  `).get(sha);
  const prevRow = d.prepare(`
    SELECT s.health, s.complexity_drift, s.test_coverage, s.hotspot_risk, s.dependency_rot,
           s.total_files, s.total_loc, s.total_complexity, s.num_deps
    FROM scores s WHERE s.sha = ?
  `).get(prev);
  if (!curr || !prevRow) return null;

  const hotspotsCurr = d.prepare("SELECT path, churn, complexity, risk FROM hotspots WHERE sha = ? ORDER BY risk DESC LIMIT 5").all(sha);
  const hotspotsPrev = d.prepare("SELECT path FROM hotspots WHERE sha = ?").all(prev) as { path: string }[];
  const prevSet = new Set(hotspotsPrev.map((h) => h.path));
  const topAddedHotspots = hotspotsCurr.filter((h: any) => !prevSet.has(h.path));

  // top changed nodes by complexity delta
  const changed = d.prepare(`
    SELECT b.id, b.path, b.loc - a.loc as dLoc, b.complexity - a.complexity as dComplexity
    FROM nodes a JOIN nodes b ON a.id = b.id
    WHERE a.sha = ? AND b.sha = ?
    ORDER BY ABS(b.complexity - a.complexity) DESC
    LIMIT 5
  `).all(prev, sha) as any[];

  const addedFiles = d.prepare(`SELECT COUNT(*) as n FROM nodes WHERE sha = ? AND id NOT IN (SELECT id FROM nodes WHERE sha = ?)`).get(sha, prev) as { n: number };
  const removedFiles = d.prepare(`SELECT COUNT(*) as n FROM nodes WHERE sha = ? AND id NOT IN (SELECT id FROM nodes WHERE sha = ?)`).get(prev, sha) as { n: number };

  return {
    prev: prevRow,
    curr,
    topAddedHotspots,
    topChangedFiles: changed,
    addedFiles: addedFiles.n,
    removedFiles: removedFiles.n,
    message: curr.message,
    author: curr.author,
  };
}

function buildPrompt(s: Summary): string {
  return `You are explaining why a code repository's health score dropped between two commits. Write 3-5 short sentences for an engineering audience. Be specific, no fluff.

Commit: "${truncate(s.message, 200)}" by ${s.author}
Health: ${s.prev.health.toFixed(1)} -> ${s.curr.health.toFixed(1)} (delta ${(s.curr.health - s.prev.health).toFixed(1)})

Subscore deltas (negative is worse where noted):
- complexity_drift (worse=higher): ${s.prev.complexity_drift} -> ${s.curr.complexity_drift}
- test_coverage   (worse=lower):  ${s.prev.test_coverage} -> ${s.curr.test_coverage}
- hotspot_risk    (worse=higher): ${s.prev.hotspot_risk} -> ${s.curr.hotspot_risk}
- dependency_rot  (worse=higher): ${s.prev.dependency_rot} -> ${s.curr.dependency_rot}

Repo: files ${s.prev.total_files} -> ${s.curr.total_files}, LOC ${s.prev.total_loc} -> ${s.curr.total_loc}, total complexity ${s.prev.total_complexity} -> ${s.curr.total_complexity}, deps ${s.prev.num_deps} -> ${s.curr.num_deps}.
Files added: ${s.addedFiles}, removed: ${s.removedFiles}.

Top files with biggest complexity changes:
${s.topChangedFiles.map((f) => `  - ${f.path}: dLOC=${f.dLoc}, dCx=${f.dComplexity}`).join("\n") || "  (none)"}

New hotspots that appeared in this commit:
${s.topAddedHotspots.map((h) => `  - ${h.path} (churn=${h.churn}, complexity=${h.complexity}, risk=${h.risk.toFixed(0)})`).join("\n") || "  (none)"}

Explain the drop, naming the dominant subscore and specific files.`;
}

function deterministicNarrative(s: Summary): string {
  const dh = s.curr.health - s.prev.health;
  const subs: [string, number][] = [
    ["complexity drift", (s.curr.complexity_drift - s.prev.complexity_drift) * 30],
    ["test coverage", (s.prev.test_coverage - s.curr.test_coverage) * 30],
    ["hotspot risk", (s.curr.hotspot_risk - s.prev.hotspot_risk) * 20],
    ["dependency rot", (s.curr.dependency_rot - s.prev.dependency_rot) * 20],
  ].sort((a, b) => Math.abs(b[1] as number) - Math.abs(a[1] as number));
  const [name, impact] = subs[0];
  const direction = dh < 0 ? "fell" : "rose";
  const dominantDir = (impact as number) > 0 ? `${name} worsened` : `${name} improved`;
  const files = s.topChangedFiles.slice(0, 3).map((f) => `${f.path} (Δcx=${f.dComplexity > 0 ? "+" : ""}${f.dComplexity})`).join(", ");
  const hotspots = s.topAddedHotspots.slice(0, 2).map((h) => h.path).join(", ");
  return [
    `Health ${direction} ${Math.abs(dh).toFixed(1)} points; the dominant driver was ${dominantDir}.`,
    files ? `Largest complexity swings hit ${files}.` : "",
    hotspots ? `New hotspots appeared: ${hotspots}.` : "",
    `Files ${s.prev.total_files}→${s.curr.total_files}, LOC ${s.prev.total_loc}→${s.curr.total_loc}.`,
  ].filter(Boolean).join(" ");
}

function truncate(s: string, n: number): string {
  s = s.replace(/\s+/g, " ").trim();
  return s.length > n ? s.slice(0, n) + "…" : s;
}
