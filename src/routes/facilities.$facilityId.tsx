import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Star, MapPin, Phone, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-context";
import { generateUpcomingDays, formatDay, formatSlotTime, type ScheduleConfig } from "@/lib/slots";
import { createBooking } from "@/server/bookings.functions";

export const Route = createFileRoute("/facilities/$facilityId")({
  component: FacilityDetails,
});

interface Facility {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  location_url: string | null;
  phone: string | null;
  price: number;
  session_duration_min: number;
  start_time: string;
  end_time: string;
  working_days: number[];
  avg_rating: number;
  ratings_count: number;
  owner_id: string;
}

function FacilityDetails() {
  const { facilityId } = useParams({ from: "/facilities/$facilityId" });
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const bookFn = useServerFn(createBooking);

  const [facility, setFacility] = useState<Facility | null>(null);
  const [bookedIsos, setBookedIsos] = useState<Set<string>>(new Set());
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: f } = await supabase
        .from("facilities")
        .select("id,name,description,image_url,location_url,phone,price,session_duration_min,start_time,end_time,working_days,avg_rating,ratings_count,owner_id")
        .eq("id", facilityId)
        .maybeSingle();
      setFacility(f as Facility | null);

      if (f) {
        const horizon = new Date();
        horizon.setDate(horizon.getDate() + 8);
        const { data: bookings } = await supabase
          .from("bookings")
          .select("slot_start,status")
          .eq("facility_id", facilityId)
          .gte("slot_start", new Date().toISOString())
          .lt("slot_start", horizon.toISOString());
        const set = new Set<string>();
        (bookings ?? []).forEach((b) => {
          if (b.status !== "cancelled") set.add(new Date(b.slot_start).toISOString());
        });
        setBookedIsos(set);
      }
    })();
  }, [facilityId]);

  const days = useMemo(() => {
    if (!facility) return [];
    const cfg: ScheduleConfig = {
      start_time: facility.start_time,
      end_time: facility.end_time,
      session_duration_min: facility.session_duration_min,
      working_days: facility.working_days,
    };
    return generateUpcomingDays(cfg).map((d) => ({
      ...d,
      slots: d.slots.map((s) => ({ ...s, taken: bookedIsos.has(s.iso) })),
    }));
  }, [facility, bookedIsos]);

  const selectedDay = days[selectedDayIdx];

  const handleBook = async () => {
    if (!user) {
      navigate({ to: "/login", search: { redirect: `/facilities/${facilityId}` } });
      return;
    }
    if (!selectedIso) return;
    setLoading(true);
    try {
      // Pre-check: fast UX guard before the server-side unique constraint kicks in.
      const { data: existing } = await supabase
        .from("bookings")
        .select("id,status")
        .eq("facility_id", facilityId)
        .eq("slot_start", selectedIso)
        .neq("status", "cancelled")
        .maybeSingle();
      if (existing) {
        setBookedIsos((prev) => new Set(prev).add(selectedIso));
        setSelectedIso(null);
        toast.error("This slot is already booked.");
        return;
      }

      await bookFn({ data: { facilityId, slotStartIso: selectedIso } });
      toast.success(t("facilities.bookingSuccess"));
      navigate({ to: "/account/bookings" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("INSUFFICIENT_BALANCE")) toast.error(t("facilities.insufficientBalance"));
      else if (msg.includes("SLOT_TAKEN")) toast.error("This slot is already booked.");
      else if (msg.includes("OWN_FACILITY")) toast.error("You cannot book your own facility.");
      else toast.error(t("facilities.bookingFailed"));
    } finally {
      setLoading(false);
    }
  };

  if (!facility) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-10">
        <Skeleton className="h-72 w-full rounded-xl" />
        <Skeleton className="mt-6 h-8 w-1/2" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="overflow-hidden rounded-2xl bg-muted">
          {facility.image_url ? (
            <img src={facility.image_url} alt={facility.name} className="aspect-square w-full object-cover" />
          ) : (
            <div className="flex aspect-square w-full items-center justify-center bg-[image:var(--gradient-primary)] text-primary-foreground">
              <MapPin className="h-16 w-16 opacity-60" />
            </div>
          )}
        </div>

        <div>
          <h1 className="text-3xl font-bold">{facility.name}</h1>
          <div className="mt-2 flex items-center gap-1 text-sm">
            <Star className="h-4 w-4 fill-warning text-warning" />
            <span className="font-medium">{facility.avg_rating.toFixed(1)}</span>
            <span className="text-muted-foreground">({facility.ratings_count})</span>
          </div>
          {facility.description && <p className="mt-4 text-muted-foreground">{facility.description}</p>}

          <div className="mt-6 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              {facility.session_duration_min} {t("facilities.minutes")}
            </div>
            {facility.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-primary" /> {facility.phone}
              </div>
            )}
            {facility.location_url && (
              <a href={facility.location_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-primary hover:underline">
                <MapPin className="h-4 w-4" /> {facility.location_url}
              </a>
            )}
          </div>

          <div className="mt-6 rounded-xl bg-[image:var(--gradient-primary)] p-4 text-primary-foreground">
            <div className="text-sm opacity-90">{t("common.price")}</div>
            <div className="text-3xl font-bold">
              {facility.price} <span className="text-base font-normal">{t("common.currency")}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Day picker */}
      <Card className="mt-8 p-6">
        <h2 className="text-lg font-semibold">{t("facilities.selectDay")}</h2>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
          {days.map((d, i) => (
            <button
              key={d.date.toISOString()}
              onClick={() => { setSelectedDayIdx(i); setSelectedIso(null); }}
              className={`shrink-0 rounded-xl border px-4 py-3 text-sm transition ${
                i === selectedDayIdx
                  ? "border-primary bg-primary text-primary-foreground"
                  : "hover:border-primary/50"
              }`}
            >
              {formatDay(d.date, i18n.language)}
            </button>
          ))}
        </div>

        <h2 className="mt-6 text-lg font-semibold">{t("facilities.selectTime")}</h2>
        {selectedDay && selectedDay.slots.length > 0 ? (
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-5">
            {selectedDay.slots.map((s) => (
              <button
                key={s.iso}
                disabled={s.taken}
                onClick={() => setSelectedIso(s.iso)}
                className={`rounded-lg border px-3 py-2 text-sm transition ${
                  s.taken
                    ? "cursor-not-allowed border-dashed bg-muted text-muted-foreground line-through"
                    : selectedIso === s.iso
                      ? "border-primary bg-primary text-primary-foreground"
                      : "hover:border-primary/50"
                }`}
              >
                {formatSlotTime(s.start, i18n.language)}
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">{t("facilities.noSlots")}</p>
        )}

        {user && facility && (facility as Facility & { owner_id?: string }).owner_id === user.id ? (
          <p className="mt-6 text-sm text-muted-foreground">You cannot book your own facility.</p>
        ) : (
          <Button onClick={handleBook} disabled={!selectedIso || loading} className="mt-6 w-full md:w-auto">
            {loading ? t("common.loading") : t("facilities.confirmBooking")}
          </Button>
        )}
      </Card>
    </div>
  );
}
