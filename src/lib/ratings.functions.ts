import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ratingInput = z.object({
  bookingId: z.string().uuid(),
  stars: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional().nullable(),
  direction: z.enum(["user_to_facility", "facility_to_user"]),
});

export const submitRating = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ratingInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = context;

    const { data: booking } = await supabaseAdmin
      .from("bookings")
      .select("id,user_id,facility_id,status,facility:facilities!bookings_facility_id_fkey(owner_id)")
      .eq("id", data.bookingId)
      .maybeSingle();
    if (!booking) throw new Error("Booking not found");
    if (booking.status !== "completed") throw new Error("Booking not completed");

    const owner = (booking as unknown as { facility: { owner_id: string } | null }).facility?.owner_id;
    let rateeId: string;
    if (data.direction === "user_to_facility") {
      if (booking.user_id !== userId) throw new Error("Forbidden");
      if (!owner) throw new Error("No facility owner");
      rateeId = owner;
    } else {
      if (owner !== userId) throw new Error("Forbidden");
      rateeId = booking.user_id;
    }

    const { error } = await supabaseAdmin.from("ratings").insert({
      booking_id: booking.id,
      rater_id: userId,
      ratee_id: rateeId,
      stars: data.stars,
      comment: data.comment ?? null,
      direction: data.direction,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
