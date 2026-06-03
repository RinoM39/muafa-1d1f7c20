import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/lib/route-guards";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Star,
  CalendarClock,
  MapPin,
  Phone,
  Hash,
  FileText,
  Building2,
  CheckCircle2,
  Clock,
  AlertCircle,
  ShieldCheck,
  Download,
  ZoomIn,
  ZoomOut,
  X,
  Lock,
} from "lucide-react";
import { submitRating } from "@/lib/ratings.functions";

export const Route = createFileRoute("/account/bookings")({
  beforeLoad: () => requireAuth("/account/bookings"),
  component: BookingsPage,
});

interface FacilityInfo {
  id: string;
  name: string;
  image_url: string | null;
  phone: string | null;
  location_url: string | null;
}

interface BookingRow {
  id: string;
  slot_start: string;
  slot_end: string;
  status: string;
  price: number;
  report_url: string | null;
  facility: FacilityInfo | null;
}

function BookingsPage() {
  const [bookings, setBookings] = useState<BookingRow[] | null>(null);
  const [rated, setRated] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<BookingRow | null>(null);
  const [rateOpen, setRateOpen] = useState(false);
  const [autoPrompted, setAutoPrompted] = useState<Set<string>>(new Set());
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
    let facilityMap: Record<string, FacilityInfo> = {};
    if (facilityIds.length > 0) {
      const { data: fs } = await supabase
        .from("facilities")
        .select("id,name,image_url,phone,location_url")
        .in("id", facilityIds);
      facilityMap = Object.fromEntries((fs ?? []).map((f) => [f.id, f as FacilityInfo]));
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
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    (async () => {
      await load();
      const { data: u } = await supabase.auth.getUser();
      if (!u.user || cancelled) return;
      channel = supabase.channel(`bookings-${u.user.id}-${Math.random().toString(36).slice(2)}`);
      channel
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "bookings", filter: `user_id=eq.${u.user.id}` },
          () => load(),
        )
        .subscribe();
    })();
    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  // Auto-open rating dialog when a completed, unrated booking is found
  useEffect(() => {
    if (!bookings || rateOpen || selected) return;
    const pending = bookings.find(
      (b) => b.status === "completed" && !rated.has(b.id) && !autoPrompted.has(b.id),
    );
    if (pending) {
      setAutoPrompted((s) => new Set(s).add(pending.id));
      setSelected(pending);
      setRateOpen(true);
    }
  }, [bookings, rated, autoPrompted, rateOpen, selected]);

  const now = Date.now();
  const upcoming = (bookings ?? []).filter((b) => new Date(b.slot_start).getTime() > now && b.status === "upcoming");
  const past = (bookings ?? []).filter((b) => !(new Date(b.slot_start).getTime() > now && b.status === "upcoming"));

  const isPast = selected ? !(new Date(selected.slot_start).getTime() > now && selected.status === "upcoming") : false;
  const canRate = selected ? selected.status === "completed" && !rated.has(selected.id) : false;

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
          {upcoming.map((b) => <BookingCard key={b.id} b={b} onOpen={() => setSelected(b)} />)}
        </TabsContent>
        <TabsContent value="past" className="mt-4 space-y-3">
          {past.length === 0 && <p className="text-sm text-muted-foreground">No past bookings yet.</p>}
          {past.map((b) => <BookingCard key={b.id} b={b} onOpen={() => setSelected(b)} />)}
        </TabsContent>
      </Tabs>

      <BookingDetailsDialog
        booking={selected}
        isPast={isPast}
        canRate={canRate}
        onClose={() => setSelected(null)}
        onRate={() => setRateOpen(true)}
      />

      <RateDialog
        open={rateOpen}
        onOpenChange={setRateOpen}
        onSubmit={async (stars, comment) => {
          if (!selected) return;
          try {
            await rateFn({ data: { bookingId: selected.id, stars, comment, direction: "user_to_facility" } });
            toast.success("Thanks for rating!");
            setRateOpen(false);
            load();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed");
          }
        }}
      />
    </div>
  );
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
    upcoming: { label: "Confirmed", cls: "bg-primary/10 text-primary border-primary/20", Icon: CheckCircle2 },
    pending: { label: "Pending", cls: "bg-warning/10 text-warning border-warning/20", Icon: Clock },
    completed: { label: "Completed", cls: "bg-success/10 text-success border-success/20", Icon: CheckCircle2 },
    cancelled: { label: "Cancelled", cls: "bg-destructive/10 text-destructive border-destructive/20", Icon: AlertCircle },
  };
  const m = map[status] ?? { label: status, cls: "bg-muted text-foreground border-border", Icon: AlertCircle };
  const Icon = m.Icon;
  return (
    <Badge variant="outline" className={`gap-1 ${m.cls}`}>
      <Icon className="h-3 w-3" />
      {m.label}
    </Badge>
  );
}

function BookingCard({ b, onOpen }: { b: BookingRow; onOpen: () => void }) {
  return (
    <Card
      onClick={onOpen}
      className="flex cursor-pointer flex-wrap items-center gap-4 p-4 transition-all hover:shadow-md hover:-translate-y-0.5"
    >
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
        {b.facility?.image_url && <img src={b.facility.image_url} alt="" className="h-full w-full object-cover" />}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="truncate font-semibold">{b.facility?.name ?? "—"}</h3>
        <p className="text-sm text-muted-foreground">{new Date(b.slot_start).toLocaleString()}</p>
        <div className="mt-1">{statusBadge(b.status)}</div>
      </div>
      <div className="font-semibold">{Number(b.price).toFixed(2)}</div>
    </Card>
  );
}

function BookingDetailsDialog({
  booking,
  isPast,
  canRate,
  onClose,
  onRate,
}: {
  booking: BookingRow | null;
  isPast: boolean;
  canRate: boolean;
  onClose: () => void;
  onRate: () => void;
}) {
  const open = !!booking;
  const f = booking?.facility;
  const start = booking ? new Date(booking.slot_start) : null;
  const end = booking ? new Date(booking.slot_end) : null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg overflow-hidden p-0 backdrop-blur-xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
        {booking && (
          <>
            <div className="relative h-36 w-full bg-gradient-to-br from-primary to-primary/70">
              {f?.image_url && (
                <img src={f.image_url} alt="" className="h-full w-full object-cover opacity-60" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
              <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-2">
                <div className="min-w-0">
                  <DialogHeader>
                    <DialogTitle className="truncate text-2xl font-bold">{f?.name ?? "—"}</DialogTitle>
                  </DialogHeader>
                </div>
                {statusBadge(booking.status)}
              </div>
            </div>

            <div className="space-y-4 p-6">
              <DetailRow Icon={CalendarClock} label="Appointment">
                <div className="font-medium">
                  {start?.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                </div>
                <div className="text-sm text-muted-foreground">
                  {start?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} —{" "}
                  {end?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </DetailRow>

              <DetailRow Icon={MapPin} label="Location">
                {f?.location_url ? (
                  <a href={f.location_url} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="outline" className="mt-1 gap-1">
                      <MapPin className="h-3.5 w-3.5" /> View on Maps
                    </Button>
                  </a>
                ) : (
                  <span className="text-sm text-muted-foreground">Not provided</span>
                )}
              </DetailRow>

              <DetailRow Icon={Phone} label="Contact">
                {f?.phone ? (
                  <a href={`tel:${f.phone}`}>
                    <Button size="sm" variant="outline" className="mt-1 gap-1">
                      <Phone className="h-3.5 w-3.5" /> Call {f.phone}
                    </Button>
                  </a>
                ) : (
                  <span className="text-sm text-muted-foreground">Not provided</span>
                )}
              </DetailRow>

              <DetailRow Icon={Building2} label="Price">
                <span className="font-semibold">{Number(booking.price).toFixed(2)}</span>
              </DetailRow>

              <DetailRow Icon={Hash} label="Reference ID">
                <code className="rounded bg-muted px-2 py-0.5 text-xs">{booking.id.slice(0, 8).toUpperCase()}</code>
              </DetailRow>

              {isPast && <MedicalReportSection bookingId={booking.id} />}

              {isPast && canRate && (
                <Button onClick={onRate} className="w-full gap-1">
                  <Star className="h-4 w-4" /> Rate Experience
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({
  Icon,
  label,
  children,
}: {
  Icon: typeof CalendarClock;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-0.5">{children}</div>
      </div>
    </div>
  );
}

function RateDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSubmit: (stars: number, comment: string) => Promise<void>;
}) {
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Rate your visit</DialogTitle></DialogHeader>
        <div className="flex justify-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onClick={() => setStars(n)}>
              <Star className={`h-8 w-8 ${n <= stars ? "fill-warning text-warning" : "text-muted-foreground"}`} />
            </button>
          ))}
        </div>
        <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Optional comment" />
        <Button onClick={() => onSubmit(stars, comment)}>Submit</Button>
      </DialogContent>
    </Dialog>
  );
}

interface ReportData {
  file_path: string;
  doctor_note: string | null;
  created_at: string;
}

function MedicalReportSection({ bookingId }: { bookingId: string }) {
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("medical_reports")
        .select("file_path,doctor_note,created_at")
        .eq("booking_id", bookingId)
        .maybeSingle();
      if (!cancelled) {
        setReport(data ?? null);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [bookingId]);

  const openViewer = async () => {
    if (!report) return;
    const { data, error } = await supabase.storage
      .from("medical-reports")
      .createSignedUrl(report.file_path, 60 * 10);
    if (error || !data) {
      toast.error("Failed to open report");
      return;
    }
    setSignedUrl(data.signedUrl);
    setOpen(true);
  };

  if (loading) {
    return <div className="h-16 animate-pulse rounded-lg bg-muted" />;
  }

  if (!report) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">
        <Clock className="h-4 w-4" />
        Report Pending — your facility will upload it after the session.
      </div>
    );
  }

  const isPdf = report.file_path.toLowerCase().endsWith(".pdf");

  return (
    <>
      <button
        type="button"
        onClick={openViewer}
        className="group w-full overflow-hidden rounded-xl border bg-card text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
        style={{ borderColor: "rgba(90,151,137,0.25)" }}
      >
        <div className="flex items-center gap-3 p-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: "rgba(90,151,137,0.12)", color: "#5A9789" }}
          >
            <FileText className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 font-semibold" style={{ color: "#5A9789" }}>
              View Medical Report
              <Lock className="h-3 w-3 opacity-70" />
            </div>
            <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <ShieldCheck className="h-3 w-3" />
              Private & Encrypted · {new Date(report.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>
        {report.doctor_note && (
          <div className="border-t bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Doctor's note: </span>
            {report.doctor_note}
          </div>
        )}
      </button>

      <ReportLightbox
        open={open}
        onClose={() => setOpen(false)}
        url={signedUrl}
        isPdf={isPdf}
        filename={report.file_path.split("/").pop() ?? "report"}
      />
    </>
  );
}

function ReportLightbox({
  open,
  onClose,
  url,
  isPdf,
  filename,
}: {
  open: boolean;
  onClose: () => void;
  url: string | null;
  isPdf: boolean;
  filename: string;
}) {
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (!open) setZoom(1);
  }, [open]);

  if (!open || !url) return null;

  const download = async () => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch {
      toast.error("Download failed");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-background/95 backdrop-blur-md animate-in fade-in-0">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <ShieldCheck className="h-4 w-4" style={{ color: "#5A9789" }} />
          Medical Report
        </div>
        <div className="flex items-center gap-1">
          {!isPdf && (
            <>
              <Button size="icon" variant="ghost" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="w-12 text-center text-xs tabular-nums">{Math.round(zoom * 100)}%</span>
              <Button size="icon" variant="ghost" onClick={() => setZoom((z) => Math.min(4, z + 0.25))}>
                <ZoomIn className="h-4 w-4" />
              </Button>
            </>
          )}
          <Button size="sm" variant="outline" onClick={download} className="gap-1">
            <Download className="h-4 w-4" /> Download
          </Button>
          <Button size="icon" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto bg-muted/40 p-4">
        {isPdf ? (
          <iframe src={url} title="Medical report" className="h-full w-full rounded-md border bg-white" />
        ) : (
          <div className="flex min-h-full items-center justify-center">
            <img
              src={url}
              alt="Medical report"
              style={{ transform: `scale(${zoom})`, transformOrigin: "center", transition: "transform 0.2s" }}
              className="max-h-full max-w-full rounded-md shadow-xl"
            />
          </div>
        )}
      </div>
    </div>
  );
}
