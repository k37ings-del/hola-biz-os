import { createFileRoute, Outlet, redirect, useNavigate, Link, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser, useSignOut } from "@/lib/auth";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Inbox, Users, Calendar, Briefcase, UserCog, Wallet, Settings, Shield, LogOut, Loader2, Zap, CalendarClock } from "lucide-react";
import holawebLogo from "@/assets/holaweb-logo.png.asset.json";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/calendar", label: "Calendar", icon: Calendar },
  { to: "/inbox", label: "Inbox", icon: Inbox },
  { to: "/bookings", label: "Bookings", icon: Calendar },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/services", label: "Services", icon: Briefcase },
  { to: "/staff", label: "Staff", icon: UserCog },
  { to: "/schedule", label: "Schedule", icon: CalendarClock },
  { to: "/finance", label: "Finance", icon: Wallet },
  { to: "/automations", label: "Automations", icon: Zap },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function AuthenticatedLayout() {
  const { data, isLoading } = useCurrentUser();
  const navigate = useNavigate();
  const signOut = useSignOut();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    // Authenticated but no profile yet — send to onboarding
    navigate({ to: "/auth" });
    return null;
  }

  const { user, tenant } = data;
  const canSeeAdmin = user.admin_access && (user.role === "owner" || user.role === "admin");

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <Sidebar collapsible="icon">
          <SidebarHeader className="border-b border-sidebar-border">
            <div className="flex items-center gap-2 px-2 py-3">
              <div className="h-40 w-40 rounded-md bg-white flex items-center justify-center shrink-0 p-2 group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:p-1">
                <img src={holawebLogo.url} alt="Holaweb" className="h-full w-auto" />
              </div>
              <div className="min-w-0 group-data-[collapsible=icon]:hidden">
                <p className="text-sm font-semibold truncate text-sidebar-foreground">{tenant.name}</p>
                <Badge variant="secondary" className="text-[10px] uppercase mt-0.5 bg-sidebar-accent text-sidebar-accent-foreground border-0">{tenant.plan_tier}</Badge>
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Workspace</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {NAV.map((item) => (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton asChild isActive={pathname.startsWith(item.to)}>
                        <Link to={item.to}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                  {canSeeAdmin && (
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={pathname.startsWith("/admin")}>
                        <Link to="/admin">
                          <Shield className="h-4 w-4" />
                          <span>Companies</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}


                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="border-t">
            <div className="px-2 py-2 flex items-center gap-2 group-data-[collapsible=icon]:hidden">
              <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center text-xs font-medium text-accent-foreground shrink-0">
                {(user.full_name ?? user.email ?? "?").slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">{user.full_name ?? user.email}</p>
                <p className="text-[10px] text-muted-foreground capitalize">{user.role}</p>
              </div>
              <Button size="icon" variant="ghost" onClick={signOut} title="Sign out">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b flex items-center px-3 sticky top-0 bg-background/80 backdrop-blur z-10">
            <SidebarTrigger />
            <div className="flex-1" />
          </header>
          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
