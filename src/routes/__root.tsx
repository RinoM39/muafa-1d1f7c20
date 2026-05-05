import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth-context";
import { Header } from "@/components/Header";
import "@/i18n";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "مُعافى — Mu'afa | احجز موعدك الطبي" },
      {
        name: "description",
        content:
          "Mu'afa (مُعافى) — book appointments at radiology centers, labs, and clinics. Secure wallet, instant booking, medical reports.",
      },
      { name: "theme-color", content: "#5A9789" },
      { property: "og:title", content: "مُعافى — Mu'afa | احجز موعدك الطبي" },
      { property: "og:description", content: "Mu'afa Health Connect is a medical booking platform for users and facilities." },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "مُعافى — Mu'afa | احجز موعدك الطبي" },
      { name: "description", content: "Mu'afa Health Connect is a medical booking platform for users and facilities." },
      { name: "twitter:description", content: "Mu'afa Health Connect is a medical booking platform for users and facilities." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/1e91e759-7bcc-4320-b107-cef5b437607c/id-preview-251cfdea--86029d14-1849-4359-9318-c0058ba90519.lovable.app-1777900087409.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/1e91e759-7bcc-4320-b107-cef5b437607c/id-preview-251cfdea--86029d14-1849-4359-9318-c0058ba90519.lovable.app-1777900087409.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "preload",
        as: "style",
        href: "https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&family=Tajawal:wght@400;500;700&family=Inter:wght@400;500;600;700&display=swap",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&family=Tajawal:wght@400;500;700&family=Inter:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <AuthProvider>
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">
          <Outlet />
        </main>
        <footer className="border-t bg-muted/30">
          <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} مُعافى · Mu'afa
          </div>
        </footer>
      </div>
      <Toaster richColors position="top-center" />
    </AuthProvider>
  );
}
