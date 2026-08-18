import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/pje";

export interface AuthState {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  nome: string | null;
  loading: boolean;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    user: null, session: null, role: null, nome: null, loading: true,
  });

  useEffect(() => {
    let mounted = true;

    const loadExtras = async (userId: string) => {
      const [{ data: roles }, { data: profile }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", userId).limit(1),
        supabase.from("profiles").select("nome_completo").eq("id", userId).maybeSingle(),
      ]);
      return {
        role: (roles?.[0]?.role as AppRole) ?? null,
        nome: profile?.nome_completo ?? null,
      };
    };

    const applySession = async (session: Session | null) => {
      if (!mounted) return;
      if (!session?.user) {
        setState({ user: null, session: null, role: null, nome: null, loading: false });
        return;
      }
      // mantém loading=true enquanto carrega role
      setState((s) => ({ ...s, user: session.user, session, loading: true }));
      const { role, nome } = await loadExtras(session.user.id);
      if (!mounted) return;
      setState({ user: session.user, session, role, nome, loading: false });
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // usa setTimeout(0) para evitar deadlock com o próprio supabase durante o callback
      setTimeout(() => { applySession(session); }, 0);
    });

    supabase.auth.getSession().then(({ data: { session } }) => applySession(session));

    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  return state;
}
