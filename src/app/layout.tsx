import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Gekishin - Tournament Platform",
  description: "Competitive tournament platform with draft, scoring, and team management",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
