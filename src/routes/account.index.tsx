import { createFileRoute, Link } from "@tanstack/react-router";
import { requireAuth } from "@/lib/route-guards";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Wallet, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/account/")({
  beforeLoad: () => requireAuth("/account"),
  component: AccountPage,
});

function AccountPage() {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<{ full_name: string | null; phone: string | null } | null>(null);
  const [wallet, setWallet] = useState<{ balance: number; pending: number } | null>(null);
  const [topupAmount, setTopupAmount] = useState("");
  const [open, setOpen] = useState(false);

  const load = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const [{ data: p }, { data: w }] = await Promise.all([
      supabase.from("profiles").select("full_name,phone").eq("id", u.user.id).maybeSingle(),
      supabase.from("wallets").select("balance,pending").eq("user_id", u.user.id).maybeSingle(),
    ]);
    setProfile(p ?? { full_name: null, phone: null });
    setWallet(w ? { balance: Number(w.balance), pending: Number(w.pending) } : { balance: 0, pending: 0 });
  };

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      await load();
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      channel = supabase
        .channel(`wallet:${u.user.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "wallets", filter: `user_id=eq.${u.user.id}` },
          (payload) => {
            const row = payload.new as { balance?: number; pending?: number } | null;
            if (row) setWallet({ balance: Number(row.balance ?? 0), pending: Number(row.pending ?? 0) });
          },
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "wallet_requests", filter: `user_id=eq.${u.user.id}` },
          () => { load(); },
        )
        .subscribe();
    })();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, []);

  const submitTopup = async () => {
    const amount = Number(topupAmount);
    if (!amount || amount <= 0) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("wallet_requests").insert({ user_id: u.user.id, amount });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Top-up request submitted — admin will review");
    setOpen(false);
    setTopupAmount("");
  };

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">{t("nav.account")}</h1>

      <Card className="mt-6 overflow-hidden p-0">
        <div className="bg-[image:var(--gradient-primary)] p-6 text-primary-foreground">
          <div className="flex items-center gap-2 text-sm opacity-90">
            <Wallet className="h-4 w-4" /> Wallet
          </div>
          <div className="mt-2 text-4xl font-bold">
            {wallet?.balance.toFixed(2) ?? "—"} <span className="text-lg font-normal">{t("common.currency")}</span>
          </div>
          {wallet && wallet.pending > 0 && (
            <div className="mt-1 text-sm opacity-90">
              Pending: {wallet.pending.toFixed(2)} {t("common.currency")}
            </div>
          )}
        </div>
        <div className="flex justify-end p-4">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="me-2 h-4 w-4" /> Request top-up
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Request wallet top-up</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Amount ({t("common.currency")})</Label>
                  <Input
                    type="number"
                    min="1"
                    value={topupAmount}
                    onChange={(e) => setTopupAmount(e.target.value)}
                  />
                </div>
                <Button onClick={submitTopup} className="w-full">Submit request</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </Card>

      <Card className="mt-6 p-6">
        <h2 className="text-lg font-semibold">Profile</h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t("auth.fullName")}</dt>
            <dd>{profile?.full_name ?? "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t("auth.phone")}</dt>
            <dd>{profile?.phone ?? "—"}</dd>
          </div>
        </dl>
        <Button asChild variant="outline" className="mt-6">
          <Link to="/account/bookings">View my bookings</Link>
        </Button>
      </Card>
    </div>
  );
}
