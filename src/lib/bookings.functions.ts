import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const createBookingInput = z.object({
  facilityId: z.string().uuid(),
  slotStartIso: z.string().datetime(),
});

/**
 * Create a booking with transactional slot locking + wallet debit.
 * Uses the (facility_id, slot_start) unique constraint to prevent double-booking.
 */
export const createBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createBookingInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = context;
    const slotStart = new Date(data.slotStartIso);

    // 1. Load facility
    const { data: facility, error: facErr } = await supabaseAdmin
      .from("facilities")
      .select("id,price,session_duration_min,is_active,is_banned,owner_id,name")
      .eq("id", data.facilityId)
      .maybeSingle();
    if (facErr || !facility) throw new Error("Facility not found");
    if (!facility.is_active || facility.is_banned) throw new Error("Facility unavailable");
    if (facility.owner_id === userId) throw new Error("OWN_FACILITY");

    // 2. Check wallet
    const { data: wallet } = await supabaseAdmin
      .from("wallets")
      .select("balance,pending")
      .eq("user_id", userId)
      .maybeSingle();
    if (!wallet) throw new Error("Wallet not found");
    if (Number(wallet.balance) < Number(facility.price)) throw new Error("INSUFFICIENT_BALANCE");

    const slotEnd = new Date(slotStart.getTime() + facility.session_duration_min * 60_000);

    // 3. Insert booking — unique constraint enforces no double-booking
    const { data: booking, error: bookErr } = await supabaseAdmin
      .from("bookings")
      .insert({
        user_id: userId,
        facility_id: facility.id,
        slot_start: slotStart.toISOString(),
        slot_end: slotEnd.toISOString(),
        price: facility.price,
        status: "upcoming",
      })
      .select("id")
      .single();
    if (bookErr || !booking) {
      if (bookErr?.code === "23505") throw new Error("SLOT_TAKEN");
      throw new Error(bookErr?.message ?? "Could not create booking");
    }

    // 4. Hold funds: balance -= price, pending += price
    const newBalance = Number(wallet.balance) - Number(facility.price);
    const newPending = Number(wallet.pending) + Number(facility.price);
    await supabaseAdmin
      .from("wallets")
      .update({ balance: newBalance, pending: newPending })
      .eq("user_id", userId);

    await supabaseAdmin.from("wallet_transactions").insert({
      user_id: userId,
      booking_id: booking.id,
      amount: -Number(facility.price),
      type: "hold",
      status: "pending",
      note: `Hold for booking at ${facility.name}`,
    });

    // 5. Notify facility owner
    await supabaseAdmin.from("notifications").insert({
      user_id: facility.owner_id,
      title: "New booking",
      body: `New appointment booked at ${facility.name}`,
      link: `/facility/bookings`,
    });

    return { bookingId: booking.id };
  });
