import { createFileRoute, Link } from "@tanstack/react-router";
import { requireAdmin } from "@/lib/route-guards";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/")({
  beforeLoad: () => requireAdmin("/admin"),
  component: AdminDashboard,
});

function AdminDashboard() {
  const [stats, setStats] = useState({ users: 0, facilities: 0, bookings: 0, revenue: 0 });

  useEffect(() => {
    (async () => {
      const [{ count: users }, { count: facilities }, { count: bookings }, { data: txs }] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("facilities").select("*", { count: "exact", head: true }),
        supabase.from("bookings").select("*", { count: "exact", head: true }),
        supabase.from("wallet_transactions").select("amount").eq("type", "topup"),
      ]);
      const revenue = (txs ?? []).reduce((s, t) => s + Number(t.amount), 0);
      setStats({ users: users ?? 0, facilities: facilities ?? 0, bookings: bookings ?? 0, revenue });
    })();
  }, []);

  const cards = [
    { label: "Users", value: stats.users },
    { label: "Facilities", value: stats.facilities },
    { label: "Bookings", value: stats.bookings },
    { label: "Wallet top-ups (EGP)", value: stats.revenue.toFixed(0) },
  ];

  return (
    <div className="container mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <Button asChild>
          <Link to="/admin/wallet-requests">Wallet top-up queue</Link>
        </Button>
      </div>
      <p className="mt-2 text-muted-foreground">
        Approve top-ups, manage users and facilities, and watch growth.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className="p-6">
            <div className="text-sm text-muted-foreground">{c.label}</div>
            <div className="mt-2 text-3xl font-bold text-primary">{c.value}</div>
          </Card>
        ))}
      </div>

      <Card className="mt-8 p-6">
        <h2 className="font-semibold">Coming next</h2>
        <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground">
          <li>Wallet top-up requests queue (approve / reject)</li>
          <li>Ban / unban users and facilities</li>
          <li>Delete bookings</li>
          <li>Charts: monthly revenue, user growth, top facilities</li>
          <li>Web push reminders + cron</li>
          <li>PWA install + service worker</li>
        </ul>
      </Card>
    </div>
  );
}
