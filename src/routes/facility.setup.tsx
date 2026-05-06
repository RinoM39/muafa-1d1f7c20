import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { requireAuth } from "@/lib/route-guards";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

const searchSchema = z.object({ id: z.string().uuid().optional() });

export const Route = createFileRoute("/facility/setup")({
  validateSearch: (s) => searchSchema.parse(s),
  beforeLoad: () => requireAuth("/facility/setup"),
  component: FacilitySetup,
});

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function FacilitySetup() {
  const navigate = useNavigate();
  const { id } = useSearch({ from: "/facility/setup" });

  const [form, setForm] = useState({
    name: "",
    description: "",
    image_url: "",
    location_url: "",
    phone: "",
    price: "100",
    session_duration_min: "30",
    start_time: "09:00",
    end_time: "17:00",
    working_days: [0, 1, 2, 3, 4] as number[],
    is_active: true,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase.from("facilities").select("*").eq("id", id).maybeSingle().then(({ data }) => {
      if (!data) return;
      setForm({
        name: data.name,
        description: data.description ?? "",
        image_url: data.image_url ?? "",
        location_url: data.location_url ?? "",
        phone: data.phone ?? "",
        price: String(data.price),
        session_duration_min: String(data.session_duration_min),
        start_time: data.start_time.slice(0, 5),
        end_time: data.end_time.slice(0, 5),
        working_days: data.working_days,
        is_active: data.is_active,
      });
    });
  }, [id]);

  const toggleDay = (d: number) => {
    setForm((f) => ({
      ...f,
      working_days: f.working_days.includes(d)
        ? f.working_days.filter((x) => x !== d)
        : [...f.working_days, d].sort(),
    }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;

    const payload = {
      owner_id: u.user.id,
      name: form.name,
      description: form.description || null,
      image_url: form.image_url || null,
      location_url: form.location_url || null,
      phone: form.phone || null,
      price: Number(form.price),
      session_duration_min: Number(form.session_duration_min),
      start_time: form.start_time + ":00",
      end_time: form.end_time + ":00",
      working_days: form.working_days,
      is_active: form.is_active,
    };

    const { error } = id
      ? await supabase.from("facilities").update(payload).eq("id", id)
      : await supabase.from("facilities").insert(payload);
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(id ? "Facility updated" : "Facility created");
    navigate({ to: "/facility/dashboard" });
  };

  return (
    <div className="container mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-bold">{id ? "Edit Facility" : "Create Facility"}</h1>
      <Card className="mt-6 p-6">
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Facility name" required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Field>
          <Field label="Description">
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <Field label="Image URL">
            <Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} />
          </Field>
          <Field label="Google Maps link">
            <Input value={form.location_url} onChange={(e) => setForm({ ...form, location_url: e.target.value })} />
          </Field>
          <Field label="Phone">
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Price (EGP)" required>
              <Input type="number" min="0" step="1" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
            </Field>
            <Field label="Session duration (min)" required>
              <Input type="number" min="5" max="480" value={form.session_duration_min} onChange={(e) => setForm({ ...form, session_duration_min: e.target.value })} required />
            </Field>
            <Field label="Start time" required>
              <Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} required />
            </Field>
            <Field label="End time" required>
              <Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} required />
            </Field>
          </div>
          <Field label="Working days">
            <div className="flex flex-wrap gap-2">
              {dayLabels.map((label, idx) => (
                <button
                  type="button"
                  key={idx}
                  onClick={() => toggleDay(idx)}
                  className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                    form.working_days.includes(idx)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "hover:border-primary/50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>
          <label className="flex items-center gap-2">
            <Checkbox checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: !!v })} />
            <span className="text-sm">Active (visible to users)</span>
          </label>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Saving..." : "Save facility"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div className="space-y-2">
      <Label>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}
