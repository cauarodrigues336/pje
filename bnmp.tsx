import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FileSearch, AlertTriangle, Search } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/bnmp")({
  head: () => ({ meta: [{ title: "BNMP — PJe" }] }),
  component: Bnmp,
});

function Bnmp() {
  const [busca, setBusca] = useState({ nome: "", cpf: "", mandado: "" });
  const [searched, setSearched] = useState(false);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1 bg-secondary">
        <div className="mx-auto max-w-5xl px-4 py-8">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded bg-primary text-primary-foreground flex items-center justify-center">
              <FileSearch className="size-6" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-primary font-semibold">CNJ</div>
              <h1 className="text-2xl md:text-3xl font-bold">Banco Nacional de Mandados de Prisão</h1>
              <p className="text-sm text-muted-foreground">
                Consulta integrada de mandados de prisão, internação e
                contramandados (BNMP 3.0).
              </p>
            </div>
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); setSearched(true); }}
            className="mt-6 bg-card border border-border rounded-lg p-5 grid gap-4 sm:grid-cols-3"
          >
            <div className="sm:col-span-2">
              <Label htmlFor="nome">Nome da pessoa</Label>
              <Input id="nome" value={busca.nome} onChange={(e) => setBusca({ ...busca, nome: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="cpf">CPF</Label>
              <Input id="cpf" placeholder="000.000.000-00" value={busca.cpf} onChange={(e) => setBusca({ ...busca, cpf: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="mandado">Número do mandado</Label>
              <Input id="mandado" placeholder="Ex.: 1234567-89.2026.8.26.0000" value={busca.mandado} onChange={(e) => setBusca({ ...busca, mandado: e.target.value })} />
            </div>
            <div className="sm:col-span-3 flex justify-end">
              <Button type="submit" className="gap-2"><Search className="size-4" /> Consultar BNMP</Button>
            </div>
          </form>

          <div className="mt-6 bg-card border border-border rounded-lg p-10 text-center">
            <AlertTriangle className="size-8 text-muted-foreground/60 mx-auto" />
            <p className="text-sm text-muted-foreground mt-3">
              {searched
                ? "Nenhum mandado encontrado para os critérios informados."
                : "Informe ao menos um critério de busca e clique em Consultar."}
            </p>
            <p className="text-xs text-muted-foreground mt-2 max-w-md mx-auto">
              Conforme Resolução CNJ nº 417/2021, o BNMP centraliza mandados
              expedidos por todos os órgãos do Poder Judiciário.
            </p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
