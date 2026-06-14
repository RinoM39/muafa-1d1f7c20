import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(userId: string, supabaseAdmin: Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"]) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
}

const decideInput = z.object({
  requestId: z.string().uuid(),
  approve: z.boolean(),
  note: z.string().max(500).optional().nullable(),
});

export const decideWalletRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => decideInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = context;
    await assertAdmin(userId, supabaseAdmin);

    const { data: req } = await supabaseAdmin
      .from("wallet_requests").select("id,user_id,amount,status").eq("id", data.requestId).maybeSingle();
    if (!req) throw new Error("Request not found");
    if (req.status !== "pending") throw new Error("Already decided");

    const newStatus = data.approve ? "approved" : "rejected";
    await supabaseAdmin.from("wallet_requests").update({
      status: newStatus,
      decided_by: userId,
      decided_at: new Date().toISOString(),
      note: data.note ?? null,
    }).eq("id", req.id);

    if (data.approve) {
      const { data: w } = await supabaseAdmin.from("wallets").select("balance").eq("user_id", req.user_id).maybeSingle();
      const newBalance = Number(w?.balance ?? 0) + Number(req.amount);
      if (w) {
        await supabaseAdmin.from("wallets").update({ balance: newBalance }).eq("user_id", req.user_id);
      } else {
        await supabaseAdmin.from("wallets").insert({ user_id: req.user_id, balance: req.amount });
      }
      await supabaseAdmin.from("wallet_transactions").insert({
        user_id: req.user_id,
        amount: Number(req.amount),
        type: "topup",
        status: "completed",
        note: "Admin-approved top-up",
      });
    }

    await supabaseAdmin.from("notifications").insert({
      user_id: req.user_id,
      title: data.approve ? "Top-up approved" : "Top-up rejected",
      body: data.approve
        ? `Your wallet was credited with ${req.amount}.`
        : `Your top-up request was declined.${data.note ? " Note: " + data.note : ""}`,
      link: "/account",
    });

    return { ok: true };
  });

const banInput = z.object({
  targetType: z.enum(["user", "facility"]),
  targetId: z.string().uuid(),
  banned: z.boolean(),
});

export const setBanned = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => banInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertAdmin(context.userId, supabaseAdmin);
    if (data.targetType === "user") {
      await supabaseAdmin.from("profiles").update({ is_banned: data.banned }).eq("id", data.targetId);
    } else {
      await supabaseAdmin.from("facilities").update({ is_banned: data.banned }).eq("id", data.targetId);
    }
    return { ok: true };
  });
