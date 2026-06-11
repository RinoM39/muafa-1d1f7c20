import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Star, MapPin, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/facilities/")({
  head: () => ({
    meta: [
      { title: "المنشآت الطبية — مُعافى" },
      { name: "description", content: "تصفح المنشآت الطبية المتاحة على مُعافى واحجز موعدك." },
    ],
  }),
  component: FacilitiesList,
});

interface FacilityRow {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number;
  avg_rating: number;
  ratings_count: number;
  session_duration_min: number;
}

function FacilitiesList() {
  const { t } = useTranslation();
  const [facilities, setFacilities] = useState<FacilityRow[] | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    supabase
      .from("facilities")
      .select("id,name,description,image_url,price,avg_rating,ratings_count,session_duration_min")
      .eq("is_active", true)
      .eq("is_banned", false)
      .order("avg_rating", { ascending: false })
      .then(({ data }) => setFacilities(data ?? []));
  }, []);

  const filtered = useMemo(() => {
    if (!facilities) return null;
    const q = query.trim().toLowerCase();
    if (!q) return facilities;
    return facilities.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        (f.description ?? "").toLowerCase().includes(q),
    );
  }, [facilities, query]);

  return (
    <div className="container mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold">{t("facilities.title")}</h1>

      <div className="relative mt-6 max-w-xl">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("common.search")}
          className="h-11 ps-9"
        />
      </div>


      {facilities === null && (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full rounded-xl" />
          ))}
        </div>
      )}

      {filtered && filtered.length === 0 && (
        <div className="mt-12 rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          {t("facilities.empty")}
        </div>
      )}

      {filtered && filtered.length > 0 && (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((f) => (
            <Card key={f.id} className="group overflow-hidden p-0 transition-shadow hover:shadow-[var(--shadow-elegant)]">
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
                {f.image_url ? (
                  <img
                    src={f.image_url}
                    alt={f.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[image:var(--gradient-primary)] text-primary-foreground">
                    <MapPin className="h-12 w-12 opacity-60" />
                  </div>
                )}
                <div className="absolute top-3 end-3 flex items-center gap-1 rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium shadow">
                  <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                  {f.avg_rating.toFixed(1)}
                  <span className="text-muted-foreground">({f.ratings_count})</span>
                </div>
              </div>
              <div className="p-4">
                <h3 className="text-lg font-semibold">{f.name}</h3>
                {f.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{f.description}</p>
                )}
                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-2xl font-bold text-primary">
                    {f.price} <span className="text-sm font-normal text-muted-foreground">{t("common.currency")}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {f.session_duration_min} {t("facilities.minutes")}
                  </span>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button asChild variant="outline" className="flex-1">
                    <Link to="/facilities/$facilityId" params={{ facilityId: f.id }}>
                      {t("common.viewDetails")}
                    </Link>
                  </Button>
                  <Button asChild className="flex-1">
                    <Link to="/facilities/$facilityId" params={{ facilityId: f.id }}>
                      {t("common.bookNow")}
                    </Link>
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
