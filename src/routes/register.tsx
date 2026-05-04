import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export const Route = createFileRoute("/register")({
  component: RegisterPage,
});

function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"user" | "facility">("user");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: fullName, phone, role },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("auth.registerSuccess"));
    navigate({ to: role === "facility" ? "/facility/dashboard" : "/" });
  };

  return (
    <div className="container mx-auto flex min-h-[calc(100vh-12rem)] max-w-md items-center px-4 py-12">
      <Card className="w-full p-6 md:p-8">
        <h1 className="text-2xl font-bold">{t("auth.registerTitle")}</h1>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label>{t("auth.accountType")}</Label>
            <RadioGroup value={role} onValueChange={(v) => setRole(v as "user" | "facility")} className="grid gap-2">
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 hover:bg-accent">
                <RadioGroupItem value="user" />
                <span className="text-sm">{t("auth.roleUser")}</span>
              </label>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 hover:bg-accent">
                <RadioGroupItem value="facility" />
                <span className="text-sm">{t("auth.roleFacility")}</span>
              </label>
            </RadioGroup>
          </div>
          <div className="space-y-2">
            <Label htmlFor="full_name">{t("auth.fullName")}</Label>
            <Input id="full_name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">{t("auth.phone")}</Label>
            <Input id="phone" required value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t("common.loading") : t("auth.signUp")}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          {t("auth.haveAccount")}{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            {t("auth.signIn")}
          </Link>
        </p>
      </Card>
    </div>
  );
}
