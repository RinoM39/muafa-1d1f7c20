import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/account/bookings")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login", search: { redirect: "/account/bookings" } });
  },
  component: BookingsPage,
});

interface BookingRow {
  id: string;
  slot_start: string;
  slot_end: string;
  status: string;
  price: number;
  report_url: string | null;
  facility: { name: string; image_url: string | null } | null;
}

function BookingsPage() {
  const [bookings, setBookings] = useState<BookingRow[] | null>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase
        .from("bookings")
        .select("id,slot_start,slot_end,status,price,report_url,facility:facilities(name,image_url)")
        .eq("user_id", u.user.id)
        .order("slot_start", { ascending: false });
      setBookings((data as unknown as BookingRow[]) ?? []);
    })();
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
          {upcoming.map((b) => (
            <BookingCard key={b.id} b={b} />
          ))}
        </TabsContent>
        <TabsContent value="past" className="mt-4 space-y-3">
          {past.length === 0 && <p className="text-sm text-muted-foreground">No past bookings yet.</p>}
          {past.map((b) => (
            <BookingCard key={b.id} b={b} />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BookingCard({ b }: { b: BookingRow }) {
  const date = new Date(b.slot_start);
  return (
    <Card className="flex items-center gap-4 p-4">
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
        {b.facility?.image_url && (
          <img src={b.facility.image_url} alt="" className="h-full w-full object-cover" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="truncate font-semibold">{b.facility?.name ?? "—"}</h3>
        <p className="text-sm text-muted-foreground">{date.toLocaleString()}</p>
        <p className="mt-1 text-xs uppercase tracking-wide text-primary">{b.status}</p>
      </div>
      <div className="text-end">
        <div className="font-semibold">{Number(b.price).toFixed(2)}</div>
        {b.report_url && (
          <a href={b.report_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
            View report
          </a>
        )}
      </div>
    </Card>
  );
}
