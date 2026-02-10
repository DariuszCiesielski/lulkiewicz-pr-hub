import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lulkiewicz PR Hub",
  description: "Wewnętrzna platforma narzędziowa dla agencji PR",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
