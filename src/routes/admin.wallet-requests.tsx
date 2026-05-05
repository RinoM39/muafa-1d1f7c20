import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { decideWalletRequest, setBanned } from "@/server/admin.functions";

export const Route = createFileRoute("/admin/wallet-requests")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login", search: { redirect: "/admin/wallet-requests" } });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    if (!roles?.some((r) => r.role === "admin")) throw redirect({ to: "/" });
  },
  component: WalletRequestsAdmin,
});

interface Req {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  user_id: string;
  user: { full_name: string | null; phone: string | null } | null;
}

function WalletRequestsAdmin() {
  const [rows, setRows] = useState<Req[] | null>(null);
  const decide = useServerFn(decideWalletRequest);
  const ban = useServerFn(setBanned);

  const load = async () => {
    const { data } = await supabase
      .from("wallet_requests")
      .select("id,amount,status,created_at,user_id,user:profiles!wallet_requests_user_id_fkey(full_name,phone)")
      .order("created_at", { ascending: false });
    setRows((data as unknown as Req[]) ?? []);
  };
  useEffect(() => { load(); }, []);

  const pending = (rows ?? []).filter((r) => r.status === "pending");
  const decided = (rows ?? []).filter((r) => r.status !== "pending");

  const act = async (id: string, approve: boolean) => {
    try {
      await decide({ data: { requestId: id, approve, note: null } });
      toast.success(approve ? "Approved & credited" : "Rejected");
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Wallet Top-up Requests</h1>
        <Button asChild variant="outline" size="sm"><Link to="/admin">Back</Link></Button>
      </div>
      <Tabs defaultValue="pending" className="mt-6">
        <TabsList>
          <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="history">History ({decided.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="mt-4 space-y-3">
          {pending.length === 0 && <p className="text-sm text-muted-foreground">All caught up.</p>}
          {pending.map((r) => (
            <Card key={r.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div>
                <h3 className="font-semibold">{r.user?.full_name ?? r.user_id.slice(0, 8)}</h3>
                <p className="text-sm text-muted-foreground">{r.user?.phone ?? "—"}</p>
                <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</p>
              </div>
              <div className="text-2xl font-bold text-primary">{Number(r.amount).toFixed(2)}</div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => act(r.id, true)}>Approve</Button>
                <Button size="sm" variant="outline" onClick={() => act(r.id, false)}>Reject</Button>
                <Button size="sm" variant="ghost" onClick={async () => {
                  try { await ban({ data: { targetType: "user", targetId: r.user_id, banned: true } }); toast.success("User banned"); }
                  catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
                }}>Ban user</Button>
              </div>
            </Card>
          ))}
        </TabsContent>
        <TabsContent value="history" className="mt-4 space-y-3">
          {decided.map((r) => (
            <Card key={r.id} className="flex items-center justify-between p-4">
              <div>
                <h3 className="font-medium">{r.user?.full_name ?? r.user_id.slice(0, 8)}</h3>
                <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</p>
              </div>
              <div className="font-semibold">{Number(r.amount).toFixed(2)}</div>
              <span className={`rounded-full px-3 py-1 text-xs ${r.status === "approved" ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
                {r.status}
              </span>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
