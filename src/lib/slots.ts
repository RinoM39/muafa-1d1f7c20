/**
 * Mu'afa slot generation utilities.
 * Generates virtual time slots for the next 7 days based on a facility's
 * weekly schedule. Persisted bookings are filtered out client-side.
 */

export interface ScheduleConfig {
  start_time: string; // "09:00:00"
  end_time: string; // "14:00:00"
  session_duration_min: number;
  working_days: number[]; // 0 = Sunday … 6 = Saturday
}

export interface DaySlots {
  date: Date; // local date at midnight
  weekday: number;
  slots: { start: Date; end: Date; iso: string }[];
}

function parseTime(t: string): { h: number; m: number } {
  const [h, m] = t.split(":").map(Number);
  return { h: h ?? 0, m: m ?? 0 };
}

export function generateUpcomingDays(cfg: ScheduleConfig, daysAhead = 7): DaySlots[] {
  const result: DaySlots[] = [];
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  for (let i = 0; i < daysAhead; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const weekday = d.getDay();
    if (!cfg.working_days.includes(weekday)) continue;

    const { h: sh, m: sm } = parseTime(cfg.start_time);
    const { h: eh, m: em } = parseTime(cfg.end_time);
    const start = new Date(d); start.setHours(sh, sm, 0, 0);
    const end = new Date(d); end.setHours(eh, em, 0, 0);

    const slots: DaySlots["slots"] = [];
    let cursor = new Date(start);
    while (cursor.getTime() + cfg.session_duration_min * 60_000 <= end.getTime()) {
      const slotStart = new Date(cursor);
      const slotEnd = new Date(cursor.getTime() + cfg.session_duration_min * 60_000);
      // Skip past slots for today
      if (slotStart.getTime() > now.getTime()) {
        slots.push({ start: slotStart, end: slotEnd, iso: slotStart.toISOString() });
      }
      cursor = slotEnd;
    }

    if (slots.length > 0) result.push({ date: d, weekday, slots });
  }

  return result;
}

export function formatSlotTime(d: Date, locale: string): string {
  return d.toLocaleTimeString(locale === "ar" ? "ar-EG" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatDay(d: Date, locale: string): string {
  return d.toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
}
