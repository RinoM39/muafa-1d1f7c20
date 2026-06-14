import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const endInput = z.object({
  bookingId: z.string().uuid(),
  reportUrl: z.string().url().optional().nullable(),
});

/**
 * End a booking session. Only the facility owner can call this.
 * Releases held funds from the user's wallet pending and credits the facility owner's wallet.
 */
export const endSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => endInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = context;

    const { data: booking } = await supabaseAdmin
      .from("bookings")
      .select("id,user_id,facility_id,price,status,facility:facilities!bookings_facility_id_fkey(owner_id,name)")
      .eq("id", data.bookingId)
      .maybeSingle();
    if (!booking) throw new Error("Booking not found");
    const owner = (booking as unknown as { facility: { owner_id: string; name: string } | null }).facility?.owner_id;
    if (owner !== userId) throw new Error("Forbidden");
    if (booking.status !== "upcoming") throw new Error("Already finalized");

    // 1. Mark completed
    await supabaseAdmin
      .from("bookings")
      .update({
        status: "completed",
        ended_at: new Date().toISOString(),
        report_url: data.reportUrl ?? null,
      })
      .eq("id", booking.id);

    // 2. Release user's pending hold
    const { data: userWallet } = await supabaseAdmin
      .from("wallets").select("balance,pending").eq("user_id", booking.user_id).maybeSingle();
    if (userWallet) {
      await supabaseAdmin.from("wallets").update({
        pending: Math.max(0, Number(userWallet.pending) - Number(booking.price)),
      }).eq("user_id", booking.user_id);
    }
    await supabaseAdmin.from("wallet_transactions").insert({
      user_id: booking.user_id,
      booking_id: booking.id,
      amount: -Number(booking.price),
      type: "release",
      status: "completed",
      note: "Session completed",
    });

    // 3. Credit facility owner's wallet
    const { data: ownerWallet } = await supabaseAdmin
      .from("wallets").select("balance").eq("user_id", userId).maybeSingle();
    if (ownerWallet) {
      await supabaseAdmin.from("wallets").update({
        balance: Number(ownerWallet.balance) + Number(booking.price),
      }).eq("user_id", userId);
    } else {
      await supabaseAdmin.from("wallets").insert({ user_id: userId, balance: booking.price });
    }
    await supabaseAdmin.from("wallet_transactions").insert({
      user_id: userId,
      booking_id: booking.id,
      amount: Number(booking.price),
      type: "payout",
      status: "completed",
      note: "Earnings from session",
    });

    // 4. Notify the patient
    await supabaseAdmin.from("notifications").insert({
      user_id: booking.user_id,
      title: "Session completed",
      body: data.reportUrl ? "Your medical report is ready." : "Please rate your visit.",
      link: "/account/bookings",
    });

    return { ok: true };
  });
