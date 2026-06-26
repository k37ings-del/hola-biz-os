import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppUser = {
  id: string;
  tenant_id: string;
  supabase_auth_id: string;
  full_name: string | null;
  email: string | null;
  role: "owner" | "admin" | "manager" | "agent";
  admin_access: boolean;
};

export type Tenant = {
  id: string;
  name: string;
  industry: string | null;
  country: string;
  country_code: string;
  email: string | null;
  whatsapp_number: string | null;
  wa_phone_number: string | null;
  wa_number_id: string | null;
  plan_tier: string;
  subscription_status: string;
  business_hours: Record<string, { active: boolean; open: string; close: string }>;
  is_demo: boolean;
  default_currency: string;
  brand_color: string | null;
  logo_url: string | null;
  favicon_url: string | null;
};

export function useSession(): { session: Session | null; loading: boolean } {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session);
        setLoading(false);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      // Only react to identity transitions — ignore TOKEN_REFRESHED / INITIAL_SESSION noise
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      setSession((prev) => (prev?.user.id === s?.user.id ? prev : s));
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  return { session, loading };
}

const WHITELIST = ["holaweb.africa@gmail.com", "k37.ings@gmail.com"];

export function useCurrentUser() {
  const { session, loading: sessionLoading } = useSession();
  return useQuery({
    queryKey: ["current-user", session?.user.id],
    enabled: !sessionLoading && !!session,
    queryFn: async (): Promise<{ user: AppUser; tenant: Tenant } | null> => {
      if (!session) return null;
      let { data: userRow, error: uErr } = await supabase
        .from("users")
        .select("*")
        .eq("supabase_auth_id", session.user.id)
        .maybeSingle();
      if (uErr) throw uErr;

      // Whitelist auto-attach: privileged emails get linked to Holaweb HQ tenant
      if (!userRow) {
        const email = session.user.email?.toLowerCase();
        if (email && WHITELIST.includes(email)) {
          const HQ_ID = "22222222-2222-2222-2222-222222222222";
          const { data: inserted, error: insErr } = await supabase
            .from("users")
            .insert({
              tenant_id: HQ_ID,
              supabase_auth_id: session.user.id,
              email,
              full_name: session.user.user_metadata?.full_name ?? email,
              role: "owner",
            })
            .select()
            .single();
          if (insErr) throw insErr;
          userRow = inserted;
        }
      }

      if (!userRow) return null;
      const { data: tenant, error: tErr } = await supabase
        .from("tenants")
        .select("*")
        .eq("id", userRow.tenant_id)
        .single();
      if (tErr) throw tErr;
      return { user: userRow as unknown as AppUser, tenant: tenant as unknown as Tenant };
    },
  });
}

export function useSignOut() {
  const qc = useQueryClient();
  return async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    window.location.href = "/auth";
  };
}
