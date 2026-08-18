export type AppRole = "advogado" | "cidadao" | "servidor" | "magistrado" | "promotor" | "admin" | "desembargador" | "ministro_stj" | "ministro_stf" | "defensoria" | "defensor";

export const ROLE_LABELS: Record<AppRole, string> = {
  advogado: "Advogado / Procurador",
  cidadao: "Cidadão / Jus postulandi",
  servidor: "Servidor",
  magistrado: "Magistrado",
  desembargador: "Desembargador",
  ministro_stj: "Ministro do STJ",
  ministro_stf: "Ministro do STF",
  promotor: "Ministério Público",
  defensoria: "Defensoria Pública (Instituição)",
  defensor: "Defensor Público",
  admin: "Administrador do Sistema",
};

export const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  advogado: "Consulte processos, peticione e acompanhe intimações",
  cidadao: "Consulta pública e acompanhamento dos seus processos",
  servidor: "Gestão processual, autuação e movimentações",
  magistrado: "Despachos, decisões e sentenças",
  desembargador: "Julgamento em 2ª instância / grau de recurso",
  ministro_stj: "Julgamento em 3ª instância — Superior Tribunal de Justiça",
  ministro_stf: "Julgamento em 4ª instância — Supremo Tribunal Federal",
  promotor: "Atuação ministerial e fiscalização da lei",
  defensoria: "Órgão institucional — intimações e prazos da Defensoria Pública",
  defensor: "Atuação em assistência jurídica integral e gratuita",
  admin: "Administração do sistema PJe",
};

/** Perfis de advocacia/instituições que peticionam (painel do advogado). */
export const ADVOCACIA_ROLES: AppRole[] = ["advogado", "promotor", "defensoria", "defensor"];
export function isAdvocaciaRole(role: AppRole | null | undefined): boolean {
  return !!role && ADVOCACIA_ROLES.includes(role);
}

/** Tipos de destinatário de intimações e prazos. */
export const DESTINATARIO_TIPOS: { v: string; l: string }[] = [
  { v: "parte", l: "Parte" },
  { v: "advogado", l: "Advogado da parte" },
  { v: "mp", l: "Ministério Público" },
  { v: "defensoria", l: "Defensoria Pública" },
  { v: "defensor", l: "Defensor Público" },
  { v: "outro", l: "Outro sujeito processual" },
];
export const DESTINATARIO_LABELS: Record<string, string> = Object.fromEntries(DESTINATARIO_TIPOS.map((d) => [d.v, d.l]));

export const PRAZO_STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  cumprido: "Cumprido",
  vencido: "Vencido",
  encerrado: "Encerrado",
};


/** Perfis julgadores (decidem nos autos). */
export const JULGADOR_ROLES: AppRole[] = ["magistrado", "desembargador", "ministro_stj", "ministro_stf"];
export function isJulgadorRole(role: AppRole | null | undefined): boolean {
  return !!role && JULGADOR_ROLES.includes(role);
}

/** Instâncias de distribuição. */
export const INSTANCIAS: { v: number; l: string; role: AppRole }[] = [
  { v: 1, l: "1ª Instância — Juiz", role: "magistrado" },
  { v: 2, l: "2ª Instância — Desembargador", role: "desembargador" },
  { v: 3, l: "3ª Instância — Ministro do STJ", role: "ministro_stj" },
  { v: 4, l: "4ª Instância — Ministro do STF", role: "ministro_stf" },
];
export const INSTANCIA_LABELS: Record<number, string> = Object.fromEntries(INSTANCIAS.map((i) => [i.v, i.l]));

/** Perfis internos (gabinete / secretaria / admin) — painel de gestão completo. */
export const INTERNAL_ROLES: AppRole[] = ["magistrado", "desembargador", "ministro_stj", "ministro_stf", "servidor", "admin"];

export function isInternalRole(role: AppRole | null | undefined): boolean {
  return !!role && INTERNAL_ROLES.includes(role);
}



export function canCreateProcess(role: AppRole | null | undefined): boolean {
  return role === "servidor" || role === "magistrado" || role === "admin"
    || role === "advogado" || role === "promotor" || role === "cidadao"
    || role === "defensoria" || role === "defensor";
}

export const MATERIAS: { v: string; l: string }[] = [
  { v: "civel", l: "Cível" },
  { v: "criminal", l: "Criminal" },
  { v: "familia", l: "Família" },
  { v: "infancia", l: "Infância e Juventude" },
  { v: "fazenda", l: "Fazenda Pública" },
  { v: "trabalhista", l: "Trabalhista" },
  { v: "juizado_especial", l: "Juizado Especial" },
  { v: "execucao_fiscal", l: "Execução Fiscal" },
];
export const MATERIA_LABELS: Record<string, string> = Object.fromEntries(MATERIAS.map((m) => [m.v, m.l]));

/** Converte usuário -> e-mail interno usado pelo Supabase Auth. */
export function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@pje.local`;
}

export function formatCNJ(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 20);
  if (d.length <= 7) return d;
  if (d.length <= 9) return `${d.slice(0, 7)}-${d.slice(7)}`;
  if (d.length <= 13) return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9)}`;
  if (d.length <= 14) return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13)}`;
  if (d.length <= 16) return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14)}`;
  return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14, 16)}.${d.slice(16, 20)}`;
}

export const STATUS_LABELS = {
  em_tramitacao: "Em tramitação",
  arquivado: "Arquivado",
  suspenso: "Suspenso",
  baixado: "Baixado",
  julgado: "Julgado",
} as const;

export const TIPO_PARTE_LABELS = {
  autor: "Autor",
  reu: "Réu",
  terceiro: "Terceiro",
  advogado: "Advogado",
  mp: "Ministério Público",
} as const;

export const TIPO_MOV_LABELS = {
  despacho: "Despacho",
  decisao: "Decisão",
  sentenca: "Sentença",
  peticao: "Petição",
  juntada: "Juntada",
  distribuicao: "Distribuição",
  intimacao: "Intimação",
} as const;

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}
export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
export function formatBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
