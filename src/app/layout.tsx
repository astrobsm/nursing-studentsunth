import type { Metadata, Viewport } from "next";
import Image from "next/image";
import "./globals.css";
import ServiceWorkerRegistration from "./components/ServiceWorkerRegistration";
import NetworkStatusBar from "./components/NetworkStatusBar";

export const viewport: Viewport = {
  themeColor: "#006400",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "2nd Year Nursing Quiz – Cardiovascular Disorders",
  description: "Online assessment for 2nd Year Nursing Students – Cardiovascular Disorders",
  icons: { icon: "/logo.png", apple: "/logo.png" },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Nursing Quiz",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <ServiceWorkerRegistration />
        <div className="min-h-screen flex flex-col">
          {/* Header */}
          <header className="bg-green-deep text-white py-3 px-4 shadow-lg">
            <div className="max-w-4xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Image
                  src="/logo.png"
                  alt="UNTH School of Nursing"
                  width={44}
                  height={44}
                  className="rounded-sm"
                  priority
                />
                <div>
                  <h1 className="text-lg font-bold leading-tight">UNTH School of Nursing</h1>
                  <p className="text-green-light text-xs">Cardiovascular Disorders Quiz</p>
                </div>
              </div>
            </div>
          </header>

          {/* Main Content with Watermark */}
          <main className="flex-1 flex items-center justify-center p-4 relative">
            {/* Centered Watermark */}
            <div className="watermark-container" aria-hidden="true">
              <Image
                src="/logo.png"
                alt=""
                width={280}
                height={280}
                className="watermark-image"
                priority
              />
            </div>
            <div className="w-full max-w-2xl relative z-10">
              {children}
            </div>
          </main>

          {/* Footer */}
          <footer className="bg-green-deep text-green-light text-center py-3 text-xs">
            <p>© 2026 UNTH School of Nursing • All Rights Reserved</p>
            <a
              href="/admin"
              className="inline-block mt-1 text-green-light/40 hover:text-yellow-accent transition-colors text-[10px] tracking-wide"
            >
              🔒 Admin
            </a>
          </footer>
        </div>
        <NetworkStatusBar />
      </body>
    </html>
  );
}
