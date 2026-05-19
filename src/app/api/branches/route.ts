import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cloneOrOpen } from "@/lib/git";

export const dynamic = "force-dynamic";

export async function GET() {
  const d = db();
  const repo = d.prepare("SELECT url, branch FROM repo WHERE id = 1").get() as { url: string; branch: string } | undefined;
  if (!repo) return NextResponse.json({ branches: [], current: null });
  try {
    const { git } = await cloneOrOpen(repo.url, repo.branch);
    // Pull all remote branches so we know what's available to predict against.
    const out = await git.raw(["ls-remote", "--heads", repo.url]);
    const remote = out
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => l.split(/\s+/)[1])
      .filter((r) => r && r.startsWith("refs/heads/"))
      .map((r) => r.replace("refs/heads/", ""));
    return NextResponse.json({ branches: remote, current: repo.branch });
  } catch (e: any) {
    return NextResponse.json({ branches: [], current: repo.branch, error: e?.message });
  }
}
