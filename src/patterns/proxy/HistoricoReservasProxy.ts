import type { Reserva } from "../../domain/Reserva.js";
import { RepositorioCampus } from "../singleton/RepositorioCampus.js";

export interface HistoricoReservas {
  obterHistoricoUsuario(usuarioId: string): Reserva[];
}

export class HistoricoReservasReal implements HistoricoReservas {
  constructor(private readonly repo: RepositorioCampus) {}

  obterHistoricoUsuario(usuarioId: string): Reserva[] {
    return this.repo
      .listarTodasReservas()
      .filter((r) => r.usuarioId === usuarioId)
      .sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
  }
}

export class HistoricoReservasProxy implements HistoricoReservas {
  private cache = new Map<string, Reserva[]>();

  constructor(private readonly real: HistoricoReservasReal) {}

  obterHistoricoUsuario(usuarioId: string): Reserva[] {
    const emCache = this.cache.get(usuarioId);

    if (emCache) {
      console.log("[Proxy] Histórico obtido do cache.");
      return emCache;
    }

    console.log("[Proxy] Consultando histórico no repositório.");

    const historico = this.real.obterHistoricoUsuario(usuarioId);

    this.cache.set(usuarioId, historico);

    return historico;
  }

  limparCache(usuarioId?: string): void {
    if (usuarioId) {
      this.cache.delete(usuarioId);
      return;
    }

    this.cache.clear();
  }
}