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
    await git.fetch().catch(() => undefined);
    const out = await git.raw(["for-each-ref", "--format=%(refname:short)", "refs/heads/"]);
    const branches = out.split("\n").map((b) => b.trim()).filter(Boolean);
    return NextResponse.json({ branches, current: repo.branch });
  } catch (e: any) {
    return NextResponse.json({ branches: [], current: repo.branch, error: e?.message });
  }
}
