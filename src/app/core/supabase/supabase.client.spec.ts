import { TestBed } from '@angular/core/testing';
import { SUPABASE } from './supabase.client';

describe('SUPABASE', () => {
  it('entrega siempre la misma instancia del cliente', () => {
    const a = TestBed.inject(SUPABASE);
    const b = TestBed.inject(SUPABASE);
    expect(a).toBe(b);
    expect(typeof a.from).toBe('function');
  });
});
