import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase as _sb } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase: any = _sb;
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ROLE_LABELS, MATERIAS, type AppRole } from "@/lib/pje";
import { criarUsuarioSistema, atualizarUsuarioSistema, excluirUsuarioSistema } from "@/lib/admin-users.functions";
import { ChevronLeft, Users, UserPlus, ShieldAlert, Pencil, Trash2, Copy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  head: () => ({ meta: [{ title: "Cadastrar usuários — PJe" }] }),
  component: AdminUsuarios,
});

interface UserRow {
  id: string; nome_completo: string | null; role: string | null;
  vara: string | null; comarca: string | null; materia: string | null;
  uf: string | null;
  numero_usuario: string | null; cpf: string | null; oab: string | null; orgao: string | null;
  email_contato: string | null;
}

const ROLES: AppRole[] = ["cidadao", "advogado", "promotor", "defensoria", "defensor", "servidor", "magistrado", "desembargador", "ministro_stj", "ministro_stf", "admin"];

const empty = {
  password: "", nome_completo: "", cpf: "", role: "cidadao" as AppRole,
  oab: "", orgao: "", vara: "", materia: "civel", comarca: "", email_contato: "",
  uf: "RJ",
};

function AdminUsuarios() {
  const { role, loading } = useAuth();
  const criar = useServerFn(criarUsuarioSistema);
  const atualizar = useServerFn(atualizarUsuarioSistema);
  const excluir = useServerFn(excluirUsuarioSistema);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [comarcasRJ, setComarcasRJ] = useState<string[]>([]);
  const [form, setForm] = useState({ ...empty });
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState({ ...empty });
  const [ufNovo, setUfNovo] = useState("RJ");
  const [ufEdit, setUfEdit] = useState("RJ");

  const loadUsers = async () => {
    const { data: roles } = await supabase.from("user_roles").select("user_id,role");
    const { data: profs } = await supabase.from("profiles").select("id,nome_completo,vara,comarca,materia,uf,numero_usuario,cpf,oab,orgao,email_contato");
    const rMap: Record<string, string> = {};
    (roles ?? []).forEach((r: { user_id: string; role: string }) => { rMap[r.user_id] = r.role; });
    setUsers((profs ?? []).map((p: Record<string, unknown>) => ({
      id: p.id as string, nome_completo: (p.nome_completo as string) ?? null,
      role: rMap[p.id as string] ?? null,
      vara: (p.vara as string) ?? null, comarca: (p.comarca as string) ?? null, materia: (p.materia as string) ?? null,
      numero_usuario: (p.numero_usuario as string) ?? null,
      cpf: (p.cpf as string) ?? null, oab: (p.oab as string) ?? null, orgao: (p.orgao as string) ?? null,
      email_contato: (p.email_contato as string) ?? null,
      uf: (p.uf as string) ?? null,
    })));
  };
  useEffect(() => {
    if (role === "admin") {
      loadUsers();
      supabase.from("comarcas").select("nome").eq("uf", "RJ").order("nome").then(({ data }: { data: { nome: string }[] | null }) => {
        setComarcasRJ((data ?? []).map((c) => c.nome));
      });
    }
  }, [role]);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Carregando…</div>;
  if (role !== "admin") {
    return (
      <div className="flex min-h-screen flex-col"><SiteHeader />
        <main className="flex-1 bg-secondary"><div className="mx-auto max-w-2xl px-4 py-16 text-center">
          <ShieldAlert className="size-10 text-destructive mx-auto" />
          <h1 className="text-xl font-bold mt-3">Acesso restrito</h1>
          <p className="text-sm text-muted-foreground mt-1">Somente o perfil SISTEMA (admin) pode cadastrar usuários.</p>
          <Link to="/painel" className="text-primary text-sm hover:underline mt-4 inline-block">Voltar ao painel</Link>
        </div></main>
        <SiteFooter />
      </div>
    );
  }

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await criar({ data: {
        password: form.password, nome_completo: form.nome_completo,
        cpf: form.cpf || null, role: form.role,
        oab: form.oab || null, orgao: form.orgao || null,
        vara: form.vara || null, materia: form.materia || null, comarca: form.comarca || null,
        uf: precisaVara(form.role) ? ufNovo : null,
        email_contato: form.email_contato || null,
      } });
      toast.success(`Usuário criado — nº ${res.numero_usuario}`, {
        description: "Repasse este número ao usuário para acesso.",
        action: { label: "Copiar", onClick: () => navigator.clipboard?.writeText(res.numero_usuario) },
        duration: 15000,
      });
      setForm({ ...empty });
      loadUsers();
    } catch (e) {
      toast.error("Falha ao cadastrar", { description: (e as Error).message });
    } finally { setBusy(false); }
  };

  const openEdit = (u: UserRow) => {
    setEditing(u);
    setEditForm({
      password: "", nome_completo: u.nome_completo ?? "", cpf: u.cpf ?? "",
      role: (u.role as AppRole) ?? "cidadao", oab: u.oab ?? "", orgao: u.orgao ?? "",
      vara: u.vara ?? "", materia: u.materia ?? "civel", comarca: u.comarca ?? "",
      email_contato: u.email_contato ?? "",
      uf: u.uf ?? "RJ",
    });
    setUfEdit(u.uf ?? "RJ");
  };
  const submitEdit = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      await atualizar({ data: {
        id: editing.id,
        password: editForm.password || undefined,
        nome_completo: editForm.nome_completo,
        role: editForm.role,
        cpf: editForm.cpf || null,
        oab: editForm.oab || null, orgao: editForm.orgao || null,
        vara: editForm.vara || null, materia: editForm.materia || null, comarca: editForm.comarca || null,
        uf: precisaVara(editForm.role) ? ufEdit : null,
        email_contato: editForm.email_contato || null,
      } });
      toast.success("Usuário atualizado");
      setEditing(null);
      loadUsers();
    } catch (e) {
      toast.error("Falha ao atualizar", { description: (e as Error).message });
    } finally { setBusy(false); }
  };
  const doDelete = async (u: UserRow) => {
    if (!confirm(`Excluir ${u.nome_completo ?? u.numero_usuario}? Esta ação é irreversível.`)) return;
    try {
      await excluir({ data: { id: u.id } });
      toast.success("Usuário excluído");
      loadUsers();
    } catch (e) {
      toast.error("Falha ao excluir", { description: (e as Error).message });
    }
  };

  const ComarcaField = ({ value, onChange, uf }: { value: string; onChange: (v: string) => void; uf: string }) =>
    uf === "RJ" ? (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder="Selecione a comarca" /></SelectTrigger>
        <SelectContent className="max-h-64">
          {comarcasRJ.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
        </SelectContent>
      </Select>
    ) : <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Ex.: São Paulo" />;

  const precisaVara = (r: AppRole) => ["magistrado", "servidor", "desembargador", "ministro_stj", "ministro_stf"].includes(r);
  const precisaLocal = (r: AppRole) => r === "magistrado" || r === "servidor";
  const precisaUf = (r: AppRole) => precisaLocal(r) || r === "desembargador";
  const precisaMateria = (r: AppRole) => r === "magistrado" || r === "servidor" || r === "desembargador";
  const varaLabel = (r: AppRole) =>
    r === "ministro_stj" || r === "ministro_stf" ? "Gabinete" : r === "desembargador" ? "Câmara / Órgão julgador" : "Vara";

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1 bg-secondary">
        <div className="mx-auto max-w-5xl px-4 py-8">
          <Link to="/painel" className="text-sm text-primary inline-flex items-center gap-1 hover:underline mb-3">
            <ChevronLeft className="size-4" /> Voltar
          </Link>
          <div className="flex items-center gap-2"><Users className="size-6 text-primary" /><h1 className="text-2xl md:text-3xl font-bold">Cadastrar usuários</h1></div>
          <p className="text-sm text-muted-foreground">O sistema gera automaticamente o número de usuário. É esse número que o usuário informa para acessar o PJe.</p>

          <form onSubmit={submitCreate} className="mt-6 bg-card border border-border rounded-lg p-5 space-y-4">
            <h2 className="font-semibold flex items-center gap-2"><UserPlus className="size-4" /> Novo usuário</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div><Label>Nome completo *</Label><Input required value={form.nome_completo} onChange={(e) => setForm({ ...form, nome_completo: e.target.value })} /></div>
              <div><Label>Senha inicial *</Label><Input type="text" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
              <div><Label>CPF</Label><Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} /></div>
              <div><Label>E-mail de contato (opcional)</Label><Input type="email" value={form.email_contato} onChange={(e) => setForm({ ...form, email_contato: e.target.value })} /></div>
              <div><Label>Perfil *</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as AppRole })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {form.role === "advogado" && (
                <div><Label>OAB</Label><Input value={form.oab} onChange={(e) => setForm({ ...form, oab: e.target.value })} /></div>
              )}
              {(form.role === "promotor" || form.role === "defensoria" || form.role === "defensor") && (
                <div><Label>Órgão</Label><Input value={form.orgao} onChange={(e) => setForm({ ...form, orgao: e.target.value })} /></div>
              )}
              {precisaVara(form.role) && (
                <>
                  <div><Label>{varaLabel(form.role)} *</Label><Input required value={form.vara} onChange={(e) => setForm({ ...form, vara: e.target.value })} placeholder={form.role === "ministro_stj" ? "Ex.: Gabinete — 1ª Turma STJ" : form.role === "ministro_stf" ? "Ex.: Gabinete — 2ª Turma STF" : form.role === "desembargador" ? "Ex.: 5ª Câmara Cível" : "Ex.: 3ª Vara Cível"} /></div>
                  {precisaUf(form.role) && (
                    <>
                      <div><Label>UF *</Label>
                        <Select value={ufNovo} onValueChange={setUfNovo}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="RJ">RJ</SelectItem><SelectItem value="SP">SP</SelectItem><SelectItem value="MG">MG</SelectItem></SelectContent>
                        </Select>
                      </div>
                      {precisaLocal(form.role) && <div><Label>Comarca *</Label>
                        <ComarcaField value={form.comarca} onChange={(v) => setForm({ ...form, comarca: v })} uf={ufNovo} />
                      </div>}
                    </>
                  )}
                  {precisaMateria(form.role) && (
                    <div><Label>Matéria *</Label>
                      <Select value={form.materia} onValueChange={(v) => setForm({ ...form, materia: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{MATERIAS.map((m) => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  )}
                </>
              )}

            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={busy}>{busy ? "Cadastrando…" : "Criar usuário"}</Button>
            </div>
          </form>

          <section className="mt-8">
            <h2 className="text-lg font-semibold mb-3">Usuários cadastrados</h2>
            <div className="bg-card border border-border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2">Nº</th>
                    <th className="text-left px-3 py-2">Nome</th>
                    <th className="text-left px-3 py-2">Perfil</th>
                    <th className="text-left px-3 py-2">Vara</th>
                    <th className="text-left px-3 py-2">Comarca</th>
                    <th className="text-left px-3 py-2">Matéria</th>
                    <th className="text-right px-3 py-2">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td className="px-3 py-2 font-mono">
                        <button onClick={() => { navigator.clipboard?.writeText(u.numero_usuario ?? ""); toast.success("Nº copiado"); }} className="inline-flex items-center gap-1 hover:text-primary">
                          {u.numero_usuario ?? "—"} <Copy className="size-3 opacity-60" />
                        </button>
                      </td>
                      <td className="px-3 py-2">{u.nome_completo ?? "—"}</td>
                      <td className="px-3 py-2">{u.role ? ROLE_LABELS[u.role as AppRole] : "—"}</td>
                      <td className="px-3 py-2">{u.vara ?? "—"}</td>
                      <td className="px-3 py-2">{u.comarca ?? "—"}</td>
                      <td className="px-3 py-2">{u.materia ?? "—"}</td>
                      <td className="px-3 py-2 text-right">
                        <Button variant="ghost" size="icon" onClick={() => { setUfEdit((u.comarca && comarcasRJ.includes(u.comarca)) ? "RJ" : "SP"); openEdit(u); }} title="Editar"><Pencil className="size-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => doDelete(u)} title="Excluir"><Trash2 className="size-4 text-destructive" /></Button>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr><td colSpan={7} className="text-center text-muted-foreground py-6">Nenhum usuário cadastrado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
      <SiteFooter />

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Editar usuário {editing?.numero_usuario ? `— nº ${editing.numero_usuario}` : ""}</DialogTitle></DialogHeader>
          <div className="grid sm:grid-cols-2 gap-4">
            <div><Label>Nome completo</Label><Input value={editForm.nome_completo} onChange={(e) => setEditForm({ ...editForm, nome_completo: e.target.value })} /></div>
            <div><Label>Nova senha (opcional)</Label><Input type="text" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} placeholder="Deixe vazio para manter" /></div>
            <div><Label>CPF</Label><Input value={editForm.cpf} onChange={(e) => setEditForm({ ...editForm, cpf: e.target.value })} /></div>
            <div><Label>E-mail de contato</Label><Input type="email" value={editForm.email_contato} onChange={(e) => setEditForm({ ...editForm, email_contato: e.target.value })} /></div>
            <div><Label>Perfil</Label>
              <Select value={editForm.role} onValueChange={(v) => setEditForm({ ...editForm, role: v as AppRole })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {editForm.role === "advogado" && <div><Label>OAB</Label><Input value={editForm.oab} onChange={(e) => setEditForm({ ...editForm, oab: e.target.value })} /></div>}
            {(editForm.role === "promotor" || editForm.role === "defensoria" || editForm.role === "defensor") && <div><Label>Órgão</Label><Input value={editForm.orgao} onChange={(e) => setEditForm({ ...editForm, orgao: e.target.value })} /></div>}
            {precisaVara(editForm.role) && (
              <>
                <div><Label>{varaLabel(editForm.role)}</Label><Input value={editForm.vara} onChange={(e) => setEditForm({ ...editForm, vara: e.target.value })} /></div>
                {precisaUf(editForm.role) && (
                  <>
                    <div><Label>UF</Label>
                      <Select value={ufEdit} onValueChange={setUfEdit}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="RJ">RJ</SelectItem><SelectItem value="SP">SP</SelectItem><SelectItem value="MG">MG</SelectItem></SelectContent>
                      </Select>
                    </div>
                    {precisaLocal(editForm.role) && <div><Label>Comarca</Label>
                      <ComarcaField value={editForm.comarca} onChange={(v) => setEditForm({ ...editForm, comarca: v })} uf={ufEdit} />
                    </div>}
                  </>
                )}
                {precisaMateria(editForm.role) && (
                  <div><Label>Matéria</Label>
                    <Select value={editForm.materia} onValueChange={(v) => setEditForm({ ...editForm, materia: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{MATERIAS.map((m) => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={submitEdit} disabled={busy}>{busy ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
