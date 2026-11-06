import { Provider } from '@angular/core';
import { SUPABASE } from '../core/supabase/supabase.client';

/** Una llamada encadenada al query builder, p. ej. `.eq('sucursal', 'MEDILENT')`. */
export interface RecordedCall {
  method: string;
  args: unknown[];
}

/** Lo que la "red" responde: igual que el `{ data, error, count }` de supabase-js. */
export interface FakeResult {
  data?: unknown;
  error?: { message?: string; code?: string; status?: number } | null;
  count?: number | null;
}

/** Una consulta ya hecha: a qué tabla (o RPC) fue y qué métodos se le encadenaron. */
export interface RecordedQuery {
  table: string;
  calls: RecordedCall[];
  /** Todas las llamadas de ese método, en orden. */
  of(method: string): unknown[][];
  /** Argumentos de la primera llamada de ese método (o `undefined`). */
  first(method: string): unknown[] | undefined;
}

/**
 * Cliente de Supabase falso para probar los repositorios de `core/data/` (= un mock de mocktail
 * del `SupabaseClient`, pero sin escribir un mock por método).
 *
 * El query builder real es encadenable (`.from().select().eq().order()`) y se "espera" con `await`
 * al final. Acá cualquier método encadenado se anota y devuelve el mismo objeto, y al esperarlo
 * responde el siguiente resultado de la cola. Así cada test dice qué responde la base
 * (`fake.enqueue({ data: [...] })`) y después revisa qué se le pidió (`fake.queries[0].first('eq')`).
 *
 * Las respuestas se consumen en el ORDEN en que el repositorio llama `from()`/`rpc()`.
 * No prueba SQL ni RLS (eso se prueba contra la base real), solo que el repositorio pida y
 * mapee lo correcto.
 */
export class FakeSupabase {
  readonly queries: RecordedQuery[] = [];
  private readonly results: FakeResult[] = [];

  /** Encola la respuesta de la próxima consulta. */
  enqueue(result: FakeResult): this {
    this.results.push(result);
    return this;
  }

  from(table: string): unknown {
    return this.start(table);
  }

  rpc(fn: string, args?: unknown): unknown {
    const query = this.start(`rpc:${fn}`) as { calls: RecordedCall[] };
    query.calls.push({ method: 'rpc', args: [args] });
    return query;
  }

  /** Para proveer en TestBed: `providers: [fake.provider()]`. */
  provider(): Provider {
    return { provide: SUPABASE, useValue: this };
  }

  private start(table: string): unknown {
    const result = this.results.shift() ?? { data: null, error: null, count: null };
    const calls: RecordedCall[] = [];

    const recorded: RecordedQuery = {
      table,
      calls,
      of: (method) => calls.filter((c) => c.method === method).map((c) => c.args),
      first: (method) => calls.find((c) => c.method === method)?.args,
    };
    this.queries.push(recorded);

    const proxy: unknown = new Proxy(recorded, {
      get: (target, prop) => {
        if (prop === 'then') {
          const response = { data: null, error: null, count: null, ...result };
          return (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
            Promise.resolve(response).then(resolve, reject);
        }
        if (prop in target) return target[prop as keyof RecordedQuery];
        return (...args: unknown[]) => {
          calls.push({ method: String(prop), args });
          return proxy;
        };
      },
    });
    return proxy;
  }
}
