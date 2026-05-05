import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Star } from "lucide-react";
import { endSession } from "@/server/sessions.functions";
import { submitRating } from "@/server/ratings.functions";

export const Route = createFileRoute("/facility/bookings")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login", search: { redirect: "/facility/bookings" } });
  },
  component: FacilityBookings,
});

interface Row {
  id: string;
  slot_start: string;
  status: string;
  price: number;
  report_url: string | null;
  user: { full_name: string | null; phone: string | null } | null;
  facility: { id: string; name: string } | null;
}

function FacilityBookings() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const endFn = useServerFn(endSession);
  const rateFn = useServerFn(submitRating);

  const load = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data: facs } = await supabase.from("facilities").select("id").eq("owner_id", u.user.id);
    const ids = (facs ?? []).map((f) => f.id);
    if (ids.length === 0) { setRows([]); return; }
    const { data } = await supabase
      .from("bookings")
      .select("id,slot_start,status,price,report_url,user:profiles!bookings_user_id_fkey(full_name,phone),facility:facilities(id,name)")
      .in("facility_id", ids)
      .order("slot_start", { ascending: false });
    setRows((data as unknown as Row[]) ?? []);
  };

  useEffect(() => { load(); }, []);

  const upcoming = (rows ?? []).filter((r) => r.status === "upcoming");
  const completed = (rows ?? []).filter((r) => r.status === "completed");

  return (
    <div className="container mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold">Facility Bookings</h1>
      <Tabs defaultValue="upcoming" className="mt-6">
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completed.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="upcoming" className="mt-4 space-y-3">
          {upcoming.length === 0 && <p className="text-sm text-muted-foreground">No upcoming bookings.</p>}
          {upcoming.map((r) => (
            <BookingCard
              key={r.id}
              r={r}
              onEnd={async (reportUrl) => {
                try {
                  await endFn({ data: { bookingId: r.id, reportUrl: reportUrl || null } });
                  toast.success("Session marked as completed");
                  load();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed");
                }
              }}
            />
          ))}
        </TabsContent>
        <TabsContent value="completed" className="mt-4 space-y-3">
          {completed.length === 0 && <p className="text-sm text-muted-foreground">No completed bookings yet.</p>}
          {completed.map((r) => (
            <Card key={r.id} className="flex items-center justify-between p-4">
              <div>
                <h3 className="font-semibold">{r.user?.full_name ?? "Patient"}</h3>
                <p className="text-sm text-muted-foreground">{new Date(r.slot_start).toLocaleString()}</p>
              </div>
              <RateUserButton
                onSubmit={async (stars, comment) => {
                  try {
                    await rateFn({ data: { bookingId: r.id, stars, comment, direction: "facility_to_user" } });
                    toast.success("Rating submitted");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Failed");
                  }
                }}
              />
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BookingCard({ r, onEnd }: { r: Row; onEnd: (reportUrl: string) => void }) {
  const [open, setOpen] = useState(false);
  const [reportUrl, setReportUrl] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Card className="flex flex-wrap items-center justify-between gap-4 p-4">
      <div>
        <h3 className="font-semibold">{r.user?.full_name ?? "Patient"}</h3>
        <p className="text-sm text-muted-foreground">{new Date(r.slot_start).toLocaleString()}</p>
        {r.user?.phone && <p className="text-xs text-muted-foreground">{r.user.phone}</p>}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm">End session</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>End session</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Medical report URL (optional)</Label>
              <Input value={reportUrl} onChange={(e) => setReportUrl(e.target.value)} placeholder="https://…" />
              <p className="text-xs text-muted-foreground">Paste a link to the patient's report. Funds will be released and credited to your wallet.</p>
            </div>
            <Button
              className="w-full"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await onEnd(reportUrl);
                setBusy(false);
                setOpen(false);
              }}
            >
              {busy ? "Saving..." : "Confirm completion"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function RateUserButton({ onSubmit }: { onSubmit: (stars: number, comment: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Rate patient</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Rate patient</DialogTitle></DialogHeader>
        <StarPicker value={stars} onChange={setStars} />
        <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Optional comment" />
        <Button onClick={async () => { await onSubmit(stars, comment); setOpen(false); }}>Submit</Button>
      </DialogContent>
    </Dialog>
  );
}

export function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)} aria-label={`${n} stars`}>
          <Star className={`h-7 w-7 ${n <= value ? "fill-warning text-warning" : "text-muted-foreground"}`} />
        </button>
      ))}
    </div>
  );
}
