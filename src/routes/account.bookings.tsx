import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/lib/route-guards";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Star } from "lucide-react";
import { submitRating } from "@/server/ratings.functions";

export const Route = createFileRoute("/account/bookings")({
  beforeLoad: () => requireAuth("/account/bookings"),
  component: BookingsPage,
});

interface BookingRow {
  id: string;
  slot_start: string;
  slot_end: string;
  status: string;
  price: number;
  report_url: string | null;
  facility: { id: string; name: string; image_url: string | null } | null;
}

function BookingsPage() {
  const [bookings, setBookings] = useState<BookingRow[] | null>(null);
  const [rated, setRated] = useState<Set<string>>(new Set());
  const rateFn = useServerFn(submitRating);

  const load = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data: rows, error } = await supabase
      .from("bookings")
      .select("id,slot_start,slot_end,status,price,report_url,facility_id")
      .eq("user_id", u.user.id)
      .order("slot_start", { ascending: false });
    if (error) {
      console.error("[bookings] load failed", error);
      toast.error("Failed to load bookings");
      setBookings([]);
      return;
    }
    const facilityIds = Array.from(new Set((rows ?? []).map((b) => b.facility_id)));
    let facilityMap: Record<string, { id: string; name: string; image_url: string | null }> = {};
    if (facilityIds.length > 0) {
      const { data: fs } = await supabase
        .from("facilities")
        .select("id,name,image_url")
        .in("id", facilityIds);
      facilityMap = Object.fromEntries((fs ?? []).map((f) => [f.id, f]));
    }
    setBookings(
      (rows ?? []).map((b) => ({
        id: b.id,
        slot_start: b.slot_start,
        slot_end: b.slot_end,
        status: b.status,
        price: b.price,
        report_url: b.report_url,
        facility: facilityMap[b.facility_id] ?? null,
      })) as BookingRow[],
    );

    const { data: r } = await supabase
      .from("ratings")
      .select("booking_id")
      .eq("rater_id", u.user.id)
      .eq("direction", "user_to_facility");
    setRated(new Set((r ?? []).map((x) => x.booking_id)));
  };

  useEffect(() => {
    load();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      channel = supabase
        .channel(`bookings:${u.user.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "bookings", filter: `user_id=eq.${u.user.id}` },
          () => load(),
        )
        .subscribe();
    })();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, []);

  const now = Date.now();
  const upcoming = (bookings ?? []).filter((b) => new Date(b.slot_start).getTime() > now && b.status === "upcoming");
  const past = (bookings ?? []).filter((b) => !(new Date(b.slot_start).getTime() > now && b.status === "upcoming"));

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">My Bookings</h1>
      <Tabs defaultValue="upcoming" className="mt-6">
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="past">Past ({past.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="upcoming" className="mt-4 space-y-3">
          {upcoming.length === 0 && <p className="text-sm text-muted-foreground">No upcoming bookings.</p>}
          {upcoming.map((b) => <BookingCard key={b.id} b={b} />)}
        </TabsContent>
        <TabsContent value="past" className="mt-4 space-y-3">
          {past.length === 0 && <p className="text-sm text-muted-foreground">No past bookings yet.</p>}
          {past.map((b) => (
            <BookingCard
              key={b.id}
              b={b}
              showRate={b.status === "completed" && !rated.has(b.id)}
              onRate={async (stars, comment) => {
                try {
                  await rateFn({ data: { bookingId: b.id, stars, comment, direction: "user_to_facility" } });
                  toast.success("Thanks for rating!");
                  load();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed");
                }
              }}
            />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BookingCard({
  b, showRate, onRate,
}: {
  b: BookingRow;
  showRate?: boolean;
  onRate?: (stars: number, comment: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");

  return (
    <Card className="flex flex-wrap items-center gap-4 p-4">
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
        {b.facility?.image_url && <img src={b.facility.image_url} alt="" className="h-full w-full object-cover" />}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="truncate font-semibold">{b.facility?.name ?? "—"}</h3>
        <p className="text-sm text-muted-foreground">{new Date(b.slot_start).toLocaleString()}</p>
        <p className="mt-1 text-xs uppercase tracking-wide text-primary">{b.status}</p>
      </div>
      <div className="flex flex-col items-end gap-2">
        <div className="font-semibold">{Number(b.price).toFixed(2)}</div>
        {b.report_url && (
          <a href={b.report_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
            View report
          </a>
        )}
        {showRate && onRate && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">Rate</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Rate your visit</DialogTitle></DialogHeader>
              <div className="flex gap-1">
                {[1,2,3,4,5].map((n) => (
                  <button key={n} type="button" onClick={() => setStars(n)}>
                    <Star className={`h-7 w-7 ${n <= stars ? "fill-warning text-warning" : "text-muted-foreground"}`} />
                  </button>
                ))}
              </div>
              <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Optional comment" />
              <Button onClick={async () => { await onRate(stars, comment); setOpen(false); }}>Submit</Button>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </Card>
  );
}
