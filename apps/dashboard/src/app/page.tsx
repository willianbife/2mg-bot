import { Activity, Bot, ShieldAlert, Ticket, Users, Volume2 } from "lucide-react";
import { prisma } from "@neon/database";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";

export const dynamic = "force-dynamic";

async function getStats() {
  const [tickets, punishments, blacklists, audits, voiceStats] = await Promise.all([
    prisma.ticket.count().catch(() => 0),
    prisma.punishment.count().catch(() => 0),
    prisma.blacklist.count().catch(() => 0),
    prisma.audit.count().catch(() => 0),
    prisma.voiceStat.aggregate({ _sum: { weeklySeconds: true } }).catch(() => ({ _sum: { weeklySeconds: 0 } }))
  ]);

  return {
    tickets,
    punishments,
    blacklists,
    audits,
    weeklyHours: Math.floor((voiceStats._sum.weeklySeconds ?? 0) / 3600)
  };
}

export default async function DashboardPage() {
  const stats = await getStats();

  return (
    <main className="min-h-screen">
      <div className="mx-auto flex w-full max-w-7xl gap-6 px-5 py-6">
        <aside className="hidden w-64 shrink-0 rounded-lg border border-white/10 bg-black/35 p-4 backdrop-blur-xl lg:block">
          <div className="mb-8 flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-neon-pink text-black">
              <Bot size={22} />
            </span>
            <div>
              <strong className="block">Neon Suite</strong>
              <span className="text-xs text-zinc-500">Community Ops</span>
            </div>
          </div>
          {["Overview", "Tickets", "Embeds", "Permissoes", "Blacklist", "Auditoria", "Configuracoes"].map((item) => (
            <a key={item} className="mb-1 block rounded-md px-3 py-2 text-sm text-zinc-300 transition hover:bg-neon-pink/10 hover:text-white">
              {item}
            </a>
          ))}
        </aside>

        <section className="flex-1">
          <header className="mb-6 flex flex-col justify-between gap-4 rounded-lg border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl md:flex-row md:items-center">
            <div>
              <p className="text-sm uppercase tracking-[0.22em] text-neon-pink">Painel administrativo</p>
              <h1 className="mt-2 text-3xl font-semibold text-white md:text-4xl">Operacao da comunidade</h1>
              <p className="mt-2 max-w-2xl text-sm text-zinc-400">
                Controle centralizado dos bots, tickets, permissoes, auditoria, voice goals e seguranca.
              </p>
            </div>
            <div className="flex gap-3">
              <Button>Login Discord</Button>
              <Button className="bg-neon-pink text-black hover:bg-neon-pink/90">Publicar painel</Button>
            </div>
          </header>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <StatCard icon={Ticket} label="Tickets" value={String(stats.tickets)} detail="Atendimentos criados" />
            <StatCard icon={ShieldAlert} label="Blacklists" value={String(stats.blacklists)} detail="Registros ativos e historicos" />
            <StatCard icon={Activity} label="Auditoria" value={String(stats.audits)} detail="Eventos administrativos" />
            <StatCard icon={Volume2} label="Call semanal" value={`${stats.weeklyHours}h`} detail="Tempo agregado" />
            <StatCard icon={Users} label="Punicoes" value={String(stats.punishments)} detail="Acoes moderativas" />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <Card className="p-5">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Fluxo operacional</h2>
                <span className="rounded-md border border-neon-cyan/30 px-2 py-1 text-xs text-neon-cyan">live-ready</span>
              </div>
              <div className="space-y-3">
                {[
                  ["Moderacao", "Groles, role history, metas em call, logs por categoria."],
                  ["Tickets", "Suporte, devolucao, transferencia, migracao e ingresso."],
                  ["Seguranca", "Anti spam, raid guard, blacklist global/local e auditoria."]
                ].map(([title, text]) => (
                  <div key={title} className="rounded-md border border-white/10 bg-black/25 p-4 transition hover:border-neon-pink/40">
                    <strong className="text-white">{title}</strong>
                    <p className="mt-1 text-sm text-zinc-400">{text}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <h2 className="text-lg font-semibold">Editor visual</h2>
              <p className="mt-2 text-sm text-zinc-400">Embeds com tema preto e rosa neon, componentes editaveis e consistencia visual.</p>
              <div className="mt-5 rounded-lg border border-neon-pink/30 bg-[#0d0710] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-neon-pink">preview</p>
                <h3 className="mt-3 text-xl font-semibold">✦ Painel Suporte</h3>
                <p className="mt-2 text-sm text-zinc-400">Escolha uma categoria para abrir um ticket privado com transcript e avaliacao.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {["Suporte", "Denuncia", "Migracao"].map((label) => (
                    <span key={label} className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-white">
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}
