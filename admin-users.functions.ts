import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const createSchema = z.object({
  password: z.string().min(6),
  nome_completo: z.string().min(2),
  cpf: z.string().optional().nullable(),
  role: z.enum(["advogado", "cidadao", "servidor", "magistrado", "promotor", "admin", "desembargador", "ministro_stj", "ministro_stf", "defensoria", "defensor"]),
  oab: z.string().optional().nullable(),
  orgao: z.string().optional().nullable(),
  vara: z.string().optional().nullable(),
  materia: z.string().optional().nullable(),
  comarca: z.string().optional().nullable(),
  uf: z.string().length(2).optional().nullable(),
  email_contato: z.string().email().optional().nullable().or(z.literal("")),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  password: z.string().min(6).optional().nullable(),
  nome_completo: z.string().min(2).optional(),
  role: z.enum(["advogado", "cidadao", "servidor", "magistrado", "promotor", "admin", "desembargador", "ministro_stj", "ministro_stf", "defensoria", "defensor"]).optional(),
  cpf: z.string().optional().nullable(),
  oab: z.string().optional().nullable(),
  orgao: z.string().optional().nullable(),
  vara: z.string().optional().nullable(),
  materia: z.string().optional().nullable(),
  comarca: z.string().optional().nullable(),
  uf: z.string().length(2).optional().nullable(),
  email_contato: z.string().email().optional().nullable().or(z.literal("")),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!isAdmin) throw new Error("Apenas o perfil SISTEMA (admin) pode gerenciar usuários.");
}

export const criarUsuarioSistema = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => createSchema.parse(raw))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = supabaseAdmin as any;

    const { data: numero, error: nErr } = await admin.rpc("gen_numero_usuario");
    if (nErr || !numero) throw new Error("Falha ao gerar número de usuário: " + (nErr?.message ?? ""));
    const numeroStr = String(numero);
    const email = `${numeroStr}@pje.local`;

    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        nome_completo: data.nome_completo,
        cpf: data.cpf ?? null,
        oab: data.oab ?? null,
        orgao: data.orgao ?? null,
        vara: data.vara ?? null,
        materia: data.materia ?? null,
        comarca: data.comarca ?? null,
         uf: data.uf ?? null,
        numero_usuario: numeroStr,
        email_contato: data.email_contato ?? null,
        role: data.role,
      },
    });
    if (cErr || !created?.user) throw new Error(cErr?.message ?? "Falha ao criar usuário");
    return { id: created.user.id as string, numero_usuario: numeroStr };
  });

export const atualizarUsuarioSistema = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => updateSchema.parse(raw))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = supabaseAdmin as any;

    if (data.password && data.password.length >= 6) {
      const { error } = await admin.auth.admin.updateUserById(data.id, { password: data.password });
      if (error) throw new Error(error.message);
    }
    const profile: Record<string, unknown> = {};
    if (data.nome_completo !== undefined) profile.nome_completo = data.nome_completo;
    if (data.cpf !== undefined) profile.cpf = data.cpf;
    if (data.oab !== undefined) profile.oab = data.oab;
    if (data.orgao !== undefined) profile.orgao = data.orgao;
    if (data.vara !== undefined) profile.vara = data.vara;
    if (data.materia !== undefined) profile.materia = data.materia;
    if (data.comarca !== undefined) profile.comarca = data.comarca;
    if (data.uf !== undefined) profile.uf = data.uf;
    if (data.email_contato !== undefined) profile.email_contato = data.email_contato || null;
    if (Object.keys(profile).length) {
      const { error } = await admin.from("profiles").update(profile).eq("id", data.id);
      if (error) throw new Error(error.message);
    }
    if (data.role) {
      await admin.from("user_roles").delete().eq("user_id", data.id);
      const { error } = await admin.from("user_roles").insert({ user_id: data.id, role: data.role });
      if (error) throw new Error(error.message);
    }
    return { ok: true as const };
  });

export const excluirUsuarioSistema = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    if (data.id === context.userId) throw new Error("Você não pode excluir seu próprio usuário.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = supabaseAdmin as any;
    const { error } = await admin.auth.admin.deleteUser(data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
