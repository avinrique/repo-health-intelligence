/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["better-sqlite3", "tree-sitter", "tree-sitter-javascript", "tree-sitter-typescript", "tree-sitter-python"],
};
export default nextConfig;
