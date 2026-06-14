import { createFileRoute, Link } from "@tanstack/react-router";
import { requireAuth } from "@/lib/route-guards";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/facility/dashboard")({
  ssr: false,
  beforeLoad: () => requireAuth("/facility/dashboard"),
  component: FacilityDashboard,
});

function FacilityDashboard() {
  const [facilities, setFacilities] = useState<Array<{ id: string; name: string; is_active: boolean }> | null>(null);
  const [stats, setStats] = useState({ today: 0, upcoming: 0 });

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: facs } = await supabase
        .from("facilities")
        .select("id,name,is_active")
        .eq("owner_id", u.user.id);
      setFacilities(facs ?? []);

      if (facs && facs.length > 0) {
        const ids = facs.map((f) => f.id);
        const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(); endOfDay.setHours(23, 59, 59, 999);
        const [{ count: today }, { count: upcoming }] = await Promise.all([
          supabase.from("bookings").select("*", { count: "exact", head: true })
            .in("facility_id", ids)
            .gte("slot_start", startOfDay.toISOString())
            .lte("slot_start", endOfDay.toISOString()),
          supabase.from("bookings").select("*", { count: "exact", head: true })
            .in("facility_id", ids)
            .gte("slot_start", new Date().toISOString())
            .eq("status", "upcoming"),
        ]);
        setStats({ today: today ?? 0, upcoming: upcoming ?? 0 });
      }
    })();
  }, []);

  return (
    <div className="container mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Facility Dashboard</h1>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/facility/bookings">View bookings</Link>
          </Button>
          <Button asChild>
            <Link to="/facility/setup">
              <Plus className="me-2 h-4 w-4" /> Create facility
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card className="p-6">
          <div className="text-sm text-muted-foreground">Today's bookings</div>
          <div className="mt-2 text-4xl font-bold text-primary">{stats.today}</div>
        </Card>
        <Card className="p-6">
          <div className="text-sm text-muted-foreground">All upcoming</div>
          <div className="mt-2 text-4xl font-bold text-primary">{stats.upcoming}</div>
        </Card>
      </div>

      <h2 className="mt-10 text-xl font-semibold">My facilities</h2>
      <div className="mt-4 grid gap-3">
        {facilities?.length === 0 && (
          <Card className="p-6 text-center text-muted-foreground">
            You haven't created a facility yet.
          </Card>
        )}
        {facilities?.map((f) => (
          <Card key={f.id} className="flex items-center justify-between p-4">
            <div>
              <h3 className="font-semibold">{f.name}</h3>
              <p className="text-xs text-muted-foreground">{f.is_active ? "Active" : "Hidden"}</p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/facility/setup" search={{ id: f.id }}>Edit</Link>
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
