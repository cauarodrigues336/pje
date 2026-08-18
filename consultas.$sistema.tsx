import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { jsPDF } from "jspdf";
import { supabase as _sb } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase: any = _sb;
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { formatCNJ, formatBRL, isJulgadorRole } from "@/lib/pje";
import { Banknote, Car, FileSearch, Building2, Network, Home, HeartPulse, ShieldAlert, Loader2, Download, ChevronLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/consultas/$sistema")({
  head: () => ({ meta: [{ title: "Sistemas CNJ — PJe" }] }),
  component: ConsultasSistema,
});

type SistemaKey = "sisbajud" | "renajud" | "infojud" | "ccs" | "sniper" | "cnib" | "prevjud";

const SISTEMAS: Record<SistemaKey, { label: string; desc: string; icon: React.ComponentType<{ className?: string }>; tone: string }> = {
  sisbajud: { label: "SISBAJUD", desc: "Sistema de Envio de Ordens Judiciais ao Sistema Financeiro Nacional. Localização de ativos e bloqueio online.", icon: Banknote, tone: "text-success bg-success/10" },
  renajud:  { label: "RENAJUD",  desc: "Restrições Judiciais sobre Veículos Automotores. Consulta e aplicação de restrições.", icon: Car, tone: "text-primary bg-primary/10" },
  infojud:  { label: "INFOJUD",  desc: "Sistema de Informações ao Judiciário. Dados cadastrais e declarações da Receita Federal.", icon: FileSearch, tone: "text-info bg-info/10" },
  ccs:      { label: "CCS",      desc: "Cadastro de Clientes do Sistema Financeiro Nacional. Vínculos e relacionamentos bancários.", icon: Building2, tone: "text-warning-foreground bg-warning/20" },
  sniper:   { label: "SNIPER",   desc: "Sistema Nacional de Investigação Patrimonial e Recuperação de Ativos. Mapa de relações.", icon: Network, tone: "text-destructive bg-destructive/10" },
  cnib:     { label: "CNIB",     desc: "Central Nacional de Indisponibilidade de Bens. Ordens sobre patrimônio imobiliário.", icon: Home, tone: "text-primary bg-primary/10" },
  prevjud:  { label: "PREVJUD",  desc: "Integração com a Previdência Social. Vínculos, benefícios e CNIS.", icon: HeartPulse, tone: "text-success bg-success/10" },
};

interface ProcessoLite { id: string; numero: string; classe: string; orgao_julgador: string | null; vara: string | null; comarca: string | null }
interface ParteLite { id: string; nome: string; documento: string | null; tipo: string }

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const rint = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const rmoney = (min: number, max: number) => Math.round((Math.random() * (max - min) + min) * 100) / 100;
const pad = (n: number, len: number) => String(n).padStart(len, "0");
const rDate = (daysBack: number) => {
  const d = new Date(); d.setDate(d.getDate() - rint(1, daysBack));
  return d.toLocaleDateString("pt-BR");
};

function ConsultasSistema() {
  const { sistema } = useParams({ from: "/_authenticated/consultas/$sistema" });
  const { role, nome } = useAuth();
  const sk = (sistema as SistemaKey);
  const def = SISTEMAS[sk];

  const [numeroInput, setNumeroInput] = useState("");
  const [processo, setProcesso] = useState<ProcessoLite | null>(null);
  const [partes, setPartes] = useState<ParteLite[]>([]);
  const [parteId, setParteId] = useState<string>("");
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [resultado, setResultado] = useState<any>(null);
  const [valorSol, setValorSol] = useState<string>(""); // SISBAJUD

  if (!def) {
    return (
      <div className="flex min-h-screen flex-col"><SiteHeader />
        <main className="flex-1 bg-secondary p-8"><div className="mx-auto max-w-2xl text-center">Sistema não encontrado.</div></main>
        <SiteFooter />
      </div>
    );
  }

  if (role && !isJulgadorRole(role) && role !== "admin" && role !== "servidor") {
    return (
      <div className="flex min-h-screen flex-col"><SiteHeader />
        <main className="flex-1 bg-secondary"><div className="mx-auto max-w-2xl px-4 py-16 text-center">
          <ShieldAlert className="size-10 text-destructive mx-auto" />
          <h1 className="text-xl font-bold mt-3">Acesso restrito</h1>
          <p className="text-sm text-muted-foreground mt-1">Somente magistrados e servidores podem acessar os sistemas do CNJ.</p>
        </div></main>
        <SiteFooter />
      </div>
    );
  }

  const buscarProcesso = async () => {
    const num = numeroInput.replace(/\D/g, "");
    if (num.length < 7) { toast.error("Informe o número do processo"); return; }
    setSearching(true); setProcesso(null); setPartes([]); setParteId(""); setResultado(null);
    try {
      const { data: procs } = await supabase.from("processos").select("id,numero,classe,orgao_julgador,vara,comarca");
      const match = ((procs ?? []) as ProcessoLite[]).filter((p) => p.numero.replace(/\D/g, "").includes(num)).slice(0, 5);
      if (match.length === 0) { toast.error("Processo não encontrado"); return; }
      const p = match[0];
      setProcesso(p);
      const { data: pts } = await supabase.from("partes").select("id,nome,documento,tipo").eq("processo_id", p.id).in("tipo", ["autor", "reu", "terceiro"]);
      setPartes(pts ?? []);
    } finally { setSearching(false); }
  };

  const executar = async () => {
    if (!processo || !parteId) { toast.error("Selecione a parte alvo"); return; }
    if (sk === "sisbajud") {
      const v = Number((valorSol || "").replace(/[^\d,\.]/g, "").replace(/\./g, "").replace(",", "."));
      if (!v || v <= 0) { toast.error("Informe o valor solicitado para bloqueio"); return; }
    }
    setLoading(true); setResultado(null);
    await new Promise((r) => setTimeout(r, 1200 + rint(300, 900)));
    const parte = partes.find((p) => p.id === parteId)!;
    const solicitado = sk === "sisbajud"
      ? Number((valorSol || "").replace(/[^\d,\.]/g, "").replace(/\./g, "").replace(",", "."))
      : 0;
    setResultado(gerarResultado(sk, parte, solicitado));
    setLoading(false);
  };

  const baixarPDF = () => {
    if (!processo || !resultado) return;
    const parte = partes.find((p) => p.id === parteId)!;
    const blob = gerarPDF(sk, def.label, processo, parte, resultado, nome ?? "Usuário do Sistema", role ?? "servidor");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${def.label}_${processo.numero.replace(/\D/g, "")}.pdf`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1 bg-secondary">
        <div className="mx-auto max-w-5xl px-4 py-8">
          <Link to="/painel" className="text-sm text-primary inline-flex items-center gap-1 hover:underline mb-3">
            <ChevronLeft className="size-4" /> Voltar ao painel
          </Link>

          <div className="flex flex-wrap gap-2 mb-4">
            {(Object.keys(SISTEMAS) as SistemaKey[]).map((k) => {
              const s = SISTEMAS[k];
              const active = k === sk;
              return (
                <Link key={k} to="/consultas/$sistema" params={{ sistema: k }}
                  className={`px-3 py-1.5 rounded text-xs font-semibold border ${active ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:border-primary"}`}>
                  {s.label}
                </Link>
              );
            })}
          </div>

          <header className="bg-card border border-border rounded-lg p-5 flex items-start gap-4">
            <div className={`size-12 rounded flex items-center justify-center ${def.tone}`}>
              <def.icon className="size-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold">{def.label}</h1>
              <p className="text-sm text-muted-foreground mt-1">{def.desc}</p>
            </div>
          </header>

          <section className="mt-5 bg-card border border-border rounded-lg p-5 space-y-4">
            <h2 className="font-semibold">Consulta</h2>
            <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
              <div>
                <Label>Número do processo</Label>
                <Input value={numeroInput} onChange={(e) => setNumeroInput(formatCNJ(e.target.value))} placeholder="0000000-00.0000.0.00.0000" />
              </div>
              <Button onClick={buscarProcesso} disabled={searching}>
                {searching ? <><Loader2 className="size-4 mr-2 animate-spin" /> Buscando…</> : "Localizar processo"}
              </Button>
            </div>

            {processo && (
              <div className="border border-border rounded p-3 bg-muted/30">
                <div className="text-xs text-muted-foreground">Processo localizado</div>
                <div className="font-mono font-semibold text-primary">{formatCNJ(processo.numero)}</div>
                <div className="text-xs">{processo.classe}</div>
                <div className="mt-3">
                  <Label>Selecione a parte alvo</Label>
                  <div className="mt-1 grid gap-2">
                    {partes.length === 0 ? (
                      <div className="text-xs text-muted-foreground">Nenhuma parte cadastrada.</div>
                    ) : partes.map((p) => (
                      <label key={p.id} className={`flex items-center gap-3 border rounded p-2 cursor-pointer ${parteId === p.id ? "border-primary bg-primary/5" : "border-border"}`}>
                        <input type="radio" name="parte" checked={parteId === p.id} onChange={() => setParteId(p.id)} />
                        <div className="flex-1">
                          <div className="text-sm font-medium">{p.nome} <span className="text-[10px] uppercase text-muted-foreground ml-1">({p.tipo})</span></div>
                          <div className="text-xs text-muted-foreground">{p.documento ?? "sem documento"}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {sk === "sisbajud" && (
                  <div className="mt-3">
                    <Label>Valor solicitado para bloqueio (R$) *</Label>
                    <Input inputMode="decimal" placeholder="Ex.: 25000,00" value={valorSol} onChange={(e) => setValorSol(e.target.value)} />
                    <div className="text-[11px] text-muted-foreground mt-1">Somente o valor abaixo será usado como teto do bloqueio na ordem SISBAJUD.</div>
                  </div>
                )}

                <div className="mt-3 flex justify-end">
                  <Button onClick={executar} disabled={loading || !parteId}>
                    {loading ? <><Loader2 className="size-4 mr-2 animate-spin" /> Consultando {def.label}…</> : "Prosseguir"}
                  </Button>
                </div>
              </div>
            )}
          </section>

          {resultado && processo && (
            <section className="mt-5 bg-card border border-border rounded-lg p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold">Resultado — {def.label}</h2>
                <Button variant="outline" size="sm" onClick={baixarPDF}><Download className="size-4 mr-2" /> Baixar PDF</Button>
              </div>
              <ResultadoView sistema={sk} data={resultado} />
            </section>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

// ============ Geradores de resultado ============

const BANCOS_CCS = [
  { nome: "Banco do Brasil S.A.", ispb: "00000000", compe: "001" },
  { nome: "Caixa Econômica Federal", ispb: "00360305", compe: "104" },
  { nome: "Itaú Unibanco S.A.", ispb: "60701190", compe: "341" },
  { nome: "Banco Bradesco S.A.", ispb: "60746948", compe: "237" },
  { nome: "Banco Santander (Brasil) S.A.", ispb: "90400888", compe: "033" },
  { nome: "Nu Pagamentos S.A. (Nubank)", ispb: "18236120", compe: "260" },
  { nome: "Banco Inter S.A.", ispb: "00416968", compe: "077" },
  { nome: "BTG Pactual S.A.", ispb: "30306294", compe: "208" },
  { nome: "Sicoob", ispb: "02038232", compe: "756" },
  { nome: "Banrisul", ispb: "92702067", compe: "041" },
];

const RESPOSTAS_SISBAJUD = [
  { cod: "00", desc: "Cumprida integralmente" },
  { cod: "01", desc: "Cumprida parcialmente (saldo insuficiente)" },
  { cod: "02", desc: "Sem saldo disponível" },
  { cod: "03", desc: "Cliente não localizado" },
  { cod: "04", desc: "Conta encerrada" },
  { cod: "99", desc: "Não respondida no prazo" },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function gerarResultado(s: SistemaKey, parte: ParteLite, solicitado: number): any {
  if (s === "sisbajud") {
    const ordem = `${new Date().getFullYear()}.${pad(rint(1, 9999999), 7)}`;
    const bancos = [...BANCOS_CCS].sort(() => Math.random() - 0.5).slice(0, rint(3, 7));
    let restante = solicitado;
    const respostas = bancos.map((b) => {
      const respostaObj = pick(RESPOSTAS_SISBAJUD);
      let saldo = 0, bloqueado = 0, contaSalario = 0;
      if (respostaObj.cod === "00" || respostaObj.cod === "01") {
        saldo = rmoney(200, 120000);
        bloqueado = respostaObj.cod === "00" ? Math.min(saldo, restante) : Math.min(saldo * (0.2 + Math.random() * 0.6), restante);
        bloqueado = Math.round(bloqueado * 100) / 100;
        contaSalario = Math.random() < 0.15 ? Math.round(bloqueado * 0.3 * 100) / 100 : 0;
        restante = Math.max(0, restante - bloqueado);
      }
      return {
        banco: b.nome, ispb: b.ispb, compe: b.compe,
        agencia: pad(rint(1, 9999), 4), conta: `${pad(rint(1, 999999), 6)}-${rint(0, 9)}`,
        tipo: pick(["Conta Corrente", "Poupança", "Investimento"]),
        codResposta: respostaObj.cod, resposta: respostaObj.desc,
        saldo, bloqueado, contaSalario,
        remanescente: bloqueado > 0 ? Math.round((bloqueado - contaSalario) * 100) / 100 : 0,
      };
    });
    const totalBloq = respostas.reduce((a, r) => a + r.bloqueado, 0);
    const situacao = totalBloq >= solicitado ? "Cumprida integralmente"
      : totalBloq > 0 ? "Cumprida parcialmente"
      : "Resposta negativa";
    return { ordem, solicitado, respostas, totalBloq, situacao, dataOrdem: new Date().toLocaleDateString("pt-BR") };
  }
  if (s === "renajud") {
    const marcas = [
      { m: "Toyota", mo: "Corolla XEi 2.0", ver: "XEI" },
      { m: "Honda", mo: "Civic EXL 2.0", ver: "EXL" },
      { m: "Volkswagen", mo: "Gol 1.0", ver: "MPI Trend" },
      { m: "Fiat", mo: "Argo Drive 1.3", ver: "DRIVE" },
      { m: "Chevrolet", mo: "Onix LT 1.0", ver: "LT" },
      { m: "Hyundai", mo: "HB20 Comfort", ver: "COMFORT" },
      { m: "Renault", mo: "Kwid Zen 1.0", ver: "ZEN" },
      { m: "Jeep", mo: "Compass Longitude", ver: "LONGITUDE" },
    ];
    const cores = ["Prata", "Preto", "Branco", "Cinza", "Vermelho", "Azul"];
    const municipios = ["Rio de Janeiro", "Niterói", "Teresópolis", "Petrópolis", "Nova Friburgo"];
    const veiculos = Array.from({ length: rint(0, 4) }, () => {
      const car = pick(marcas);
      const anoFab = rint(2010, 2025);
      const restricoes = Math.random() < 0.6 ? [] : [pick(["Alienação fiduciária", "Restrição judicial RENAJUD anterior", "Restrição administrativa"])];
      return {
        marca: car.m, modelo: car.mo, versao: car.ver,
        placa: `${String.fromCharCode(65 + rint(0, 25)) + String.fromCharCode(65 + rint(0, 25)) + String.fromCharCode(65 + rint(0, 25))}${rint(0, 9)}${String.fromCharCode(65 + rint(0, 25))}${pad(rint(0, 99), 2)}`,
        renavam: pad(rint(10000000000, 99999999999), 11),
        chassi: Array.from({ length: 17 }, () => "ABCDEFGHJKLMNPRSTUVWXYZ0123456789"[rint(0, 32)]).join(""),
        anoFab, anoMod: anoFab + rint(0, 1),
        cor: pick(cores), categoria: "Particular", especie: "Passageiro", tipo: "Automóvel",
        municipio: pick(municipios), uf: "RJ",
        licenciamento: pick(["Licenciado", "Vencido", "Em dia"]),
        situacao: pick(["Ativo", "Ativo", "Ativo", "Baixado"]),
        restricoes,
      };
    });
    return { veiculos, requisicao: `RENAJUD-${new Date().getFullYear()}-${pad(rint(1, 999999), 6)}` };
  }
  if (s === "infojud") {
    const imoveis = Array.from({ length: rint(0, 3) }, () => ({
      tipo: pick(["Apartamento", "Casa", "Terreno", "Sala comercial", "Sítio"]),
      endereco: `${pick(["Rua", "Av."])} ${pick(["das Flores", "Brasil", "Getúlio Vargas", "7 de Setembro", "das Palmeiras"])}, ${rint(1, 2000)} — ${pick(["Rio de Janeiro/RJ", "Niterói/RJ", "Teresópolis/RJ", "Petrópolis/RJ"])}`,
      valor: rmoney(150000, 2500000),
    }));
    const quotas = Array.from({ length: rint(0, 2) }, () => ({
      empresa: `${pick(["Alfa", "Beta", "Gama", "Delta", "Omega"])} ${pick(["Comércio", "Serviços", "Participações", "Consultoria"])} Ltda`,
      cnpj: `${pad(rint(0, 99999999), 8)}/${pad(rint(1, 9999), 4)}-${pad(rint(0, 99), 2)}`,
      participacao: rint(5, 100) + "%",
    }));
    const veiculos = Array.from({ length: rint(0, 2) }, () => ({
      descricao: pick(["Toyota Corolla 2020", "Honda Civic 2019", "Fiat Argo 2022", "Chevrolet Onix 2021"]),
      valor: rmoney(35000, 180000),
    }));
    const contasDecl = Array.from({ length: rint(1, 4) }, () => ({
      banco: pick(BANCOS_CCS).nome, saldo: rmoney(500, 250000),
    }));
    const exercicio = new Date().getFullYear() - 1;
    return {
      requisicao: `INFOJUD-${exercicio + 1}-${pad(rint(1, 999999), 6)}`,
      cadastro: {
        situacao: pick(["Ativa", "Ativa", "Ativa", "Suspensa"]),
        dataInscricao: `${pad(rint(1, 28), 2)}/${pad(rint(1, 12), 2)}/${rint(1980, 2005)}`,
        nascimento: `${pad(rint(1, 28), 2)}/${pad(rint(1, 12), 2)}/${rint(1955, 2000)}`,
        mae: `${pick(["Maria", "Ana", "Regina", "Luiza"])} ${pick(["Silva", "Souza", "Oliveira", "Costa"])} ${parte.nome.split(" ").slice(-1)[0] ?? ""}`.trim(),
        endereco: `${pick(["Rua", "Av."])} ${pick(["das Flores", "Brasil", "Rio Branco"])}, ${rint(1, 2000)}`,
        cep: `${pad(rint(10000, 99999), 5)}-${pad(rint(0, 999), 3)}`,
        municipio: pick(["Rio de Janeiro", "Niterói", "Teresópolis"]), uf: "RJ",
        email: `${(parte.nome.split(" ")[0] ?? "titular").toLowerCase()}@email.com`,
        telefone: `(21) 9${pad(rint(0, 99999999), 8)}`,
      },
      dirpf: {
        exercicio, anoCalendario: exercicio - 1, tipo: "Original",
        recibo: pad(rint(1, 99999999999), 11),
        dataEntrega: `${pad(rint(1, 30), 2)}/04/${exercicio}`,
        rendTributaveis: rmoney(30000, 500000),
        rendIsentos: rmoney(0, 80000),
        rendExclusivos: rmoney(0, 40000),
        dependentes: rint(0, 3),
        pagamentos: rmoney(0, 60000),
        imoveis, quotas, veiculos, contasDecl,
        impostoDevido: rmoney(0, 40000),
        impostoPago: rmoney(0, 40000),
      },
      evolucao: [rmoney(100000, 400000), rmoney(150000, 500000), rmoney(200000, 700000)],
    };
  }
  if (s === "ccs") {
    const papeis = ["Titular", "Cotitular", "Procurador", "Representante legal"];
    const relacs = ["Conta Corrente", "Poupança", "Conta-salário", "Conta de investimento", "Operação de crédito"];
    const vinculos = Array.from({ length: rint(2, 6) }, () => {
      const inicio = new Date(); inicio.setFullYear(inicio.getFullYear() - rint(1, 15));
      const ativo = Math.random() > 0.35;
      const fim = ativo ? null : new Date(inicio.getTime() + rint(365, 3000) * 86400000);
      const bank = pick(BANCOS_CCS);
      return {
        banco: bank.nome, ispb: bank.ispb, compe: bank.compe,
        papel: pick(papeis), relacionamento: pick(relacs),
        inicio: inicio.toLocaleDateString("pt-BR"),
        fim: fim ? fim.toLocaleDateString("pt-BR") : null,
        situacao: ativo ? "Ativo" : "Encerrado",
      };
    });
    return { vinculos, requisicao: `CCS-${new Date().getFullYear()}-${pad(rint(1, 999999), 6)}` };
  }
  if (s === "sniper") {
    const empresas = Array.from({ length: rint(1, 3) }, () => ({
      nome: `${pick(["Alfa", "Nova", "Solar", "Prime", "Global"])} ${pick(["Investimentos", "Empreendimentos", "Holding", "Participações"])} S/A`,
      cnpj: `${pad(rint(0, 99999999), 8)}/${pad(rint(1, 9999), 4)}-${pad(rint(0, 99), 2)}`,
      cargo: pick(["Sócio administrador", "Sócio quotista", "Diretor"]),
      participacao: rint(5, 100) + "%",
      situacao: pick(["Ativa", "Ativa", "Baixada"]),
    }));
    const socios = Array.from({ length: rint(2, 5) }, () => pick(["João Silva", "Maria Souza", "Carlos Oliveira", "Ana Santos", "Pedro Lima", "Juliana Costa"]));
    const parentes = Array.from({ length: rint(1, 4) }, () => ({
      nome: pick(["Antônio", "Regina", "Fernanda", "Ricardo", "Luiza"]) + " " + (parte.nome.split(" ").slice(-1)[0] ?? "Silva"),
      grau: pick(["Cônjuge", "Filho(a)", "Pai/Mãe", "Irmão(ã)"]),
    }));
    const patrimonio = {
      veiculos: rint(0, 4), imoveis: rint(0, 3), embarcacoes: rint(0, 1), aeronaves: rint(0, 1),
    };
    return { empresas, socios, parentes, patrimonio, requisicao: `SNIPER-${new Date().getFullYear()}-${pad(rint(1, 999999), 6)}`,
      bases: ["Receita Federal", "Banco Central", "RENAJUD", "CNIB", "Juntas Comerciais"] };
  }
  if (s === "cnib") {
    const cartorios = ["1º RI de Teresópolis/RJ", "2º RI de Niterói/RJ", "3º RI do Rio de Janeiro/RJ", "1º RI de Petrópolis/RJ", "1º RI de Nova Friburgo/RJ"];
    const ordens = Array.from({ length: rint(0, 3) }, () => ({
      protocolo: `CNIB-${new Date().getFullYear()}-${pad(rint(1, 999999), 6)}`,
      cartorio: pick(cartorios),
      matricula: pad(rint(1, 999999), 6),
      cnm: pad(rint(1, 999999999999999), 15),
      municipio: pick(["Rio de Janeiro", "Niterói", "Teresópolis"]), uf: "RJ",
      tribunalOrigem: "TJRJ", vara: pick(["1ª Vara Cível", "2ª Vara Cível", "1ª Vara de Fazenda"]),
      processo: `${pad(rint(1, 9999999), 7)}-${pad(rint(0, 99), 2)}.${rint(2019, 2025)}.8.19.0001`,
      dataInclusao: rDate(120),
      status: pick(["Ativa", "Ativa", "Ativa", "Cancelada", "Levantada"]),
    }));
    return { ordens, requisicao: `CNIB-${new Date().getFullYear()}-${pad(rint(1, 999999), 6)}` };
  }
  // prevjud
  const empregadores = ["Prefeitura Municipal de Teresópolis", "Ambev S.A.", "Petrobras", "Vale S.A.", "Empresa Alfa Ltda", "Comércio Beta ME", "Autônomo (contribuinte individual)"];
  const cnpjs = Array.from({ length: 7 }, () => `${pad(rint(0, 99999999), 8)}/${pad(rint(1, 9999), 4)}-${pad(rint(0, 99), 2)}`);
  const beneficios = [null, null, "Aposentadoria por idade", "Auxílio-doença", "BPC/LOAS"];
  const b = pick(beneficios);
  const cnis = Array.from({ length: rint(3, 8) }, (_, i) => {
    const inicio = new Date(); inicio.setFullYear(inicio.getFullYear() - rint(1, 20) - i);
    const fim = i === 0 && Math.random() > 0.4 ? null : new Date(inicio.getTime() + rint(180, 2000) * 86400000);
    const idx = rint(0, empregadores.length - 1);
    return {
      empregador: empregadores[idx], cnpj: cnpjs[idx],
      inicio: inicio.toLocaleDateString("pt-BR"),
      fim: fim ? fim.toLocaleDateString("pt-BR") : null,
      salario: rmoney(1412, 15000),
      situacao: fim ? "Encerrado" : "Ativo",
      tipoVinculo: pick(["Empregado CLT", "Contribuinte individual", "Servidor público"]),
    };
  });
  return {
    requisicao: `PREVJUD-${new Date().getFullYear()}-${pad(rint(1, 999999), 6)}`,
    nit: pad(rint(10000000000, 99999999999), 11),
    situacaoCad: "Ativo",
    cnis,
    beneficio: b ? {
      nb: pad(rint(100000000, 999999999), 9),
      especie: pick(["41 - Aposentadoria por idade", "31 - Auxílio-doença", "87 - BPC/LOAS"]),
      nome: b,
      situacao: pick(["Ativo", "Ativo", "Suspenso"]),
      dib: rDate(2000), dip: rDate(1900),
      agencia: pick(["APS Teresópolis", "APS Niterói", "APS Rio de Janeiro"]),
      valor: rmoney(1412, 8000),
    } : null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ResultadoView({ sistema, data }: { sistema: SistemaKey; data: any }) {
  if (sistema === "sisbajud") {
    return (
      <div>
        <div className="grid sm:grid-cols-3 gap-3 mb-3 text-sm">
          <Info label="Ordem" value={data.ordem} />
          <Info label="Solicitado" value={formatBRL(data.solicitado)} />
          <Info label="Situação" value={data.situacao} />
        </div>
        <table className="w-full text-xs border border-border">
          <thead className="bg-muted/50"><tr>
            <th className="p-2 text-left">Instituição</th><th className="p-2 text-left">Ag./Conta</th>
            <th className="p-2 text-left">Resposta</th><th className="p-2 text-right">Saldo</th>
            <th className="p-2 text-right">Bloqueado</th></tr></thead>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <tbody>{data.respostas.map((c: any, i: number) => (
            <tr key={i} className="border-t border-border">
              <td className="p-2">{c.banco}<div className="text-[10px] text-muted-foreground">ISPB {c.ispb} · COMPE {c.compe}</div></td>
              <td className="p-2 font-mono">{c.agencia}/{c.conta}<div className="text-[10px] text-muted-foreground">{c.tipo}</div></td>
              <td className="p-2"><span className="font-mono">{c.codResposta}</span> — {c.resposta}</td>
              <td className="p-2 text-right">{c.saldo ? formatBRL(c.saldo) : "—"}</td>
              <td className={`p-2 text-right font-semibold ${c.bloqueado > 0 ? "text-success" : "text-muted-foreground"}`}>{c.bloqueado ? formatBRL(c.bloqueado) : "—"}</td>
            </tr>
          ))}</tbody>
        </table>
        <div className="text-sm mt-3">Total bloqueado: <strong className="text-success">{formatBRL(data.totalBloq)}</strong></div>
      </div>
    );
  }
  if (sistema === "renajud") {
    if (data.veiculos.length === 0) return <div className="text-sm text-muted-foreground">Nenhum veículo localizado.</div>;
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {data.veiculos.map((v: any, i: number) => (
          <div key={i} className="border border-border rounded p-3 text-xs">
            <div className="font-semibold text-sm">{v.marca} {v.modelo}</div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 mt-2 font-mono">
              <div>Placa: {v.placa}</div><div>Cor: {v.cor}</div>
              <div>Renavam: {v.renavam}</div><div>Ano: {v.anoFab}/{v.anoMod}</div>
              <div className="col-span-2">Chassi: {v.chassi}</div>
              <div>Município: {v.municipio}/{v.uf}</div><div>Categoria: {v.categoria}</div>
            </div>
            <div className="mt-2">Situação: <strong>{v.situacao}</strong> · Licenciamento: {v.licenciamento}</div>
            <div className="mt-1">Restrições: <strong>{v.restricoes.length === 0 ? "Nenhuma" : v.restricoes.join(", ")}</strong></div>
          </div>
        ))}
      </div>
    );
  }
  if (sistema === "infojud") {
    const c = data.cadastro; const d = data.dirpf;
    return (
      <div className="space-y-3 text-xs">
        <div className="border border-border rounded p-3">
          <div className="font-semibold text-sm mb-1">Dados cadastrais (Receita Federal)</div>
          <div className="grid sm:grid-cols-2 gap-x-4 gap-y-0.5">
            <div>Situação cadastral: <strong>{c.situacao}</strong></div>
            <div>Inscrição CPF: {c.dataInscricao}</div>
            <div>Nascimento: {c.nascimento}</div>
            <div>Mãe: {c.mae}</div>
            <div className="sm:col-span-2">Endereço: {c.endereco} — CEP {c.cep} — {c.municipio}/{c.uf}</div>
            <div>E-mail: {c.email}</div><div>Telefone: {c.telefone}</div>
          </div>
        </div>
        <div className="border border-border rounded p-3">
          <div className="font-semibold text-sm mb-1">DIRPF exercício {d.exercicio} (ano-calendário {d.anoCalendario})</div>
          <div className="grid sm:grid-cols-2 gap-x-4 gap-y-0.5">
            <div>Recibo: <span className="font-mono">{d.recibo}</span></div><div>Entrega: {d.dataEntrega}</div>
            <div>Rend. tributáveis: <strong>{formatBRL(d.rendTributaveis)}</strong></div>
            <div>Rend. isentos: {formatBRL(d.rendIsentos)}</div>
            <div>Rend. exclusivos: {formatBRL(d.rendExclusivos)}</div>
            <div>Dependentes: {d.dependentes}</div>
            <div>Imposto devido: {formatBRL(d.impostoDevido)}</div>
            <div>Imposto pago: {formatBRL(d.impostoPago)}</div>
          </div>
          <div className="mt-2">Evolução patrimonial: {data.evolucao.map((v: number) => formatBRL(v)).join(" → ")}</div>
        </div>
        <div className="border border-border rounded p-3">
          <div className="font-semibold text-sm mb-1">Bens e direitos declarados</div>
          <div>Imóveis ({d.imoveis.length}):</div>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {d.imoveis.length === 0 ? <div className="text-muted-foreground">Nenhum</div> : d.imoveis.map((im: any, i: number) => (<div key={i}>• {im.tipo} — {im.endereco} — <strong>{formatBRL(im.valor)}</strong></div>))}
          <div className="mt-2">Veículos ({d.veiculos.length}):</div>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {d.veiculos.map((v: any, i: number) => (<div key={i}>• {v.descricao} — {formatBRL(v.valor)}</div>))}
          <div className="mt-2">Contas bancárias declaradas ({d.contasDecl.length}):</div>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {d.contasDecl.map((cc: any, i: number) => (<div key={i}>• {cc.banco} — saldo declarado {formatBRL(cc.saldo)}</div>))}
          <div className="mt-2">Quotas societárias ({d.quotas.length}):</div>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {d.quotas.map((q: any, i: number) => (<div key={i}>• {q.empresa} — CNPJ {q.cnpj} — {q.participacao}</div>))}
        </div>
      </div>
    );
  }
  if (sistema === "ccs") {
    return (
      <table className="w-full text-xs border border-border">
        <thead className="bg-muted/50"><tr>
          <th className="p-2 text-left">Instituição</th><th className="p-2 text-left">Relacionamento</th>
          <th className="p-2 text-left">Papel</th><th className="p-2 text-left">Início</th>
          <th className="p-2 text-left">Fim</th><th className="p-2 text-left">Situação</th></tr></thead>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <tbody>{data.vinculos.map((v: any, i: number) => (
          <tr key={i} className="border-t border-border">
            <td className="p-2">{v.banco}<div className="text-[10px] text-muted-foreground">ISPB {v.ispb} · COMPE {v.compe}</div></td>
            <td className="p-2">{v.relacionamento}</td><td className="p-2">{v.papel}</td>
            <td className="p-2">{v.inicio}</td><td className="p-2">{v.fim ?? "—"}</td>
            <td className={`p-2 ${v.situacao === "Ativo" ? "text-success font-semibold" : ""}`}>{v.situacao}</td>
          </tr>
        ))}</tbody>
      </table>
    );
  }
  if (sistema === "sniper") {
    return (
      <div className="grid gap-3 md:grid-cols-3">
        <div className="border border-border rounded p-3">
          <div className="font-semibold text-sm mb-2">Empresas vinculadas</div>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {data.empresas.map((e: any, i: number) => (
            <div key={i} className="text-xs mb-2">
              <div className="font-medium">{e.nome}</div>
              <div className="text-muted-foreground">{e.cnpj} · {e.cargo} · {e.participacao} · {e.situacao}</div>
            </div>
          ))}
        </div>
        <div className="border border-border rounded p-3">
          <div className="font-semibold text-sm mb-2">Sócios comuns / relacionados</div>
          {data.socios.map((s: string, i: number) => (<div key={i} className="text-xs mb-1">• {s}</div>))}
          <div className="font-semibold text-sm mb-2 mt-4">Parentes</div>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {data.parentes.map((p: any, i: number) => (<div key={i} className="text-xs mb-1">{p.nome} — <em>{p.grau}</em></div>))}
        </div>
        <div className="border border-border rounded p-3 text-xs">
          <div className="font-semibold text-sm mb-2">Patrimônio consolidado</div>
          <div>Veículos: <strong>{data.patrimonio.veiculos}</strong></div>
          <div>Imóveis: <strong>{data.patrimonio.imoveis}</strong></div>
          <div>Embarcações: <strong>{data.patrimonio.embarcacoes}</strong></div>
          <div>Aeronaves: <strong>{data.patrimonio.aeronaves}</strong></div>
          <div className="font-semibold mt-3 mb-1">Bases consultadas</div>
          {data.bases.map((b: string, i: number) => <div key={i}>• {b}</div>)}
        </div>
      </div>
    );
  }
  if (sistema === "cnib") {
    if (data.ordens.length === 0) return <div className="text-sm text-muted-foreground">Não há ordens de indisponibilidade em nome do pesquisado.</div>;
    return (
      <table className="w-full text-xs border border-border">
        <thead className="bg-muted/50"><tr>
          <th className="p-2 text-left">Protocolo</th><th className="p-2 text-left">Cartório (RI)</th>
          <th className="p-2 text-left">Matrícula</th><th className="p-2 text-left">Processo/Vara</th>
          <th className="p-2 text-left">Data</th><th className="p-2 text-left">Status</th></tr></thead>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <tbody>{data.ordens.map((o: any, i: number) => (
          <tr key={i} className="border-t border-border">
            <td className="p-2 font-mono">{o.protocolo}</td>
            <td className="p-2">{o.cartorio}<div className="text-[10px] text-muted-foreground">{o.municipio}/{o.uf}</div></td>
            <td className="p-2 font-mono">{o.matricula}<div className="text-[10px] text-muted-foreground">CNM {o.cnm}</div></td>
            <td className="p-2 font-mono text-[11px]">{o.processo}<div className="text-[10px] text-muted-foreground">{o.tribunalOrigem} · {o.vara}</div></td>
            <td className="p-2">{o.dataInclusao}</td>
            <td className={`p-2 font-semibold ${o.status === "Ativa" ? "text-success" : "text-muted-foreground"}`}>{o.status}</td>
          </tr>
        ))}</tbody>
      </table>
    );
  }
  // prevjud
  return (
    <div className="text-xs space-y-3">
      <div className="border border-border rounded p-3">
        <div className="text-sm font-semibold mb-1">Dados previdenciários</div>
        <div>NIT/PIS: <span className="font-mono">{data.nit}</span> · Situação: <strong>{data.situacaoCad}</strong></div>
      </div>
      {data.beneficio && (
        <div className="border border-success/30 bg-success/5 rounded p-3">
          <div className="text-sm font-semibold mb-1">Benefício</div>
          <div>NB: <span className="font-mono">{data.beneficio.nb}</span> · Espécie: {data.beneficio.especie}</div>
          <div>{data.beneficio.nome} — <strong>{formatBRL(data.beneficio.valor)}</strong>/mês · Situação: {data.beneficio.situacao}</div>
          <div>DIB: {data.beneficio.dib} · DIP: {data.beneficio.dip} · Agência: {data.beneficio.agencia}</div>
        </div>
      )}
      <table className="w-full border border-border">
        <thead className="bg-muted/50"><tr>
          <th className="p-2 text-left">Empregador</th><th className="p-2 text-left">CNPJ</th>
          <th className="p-2 text-left">Tipo</th><th className="p-2 text-left">Início</th>
          <th className="p-2 text-left">Fim</th><th className="p-2 text-right">Salário</th></tr></thead>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <tbody>{data.cnis.map((c: any, i: number) => (
          <tr key={i} className="border-t border-border">
            <td className="p-2">{c.empregador}</td><td className="p-2 font-mono">{c.cnpj}</td>
            <td className="p-2">{c.tipoVinculo}</td>
            <td className="p-2">{c.inicio}</td>
            <td className={`p-2 ${!c.fim ? "text-success font-semibold" : ""}`}>{c.fim ?? "Ativo"}</td>
            <td className="p-2 text-right">{formatBRL(c.salario)}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border rounded p-2">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

// ============ Gerador de PDF rico ============

class PDFBuilder {
  doc: jsPDF; y = 15; W = 210; H = 297;
  constructor() { this.doc = new jsPDF({ unit: "mm", format: "a4" }); }
  ensure(mm = 10) { if (this.y + mm > this.H - 15) { this.doc.addPage(); this.y = 15; } }
  h1(text: string) { this.ensure(10); this.doc.setFont("helvetica", "bold"); this.doc.setFontSize(13); this.doc.text(text, this.W / 2, this.y, { align: "center" }); this.y += 7; }
  h2(text: string) { this.ensure(8); this.doc.setFont("helvetica", "bold"); this.doc.setFontSize(11); this.doc.text(text, 15, this.y); this.y += 5; this.doc.setDrawColor(180); this.doc.line(15, this.y - 1, this.W - 15, this.y - 1); this.y += 1; }
  h3(text: string) { this.ensure(7); this.doc.setFont("helvetica", "bold"); this.doc.setFontSize(10); this.doc.text(text, 15, this.y); this.y += 5; }
  p(text: string, opts?: { bold?: boolean }) {
    this.doc.setFont("helvetica", opts?.bold ? "bold" : "normal"); this.doc.setFontSize(9);
    const lines = this.doc.splitTextToSize(text, this.W - 30);
    lines.forEach((l: string) => { this.ensure(5); this.doc.text(l, 15, this.y); this.y += 4.5; });
  }
  kv(label: string, value: string) {
    this.doc.setFont("helvetica", "bold"); this.doc.setFontSize(9);
    this.ensure(5); this.doc.text(label + ":", 15, this.y);
    this.doc.setFont("helvetica", "normal");
    const lw = this.doc.getTextWidth(label + ": ");
    const lines = this.doc.splitTextToSize(value, this.W - 30 - lw);
    lines.forEach((l: string, i: number) => {
      if (i === 0) this.doc.text(l, 15 + lw, this.y);
      else { this.y += 4.5; this.ensure(5); this.doc.text(l, 15 + lw, this.y); }
    });
    this.y += 4.5;
  }
  spacer(mm = 3) { this.y += mm; }
  hr() { this.ensure(3); this.doc.setDrawColor(200); this.doc.line(15, this.y, this.W - 15, this.y); this.y += 3; }
  footer(sistema: string, autent: string) {
    const pages = this.doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      this.doc.setPage(i);
      this.doc.setFont("helvetica", "italic"); this.doc.setFontSize(7); this.doc.setTextColor(120);
      const foot = `${sistema} · Emitido em ${new Date().toLocaleString("pt-BR")} · Autenticação: ${autent} · Documento de uso restrito ao Poder Judiciário — página ${i}/${pages}`;
      this.doc.text(foot, this.W / 2, this.H - 8, { align: "center" });
      this.doc.setTextColor(0);
    }
  }
}

function cabecalho(pb: PDFBuilder, sistema: string, proc: ProcessoLite, magistrado: string, extra?: { requisicao?: string; tipoOrdem?: string }) {
  pb.h1("PODER JUDICIÁRIO");
  pb.doc.setFont("helvetica", "normal"); pb.doc.setFontSize(10);
  pb.doc.text(`SISTEMA ${sistema} — RELATÓRIO DE CONSULTA`, pb.W / 2, pb.y, { align: "center" }); pb.y += 6;
  pb.hr();
  pb.kv("Tribunal", "TJRJ — Tribunal de Justiça do Estado do Rio de Janeiro");
  pb.kv("Vara / Unidade Judiciária", proc.orgao_julgador ?? proc.vara ?? "—");
  pb.kv("Comarca", proc.comarca ?? "—");
  pb.kv("Número do processo", formatCNJ(proc.numero));
  if (extra?.requisicao) pb.kv("Nº da requisição", extra.requisicao);
  if (extra?.tipoOrdem) pb.kv("Tipo da ordem", extra.tipoOrdem);
  pb.kv("Data/hora da emissão", new Date().toLocaleString("pt-BR"));
  pb.kv("Magistrado responsável", magistrado);
  pb.spacer();
}

function dadosDoPesquisado(pb: PDFBuilder, parte: ParteLite) {
  pb.h2("Dados do pesquisado");
  pb.kv("Nome / Razão social", parte.nome);
  pb.kv("CPF / CNPJ", parte.documento ?? "—");
  const tipoP = (parte.documento ?? "").replace(/\D/g, "").length > 11 ? "Pessoa Jurídica" : "Pessoa Física";
  pb.kv("Tipo de pessoa", tipoP);
  pb.spacer();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function gerarPDF(sistema: SistemaKey, label: string, proc: ProcessoLite, parte: ParteLite, data: any, magistrado: string, _role: string): Blob {
  const pb = new PDFBuilder();
  const autent = `${label}-${Date.now().toString(36).toUpperCase()}`;

  if (sistema === "sisbajud") {
    cabecalho(pb, label, proc, magistrado, { requisicao: `Ordem SISBAJUD nº ${data.ordem}`, tipoOrdem: "Bloqueio de ativos financeiros" });
    dadosDoPesquisado(pb, parte);
    pb.h2("Dados da ordem");
    pb.kv("Valor solicitado", formatBRL(data.solicitado));
    pb.kv("Data da ordem", data.dataOrdem);
    pb.kv("Situação da ordem", data.situacao);
    pb.kv("Total bloqueado", formatBRL(data.totalBloq));
    pb.spacer();
    pb.h2("Respostas das instituições financeiras");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data.respostas.forEach((r: any) => {
      pb.h3(r.banco);
      pb.kv("ISPB / COMPE", `${r.ispb} / ${r.compe}`);
      pb.kv("Agência / Conta", `${r.agencia} / ${r.conta} (${r.tipo})`);
      pb.kv("Código da resposta", `${r.codResposta} — ${r.resposta}`);
      if (r.bloqueado > 0) {
        pb.kv("Valor bloqueado", formatBRL(r.bloqueado));
        if (r.contaSalario > 0) pb.kv("Bloqueado em conta-salário", formatBRL(r.contaSalario));
        pb.kv("Remanescente bloqueado", formatBRL(r.remanescente));
        pb.kv("Valor a transferir", formatBRL(r.remanescente));
        pb.kv("Data-limite p/ transferência", new Date(Date.now() + 5 * 86400000).toLocaleDateString("pt-BR"));
      } else {
        pb.p(`Sem bloqueio: ${r.resposta}.`);
      }
      pb.spacer(2);
    });
  }

  else if (sistema === "renajud") {
    cabecalho(pb, label, proc, magistrado, { requisicao: data.requisicao });
    dadosDoPesquisado(pb, parte);
    pb.h2("Veículos localizados");
    if (data.veiculos.length === 0) {
      pb.p(`Não foram localizados veículos cadastrados para o CPF/CNPJ ${parte.documento ?? "—"} na data de ${new Date().toLocaleDateString("pt-BR")}.`);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data.veiculos.forEach((v: any) => {
        pb.h3(`${v.marca} ${v.modelo} (${v.versao})`);
        pb.kv("Placa / Renavam", `${v.placa} / ${v.renavam}`);
        pb.kv("Chassi", v.chassi);
        pb.kv("Ano fab / modelo", `${v.anoFab} / ${v.anoMod}`);
        pb.kv("Cor predominante", v.cor);
        pb.kv("Categoria / Espécie / Tipo", `${v.categoria} / ${v.especie} / ${v.tipo}`);
        pb.kv("Município / UF de registro", `${v.municipio} / ${v.uf}`);
        pb.kv("Situação do licenciamento", v.licenciamento);
        pb.kv("Situação do veículo", v.situacao);
        pb.kv("Restrições", v.restricoes.length === 0 ? "Nenhuma" : v.restricoes.join("; "));
        pb.spacer(2);
      });
    }
  }

  else if (sistema === "infojud") {
    cabecalho(pb, label, proc, magistrado, { requisicao: data.requisicao, tipoOrdem: "Dados Cadastrais + Declaração de IRPF" });
    dadosDoPesquisado(pb, parte);
    pb.h2("1. Dados cadastrais (Receita Federal)");
    const c = data.cadastro;
    pb.kv("Situação cadastral", c.situacao);
    pb.kv("Data de inscrição no CPF", c.dataInscricao);
    pb.kv("Data de nascimento", c.nascimento);
    pb.kv("Nome da mãe", c.mae);
    pb.kv("Endereço", `${c.endereco} — CEP ${c.cep} — ${c.municipio}/${c.uf}`);
    pb.kv("E-mail", c.email);
    pb.kv("Telefone", c.telefone);
    pb.spacer();
    const d = data.dirpf;
    pb.h2(`2. Declaração de IRPF — exercício ${d.exercicio} (ano-calendário ${d.anoCalendario})`);
    pb.kv("Tipo da declaração", d.tipo);
    pb.kv("Número do recibo", d.recibo);
    pb.kv("Data de entrega", d.dataEntrega);
    pb.kv("Rendimentos tributáveis", formatBRL(d.rendTributaveis));
    pb.kv("Rendimentos isentos e não tributáveis", formatBRL(d.rendIsentos));
    pb.kv("Rendimentos sujeitos à tributação exclusiva", formatBRL(d.rendExclusivos));
    pb.kv("Dependentes", String(d.dependentes));
    pb.kv("Pagamentos efetuados", formatBRL(d.pagamentos));
    pb.kv("Imposto devido", formatBRL(d.impostoDevido));
    pb.kv("Imposto pago", formatBRL(d.impostoPago));
    pb.spacer();
    pb.h2("3. Bens e direitos declarados");
    pb.h3("Imóveis");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (d.imoveis.length === 0) pb.p("Nenhum."); else d.imoveis.forEach((im: any) => pb.p(`• ${im.tipo} — ${im.endereco} — ${formatBRL(im.valor)}`));
    pb.h3("Veículos declarados");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (d.veiculos.length === 0) pb.p("Nenhum."); else d.veiculos.forEach((v: any) => pb.p(`• ${v.descricao} — ${formatBRL(v.valor)}`));
    pb.h3("Contas bancárias declaradas");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    d.contasDecl.forEach((cc: any) => pb.p(`• ${cc.banco} — saldo declarado ${formatBRL(cc.saldo)}`));
    pb.h3("Quotas / Participações societárias");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (d.quotas.length === 0) pb.p("Nenhuma."); else d.quotas.forEach((q: any) => pb.p(`• ${q.empresa} — CNPJ ${q.cnpj} — ${q.participacao}`));
    pb.spacer();
    pb.h2("Aviso de sigilo fiscal");
    pb.p("Os dados constantes deste relatório são protegidos por sigilo fiscal (Lei nº 5.172/1966, art. 198) e são de uso restrito ao Poder Judiciário e às partes autorizadas por decisão judicial.");
  }

  else if (sistema === "ccs") {
    cabecalho(pb, label, proc, magistrado, { requisicao: data.requisicao });
    dadosDoPesquisado(pb, parte);
    pb.h2("Instituições financeiras localizadas");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data.vinculos.forEach((v: any) => {
      pb.h3(v.banco);
      pb.kv("Código ISPB / COMPE", `${v.ispb} / ${v.compe}`);
      pb.kv("Tipo de relacionamento", v.relacionamento);
      pb.kv("Papel na conta", v.papel);
      pb.kv("Início do relacionamento", v.inicio);
      pb.kv("Fim do relacionamento", v.fim ?? "—");
      pb.kv("Situação", v.situacao);
      pb.spacer(2);
    });
    pb.spacer();
    pb.p("Aviso: os dados possuem uso restrito ao Poder Judiciário — Cadastro de Clientes do Sistema Financeiro Nacional (Banco Central do Brasil).");
  }

  else if (sistema === "sniper") {
    cabecalho(pb, label, proc, magistrado, { requisicao: data.requisicao });
    dadosDoPesquisado(pb, parte);
    pb.h2("Participações societárias");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data.empresas.forEach((e: any) => {
      pb.h3(e.nome);
      pb.kv("CNPJ", e.cnpj);
      pb.kv("Cargo", e.cargo);
      pb.kv("Participação", e.participacao);
      pb.kv("Situação da empresa", e.situacao);
      pb.spacer(2);
    });
    pb.h2("Relacionamentos identificados");
    pb.h3("Sócios / Pessoas relacionadas");
    data.socios.forEach((s: string) => pb.p(`• ${s}`));
    pb.h3("Parentes");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data.parentes.forEach((p: any) => pb.p(`• ${p.nome} — ${p.grau}`));
    pb.h2("Patrimônio consolidado");
    pb.kv("Veículos", String(data.patrimonio.veiculos));
    pb.kv("Imóveis", String(data.patrimonio.imoveis));
    pb.kv("Embarcações", String(data.patrimonio.embarcacoes));
    pb.kv("Aeronaves", String(data.patrimonio.aeronaves));
    pb.spacer();
    pb.h2("Bases consultadas");
    data.bases.forEach((b: string) => pb.p(`• ${b}`));
    pb.spacer();
    pb.p("Os dados são destinados exclusivamente ao Poder Judiciário e possuem acesso restrito.");
  }

  else if (sistema === "cnib") {
    cabecalho(pb, label, proc, magistrado, { requisicao: data.requisicao, tipoOrdem: "Consulta / Indisponibilidade" });
    dadosDoPesquisado(pb, parte);
    pb.h2("Resultado da consulta CNIB");
    if (data.ordens.length === 0) {
      pb.p(`Não foram localizadas ordens de indisponibilidade de bens em nome do pesquisado (${parte.nome}) na data de ${new Date().toLocaleDateString("pt-BR")}.`);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data.ordens.forEach((o: any) => {
        pb.h3(`Ordem ${o.protocolo}`);
        pb.kv("Situação", o.status);
        pb.kv("Cartório de Registro de Imóveis", `${o.cartorio} — ${o.municipio}/${o.uf}`);
        pb.kv("Matrícula", o.matricula);
        pb.kv("Código Nacional de Matrícula (CNM)", o.cnm);
        pb.kv("Tribunal de origem", o.tribunalOrigem);
        pb.kv("Vara responsável", o.vara);
        pb.kv("Processo vinculado", o.processo);
        pb.kv("Data da inclusão", o.dataInclusao);
        pb.spacer(2);
      });
    }
    pb.spacer();
    pb.p("Aviso: os dados possuem uso restrito ao Poder Judiciário e aos órgãos autorizados — Central Nacional de Indisponibilidade de Bens (CNIB).");
  }

  else if (sistema === "prevjud") {
    cabecalho(pb, label, proc, magistrado, { requisicao: data.requisicao, tipoOrdem: "Consulta Previdenciária — CNIS + Benefícios" });
    dadosDoPesquisado(pb, parte);
    pb.h2("Dados previdenciários");
    pb.kv("NIT / PIS / PASEP", data.nit);
    pb.kv("Situação cadastral", data.situacaoCad);
    pb.spacer();
    pb.h2("Benefícios previdenciários / assistenciais");
    if (data.beneficio) {
      pb.kv("Número do benefício (NB)", data.beneficio.nb);
      pb.kv("Espécie", data.beneficio.especie);
      pb.kv("Nome do benefício", data.beneficio.nome);
      pb.kv("Situação", data.beneficio.situacao);
      pb.kv("DIB — Data de início do benefício", data.beneficio.dib);
      pb.kv("DIP — Data de início do pagamento", data.beneficio.dip);
      pb.kv("Agência mantenedora", data.beneficio.agencia);
      pb.kv("Valor mensal", formatBRL(data.beneficio.valor));
    } else {
      pb.p("Não foram localizados benefícios previdenciários ativos.");
    }
    pb.spacer();
    pb.h2("Vínculos previdenciários (CNIS)");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data.cnis.forEach((c: any) => {
      pb.h3(c.empregador);
      pb.kv("CNPJ", c.cnpj);
      pb.kv("Tipo de vínculo", c.tipoVinculo);
      pb.kv("Data de admissão", c.inicio);
      pb.kv("Data de desligamento", c.fim ?? "Vínculo ativo");
      pb.kv("Situação", c.situacao);
      pb.kv("Último salário de contribuição", formatBRL(c.salario));
      pb.spacer(2);
    });
    pb.spacer();
    pb.p("Os dados possuem caráter sigiloso e são destinados exclusivamente ao Poder Judiciário.");
  }

  pb.footer(label, autent);
  return pb.doc.output("blob");
}
