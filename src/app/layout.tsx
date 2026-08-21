import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { QueryProvider } from "@/components/query-provider";
import { Analytics } from "@vercel/analytics/next";

const outfit = Outfit({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Cell City — Mobile Spare Parts OS",
  description:
    "Modern operating system for mobile repair shops & spare-parts wholesalers. Smart inventory, AI-powered identification, compatibility engine, sales & analytics.",
  keywords: [
    "mobile spare parts",
    "LCD inventory",
    "phone repair shop software",
    "compatibility database",
    "AI phone identification",
    "repair shop POS",
  ],
  icons: { 
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
    apple: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "Cell City — Mobile Spare Parts OS",
    description: "Smart inventory management for mobile repair businesses",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${outfit.variable} font-sans antialiased bg-background text-foreground`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>{children}</QueryProvider>
          <Toaster 
            richColors 
            position="top-right"
            toastOptions={{
              className: 'font-sans',
              duration: 4000,
            }}
          />
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
