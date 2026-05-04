import { Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Activity, Globe, LogOut, Menu, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth-context";

export function Header() {
  const { t, i18n } = useTranslation();
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();

  const toggleLang = () => {
    const next = i18n.language === "ar" ? "en" : "ar";
    i18n.changeLanguage(next);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-elegant)]">
            <Activity className="h-5 w-5" />
          </div>
          <span className="text-xl font-bold tracking-tight">{t("brand.name")}</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <Button asChild variant="ghost" size="sm">
            <Link to="/">{t("nav.home")}</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/facilities">{t("nav.facilities")}</Link>
          </Button>
          {role === "user" && (
            <Button asChild variant="ghost" size="sm">
              <Link to="/account">{t("nav.account")}</Link>
            </Button>
          )}
          {role === "facility" && (
            <Button asChild variant="ghost" size="sm">
              <Link to="/facility/dashboard">{t("nav.facilityDashboard")}</Link>
            </Button>
          )}
          {role === "admin" && (
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin">{t("nav.admin")}</Link>
            </Button>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={toggleLang} aria-label={t("common.language")}>
            <Globe className="h-4 w-4" />
            <span className="ms-1 text-xs font-medium">{i18n.language === "ar" ? "EN" : "ع"}</span>
          </Button>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <UserIcon className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link to="/account">{t("nav.account")}</Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="me-2 h-4 w-4" />
                  {t("nav.logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link to="/login">{t("nav.login")}</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/register">{t("nav.register")}</Link>
              </Button>
            </>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild><Link to="/">{t("nav.home")}</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link to="/facilities">{t("nav.facilities")}</Link></DropdownMenuItem>
              {role === "user" && <DropdownMenuItem asChild><Link to="/account">{t("nav.account")}</Link></DropdownMenuItem>}
              {role === "facility" && <DropdownMenuItem asChild><Link to="/facility/dashboard">{t("nav.facilityDashboard")}</Link></DropdownMenuItem>}
              {role === "admin" && <DropdownMenuItem asChild><Link to="/admin">{t("nav.admin")}</Link></DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
