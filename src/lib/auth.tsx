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
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  return { session, loading };
}

export function useCurrentUser() {
  const { session, loading: sessionLoading } = useSession();
  return useQuery({
    queryKey: ["current-user", session?.user.id],
    enabled: !sessionLoading && !!session,
    queryFn: async (): Promise<{ user: AppUser; tenant: Tenant } | null> => {
      if (!session) return null;
      const { data: userRow, error: uErr } = await supabase
        .from("users")
        .select("*")
        .eq("supabase_auth_id", session.user.id)
        .maybeSingle();
      if (uErr) throw uErr;
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
