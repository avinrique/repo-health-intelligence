import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Repo Health Intelligence",
  description: "Track how a codebase evolves over time",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
