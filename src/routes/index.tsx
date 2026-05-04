import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { CalendarCheck, Wallet, FileText, ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "مُعافى — Mu'afa | احجز موعدك الطبي بسهولة" },
      {
        name: "description",
        content:
          "منصة مُعافى لحجز المواعيد الطبية في مراكز الأشعة والمعامل والعيادات. احجز في دقائق وادفع من محفظتك بأمان.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";
  const Arrow = isRtl ? ArrowLeft : ArrowRight;

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[image:var(--gradient-hero)] opacity-95" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,white_0%,transparent_60%)] opacity-20" />
        <div className="container relative mx-auto px-4 py-20 text-center md:py-32">
          <h1 className="mx-auto max-w-3xl text-balance text-4xl font-bold leading-tight text-primary-foreground md:text-6xl">
            {t("home.heroTitle")}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-primary-foreground/90 md:text-xl">
            {t("home.heroSubtitle")}
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" variant="secondary" className="shadow-[var(--shadow-elegant)]">
              <Link to="/facilities">
                {t("home.ctaBrowse")}
                <Arrow className="ms-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
            >
              <Link to="/register">{t("home.ctaJoin")}</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { icon: CalendarCheck, title: t("home.feature1Title"), desc: t("home.feature1Desc") },
            { icon: Wallet, title: t("home.feature2Title"), desc: t("home.feature2Desc") },
            { icon: FileText, title: t("home.feature3Title"), desc: t("home.feature3Desc") },
          ].map((f) => (
            <Card key={f.title} className="p-6 transition-shadow hover:shadow-[var(--shadow-elegant)]">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[image:var(--gradient-primary)] text-primary-foreground">
                <f.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
