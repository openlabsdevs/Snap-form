import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import ReduxProvider from "@/providers/redux-provider";
import QueryProvider from "@/providers/query-provider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Snap-Form | Forms at the speed of thought",
  description:
    "The AI-native form builder for technical teams. Describe your logic, and let the engine generate production-ready interfaces instantly.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`h-full antialiased ${inter.variable} ${spaceGrotesk.variable}`}
    >
      <body className="min-h-full flex flex-col font-[family-name:var(--font-inter)]">
        <ReduxProvider>
          <QueryProvider>{children}</QueryProvider>
        </ReduxProvider>
      </body>
    </html>
  );
}
