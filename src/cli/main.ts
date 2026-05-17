import { Usuario } from "../domain/Usuario.js";
import {
  DecoratorLimpeza,
  DecoratorMultimidia,
  ReservaBaseExtras,
} from "../patterns/decorator/ReservaExtras.js";
import { SalaFactory } from "../patterns/factory/SalaFactory.js";
import { CacheRelatorioObservador } from "../patterns/observer/CacheRelatorioObservador.js";
import { CentroEventosReserva } from "../patterns/observer/CentroEventosReserva.js";
import { NotificacaoConsoleObservador } from "../patterns/observer/NotificacaoConsoleObservador.js";
import { ConfiguracaoApp } from "../patterns/singleton/ConfiguracaoApp.js";
import { RepositorioCampus } from "../patterns/singleton/RepositorioCampus.js";
import {
  PoliticaPrimeiroAReservar,
  PoliticaPrioridadeDocente,
} from "../patterns/strategy/PoliticaDeReserva.js";
import { ServicoReservas } from "../services/ServicoReservas.js";
import {
  HistoricoReservasProxy,
  HistoricoReservasReal,
} from "../patterns/proxy/HistoricoReservasProxy.js";

function amanha(h: number, m: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(h, m, 0, 0);
  return d;
}

function fmt(d: Date): string {
  const p = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

async function bootstrap() {
  RepositorioCampus.resetForTests();
  const cfg = ConfiguracaoApp.configurar({
    nomeCampus: "Campus Demo POO",
  });
  console.log("Campus:", cfg.nomeCampus);

  const repo = RepositorioCampus.getInstance();
  
  const historicoReal = new HistoricoReservasReal(repo);
  const historicoProxy = new HistoricoReservasProxy(historicoReal);

  const factory = new SalaFactory();

  const s1 = factory.criar("INDIVIDUAL", "S1", "Cubículo A", 1);
  const s2 = factory.criar("GRUPO", "S2", "Sala Grupo 2", 6);
  const s3 = factory.criar("LABORATORIO", "S3", "Lab Informática", 25);
  repo.salvarSala(s1);
  repo.salvarSala(s2);
  repo.salvarSala(s3);

  const estudante = new Usuario("U1", "Ana Estudante", "ESTUDANTE");
  const docente = new Usuario("U2", "Bruno Docente", "DOCENTE");
  repo.salvarUsuario(estudante);
  repo.salvarUsuario(docente);

  const centro = new CentroEventosReserva(repo);
  centro.anexar(new NotificacaoConsoleObservador());
  const cacheRel = new CacheRelatorioObservador();
  centro.anexar(cacheRel);

  const servico = new ServicoReservas(
    repo,
    centro,
    new PoliticaPrimeiroAReservar()
  );

  const t0 = amanha(9, 0);
  const t1 = amanha(11, 0);
  const t2 = amanha(10, 0);
  const t3 = amanha(12, 0);

  console.log("\n--- RF-01: salas livres 09h–11h (amanhã) ---");
  const livres = servico.salasDisponiveisNoIntervalo(t0, t1);
  for (const s of livres) {
    console.log(`- ${s.id} ${s.nome} (${s.descricaoTipo()})`);
  }

  console.log("\n--- RF-02: criar reserva estudante S2 ---");
  const r1 = await servico.criarReserva("S2", estudante.id, t0, t1);
  console.log("Criada:", r1.id, fmt(r1.inicio), "→", fmt(r1.fim));

  console.log("\n--- RF-03: colisão (primeiro a reservar) ---");
  try {
    await servico.criarReserva("S2", docente.id, t2, t3);
  } catch (e) {
    console.log("Esperado:", e instanceof Error ? e.message : e);
  }

  console.log("\n--- Strategy: trocar para prioridade docente e repetir ---");
  servico.definirPolitica(new PoliticaPrioridadeDocente());
  const r2 = await servico.criarReserva("S2", docente.id, t2, t3);
  console.log("Reserva docente:", r2.id, "(estudante foi notificado cancelamento)");

  console.log("\n--- RF-02: alterar horário do docente ---");
  const t1b = amanha(13, 0);
  const t2b = amanha(15, 0);
  const r2alt = await servico.alterarReserva(r2.id, docente.id, {
    inicio: t1b,
    fim: t2b,
  });
  console.log("Alterada:", r2alt.id, fmt(r2alt.inicio), "→", fmt(r2alt.fim));

  console.log("\n--- Decorator (bônus): extras na reserva ---");
  const view = new DecoratorLimpeza(
    new DecoratorMultimidia(new ReservaBaseExtras(r2alt))
  );
  console.log("Extras:", view.extras().join(", "));

  console.log("\n--- RF-05: relatório diário (amanhã) ---");
  const dia = amanha(0, 0);
  const rel = servico.relatorioDiarioPorSala(dia);
  for (const [sid, lista] of rel) {
    if (lista.length === 0) continue;
    const sala = repo.obterSala(sid);
    console.log(`Sala ${sid} ${sala?.nome ?? ""}:`);
    for (const r of lista) {
      const u = repo.obterUsuario(r.usuarioId);
      console.log(
        `  ${r.id} ${fmt(r.inicio)}–${fmt(r.fim)} ${u?.nome ?? r.usuarioId}`
      );
    }
  }

  console.log("\n--- Pull cache observador ---");
  console.log("Confirmadas em cache:", cacheRel.ultimasConfirmadas.length);

  console.log("\n--- Cancelar ---");
  await servico.cancelarReserva(r2alt.id, docente.id);
  console.log("Cancelada pelo titular.");

  console.log("\n--- Funcionalidade adicional: histórico do usuário ---");
  const historico = historicoProxy.obterHistoricoUsuario(estudante.id);
  for (const r of historico) {
    console.log(
      `Reserva ${r.id} | Sala ${r.salaId} | ${r.status} | ${fmt(r.inicio)} → ${fmt(r.fim)}`
    );
  }
  console.log("\n--- Consulta novamente (cache do Proxy) ---");
  historicoProxy.obterHistoricoUsuario(estudante.id);
}

bootstrap().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});