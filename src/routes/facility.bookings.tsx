import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/lib/route-guards";
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
import { Star, Upload, FileText, CheckCircle2, ShieldCheck, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { endSession } from "@/server/sessions.functions";
import { submitRating } from "@/server/ratings.functions";

export const Route = createFileRoute("/facility/bookings")({
  beforeLoad: () => requireAuth("/facility/bookings"),
  component: FacilityBookings,
});

interface Row {
  id: string;
  user_id: string;
  slot_start: string;
  status: string;
  price: number;
  report_url: string | null;
  user?: { full_name: string | null; phone: string | null } | null;
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
      .select("id,user_id,slot_start,status,price,report_url,facility:facilities(id,name)")
      .in("facility_id", ids)
      .order("slot_start", { ascending: false });
    const list = (data as unknown as Row[]) ?? [];
    const userIds = Array.from(new Set(list.map((r) => r.user_id)));
    if (userIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles").select("id,full_name,phone").in("id", userIds);
      const map = new Map((profs ?? []).map((p) => [p.id, p]));
      list.forEach((r) => { r.user = map.get(r.user_id) ?? null; });
    }
    setRows(list);
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
            <Card key={r.id} className="space-y-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
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
              </div>
              <ReportUploader bookingId={r.id} onSaved={load} />
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BookingCard({ r, onEnd }: { r: Row; onEnd: (reportUrl: string) => Promise<void> | void }) {
  const [open, setOpen] = useState(false);
  const [reportUrl, setReportUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");
  const rateFn = useServerFn(submitRating);

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
                try {
                  await onEnd(reportUrl);
                  setOpen(false);
                  setRateOpen(true);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Saving..." : "Confirm completion"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={rateOpen} onOpenChange={setRateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rate patient</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <StarPicker value={stars} onChange={setStars} />
            <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Optional comment" />
            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={async () => {
                  try {
                    await rateFn({ data: { bookingId: r.id, stars, comment, direction: "facility_to_user" } });
                    toast.success("Rating submitted");
                    setRateOpen(false);
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Failed");
                  }
                }}
              >
                Submit rating
              </Button>
              <Button variant="ghost" onClick={() => setRateOpen(false)}>Skip</Button>
            </div>
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

function ReportUploader({ bookingId, onSaved }: { bookingId: string; onSaved: () => void }) {
  const [existing, setExisting] = useState<{ file_url: string; file_path: string; doctor_note: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [note, setNote] = useState("");
  const [justSaved, setJustSaved] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("medical_reports")
      .select("file_url,file_path,doctor_note")
      .eq("booking_id", bookingId)
      .maybeSingle();
    setExisting(data ?? null);
    setNote(data?.doctor_note ?? "");
    setLoading(false);
  };

  useEffect(() => { load(); }, [bookingId]);

  const handleFile = async (file: File) => {
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "application/pdf"];
    if (!allowed.includes(file.type)) {
      toast.error("Only JPG, PNG or PDF files are allowed");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File must be under 10MB");
      return;
    }
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not authenticated");
      const ext = file.name.split(".").pop() || "bin";
      const path = `${bookingId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("medical-reports")
        .upload(path, file, { contentType: file.type, upsert: true });
      if (upErr) throw upErr;

      const { data: booking } = await supabase
        .from("bookings").select("user_id,facility_id").eq("id", bookingId).maybeSingle();
      if (!booking) throw new Error("Booking not found");

      const payload = {
        booking_id: bookingId,
        user_id: booking.user_id,
        facility_id: booking.facility_id,
        file_path: path,
        file_url: path,
        doctor_note: note || null,
      };
      const { error: dbErr } = await supabase
        .from("medical_reports")
        .upsert(payload, { onConflict: "booking_id" });
      if (dbErr) throw dbErr;

      toast.success("Report uploaded successfully");
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 3000);
      await load();
      onSaved();
    } catch (e) {
      console.error("[report upload]", e);
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const saveNote = async () => {
    if (!existing) return;
    const { error } = await supabase
      .from("medical_reports")
      .update({ doctor_note: note || null })
      .eq("booking_id", bookingId);
    if (error) toast.error(error.message);
    else toast.success("Note updated");
  };

  if (loading) return <div className="h-12 animate-pulse rounded-md bg-muted" />;

  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
        <ShieldCheck className="h-4 w-4 text-primary" />
        Medical Report
        {existing && (
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-success">
            <CheckCircle2 className="h-3.5 w-3.5" /> Uploaded
          </span>
        )}
      </div>

      {existing ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4 text-primary" />
            <span className="truncate text-muted-foreground">{existing.file_path.split("/").pop()}</span>
          </div>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Doctor's note (optional)"
            rows={2}
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={saveNote}>Save note</Button>
            <label>
              <input
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                className="hidden"
                onChange={(e) => e.target.files && handleFile(e.target.files[0])}
              />
              <Button size="sm" variant="ghost" asChild disabled={uploading}>
                <span>{uploading ? "Uploading..." : "Replace file"}</span>
              </Button>
            </label>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Doctor's note (optional)"
            rows={2}
          />
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed border-border px-4 py-6 text-sm text-muted-foreground transition hover:border-primary hover:bg-primary/5">
            {uploading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Uploading...</>
            ) : justSaved ? (
              <><CheckCircle2 className="h-4 w-4 text-success" /> Saved</>
            ) : (
              <><Upload className="h-4 w-4" /> Upload Report (JPG, PNG, PDF)</>
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              className="hidden"
              disabled={uploading}
              onChange={(e) => e.target.files && handleFile(e.target.files[0])}
            />
          </label>
        </div>
      )}
    </div>
  );
}
