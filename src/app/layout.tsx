import type { Metadata } from "next";
import { Big_Shoulders, Big_Shoulders_Stencil, Courier_Prime, Public_Sans } from "next/font/google";
import "./globals.css";

/* Public-building signage for headings, stencil for door plates,
   a typewriter for the intercom transcript, a civic workhorse for text. */
const shoulders = Big_Shoulders({ variable: "--font-shoulders", subsets: ["latin"], weight: ["500", "700", "800"] });
const stencil = Big_Shoulders_Stencil({ variable: "--font-stencil", subsets: ["latin"], weight: ["600", "800"] });
const courier = Courier_Prime({ variable: "--font-courier", subsets: ["latin"], weight: ["400", "700"], style: ["normal", "italic"] });
const publicSans = Public_Sans({ variable: "--font-public", subsets: ["latin"], style: ["normal", "italic"] });

export const metadata: Metadata = {
  title: "AI Interrogation",
  description: "Two AI models, interrogated separately. Watch what they say — and what they do.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${shoulders.variable} ${stencil.variable} ${courier.variable} ${publicSans.variable} h-full antialiased`}
    >
      <body className="stage-bg grain min-h-full flex flex-col">{children}</body>
    </html>
  );
}
