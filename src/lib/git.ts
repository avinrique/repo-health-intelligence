import simpleGit, { SimpleGit } from "simple-git";
import fs from "node:fs";
import path from "node:path";

export interface CommitMeta {
  sha: string;
  parent: string | null;
  author: string;
  email: string;
  ts: number;
  message: string;
}

const REPOS_DIR = path.join(process.cwd(), "data", "repos");

export async function cloneOrOpen(url: string, branch = "main"): Promise<{ git: SimpleGit; cwd: string }> {
  fs.mkdirSync(REPOS_DIR, { recursive: true });
  const slug = url.replace(/[^a-zA-Z0-9]+/g, "_");
  const cwd = path.join(REPOS_DIR, slug);
  if (!fs.existsSync(path.join(cwd, ".git"))) {
    const g = simpleGit();
    await g.clone(url, cwd, ["--no-checkout", "--branch", branch]);
  }
  const git = simpleGit(cwd);
  await git.checkout(branch).catch(() => undefined);
  return { git, cwd };
}

export async function listCommits(git: SimpleGit, branch = "main", maxCommits = 600): Promise<CommitMeta[]> {
  // oldest -> newest
  const log = await git.log([branch, `--max-count=${maxCommits}`, "--reverse"]);
  return log.all.map((c) => ({
    sha: c.hash,
    parent: null, // filled below
    author: c.author_name,
    email: c.author_email,
    ts: Math.floor(new Date(c.date).getTime() / 1000),
    message: c.message,
  }));
}

export async function fillParents(git: SimpleGit, commits: CommitMeta[]): Promise<CommitMeta[]> {
  for (const c of commits) {
    const parents = (await git.raw(["rev-list", "--parents", "-n", "1", c.sha])).trim().split(/\s+/);
    c.parent = parents[1] || null;
  }
  return commits;
}

export async function checkout(git: SimpleGit, sha: string): Promise<void> {
  await git.raw(["checkout", "-q", "--force", sha]);
}

export async function changedFiles(git: SimpleGit, sha: string, parent: string | null): Promise<string[]> {
  if (!parent) {
    const out = await git.raw(["ls-tree", "-r", "--name-only", sha]);
    return out.split("\n").filter(Boolean);
  }
  const out = await git.raw(["diff", "--name-only", `${parent}..${sha}`]);
  return out.split("\n").filter(Boolean);
}
