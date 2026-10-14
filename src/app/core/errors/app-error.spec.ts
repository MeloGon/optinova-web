import { toAppError } from './app-error';

describe('toAppError', () => {
  it('sin conexión → network', () => {
    expect(toAppError(new TypeError('Failed to fetch')).kind).toBe('network');
  });

  it('.single() sin filas → notFound', () => {
    expect(toAppError({ code: 'PGRST116', message: 'no rows' }).kind).toBe('notFound');
  });

  it('RLS o sesión vencida → unauthorized', () => {
    expect(toAppError({ code: '42501', message: 'denied' }).kind).toBe('unauthorized');
    expect(toAppError({ status: 401, message: 'jwt expired' }).kind).toBe('unauthorized');
  });

  it('otro error de Supabase → server, conserva el mensaje', () => {
    expect(toAppError({ code: '23505', message: 'duplicate key' })).toEqual({
      kind: 'server',
      message: 'duplicate key',
    });
  });

  it('cualquier otra cosa → unknown', () => {
    expect(toAppError('boom').kind).toBe('unknown');
    expect(toAppError(null).kind).toBe('unknown');
  });
});
