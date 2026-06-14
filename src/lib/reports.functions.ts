import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const reportUrlInput = z.object({
  bookingId: z.string().uuid(),
});

export const getMedicalReportSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => reportUrlInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: booking } = await supabaseAdmin
      .from("bookings")
      .select("id,user_id,facility:facilities!bookings_facility_id_fkey(owner_id)")
      .eq("id", data.bookingId)
      .maybeSingle();
    if (!booking) throw new Error("Report not found");

    const ownerId = (booking as unknown as { facility: { owner_id: string } | null }).facility?.owner_id;
    const { data: adminRole } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (booking.user_id !== context.userId && ownerId !== context.userId && !adminRole) {
      throw new Error("Forbidden");
    }

    const { data: report } = await supabaseAdmin
      .from("medical_reports")
      .select("file_path")
      .eq("booking_id", booking.id)
      .maybeSingle();
    if (!report) throw new Error("Report not found");

    const { data: signed, error } = await supabaseAdmin.storage
      .from("medical-reports")
      .createSignedUrl(report.file_path, 60 * 10);
    if (error || !signed) throw new Error("Unable to open report");

    return { signedUrl: signed.signedUrl };
  });