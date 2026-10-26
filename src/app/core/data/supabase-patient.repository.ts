import { Injectable, inject } from '@angular/core';
import { AppError, appError, toAppError } from '../errors/app-error';
import { Page } from '../models/page';
import { Patient } from '../models/patient';
import { PatientRepository, PatientSearch } from '../repositories/patient.repository';
import { Result, err, ok } from '../result';
import { SUPABASE } from '../supabase/supabase.client';

/** Fila de `pacientes` tal como viene de la DB (nombres heredados de Excel, con espacios). */
interface PatientRow {
  /** Alias de `"ID PACIENTE"::text` (ver COLUMNS). */
  id: string;
  'NOMBRE COMPLETO': string | null;
  SUCURSAL: string | null;
  'TELEFONO CEL': string | null;
  GENERO: string | null;
  OBSERVACIONES: string | null;
  fecha_registro: string;
  fecha_nacimiento: string | null;
}

// El ID se pide como texto: un bigint grande llegaría como número JSON y perdería dígitos.
const COLUMNS =
  'id:"ID PACIENTE"::text, "NOMBRE COMPLETO", "SUCURSAL", "TELEFONO CEL", "GENERO", "OBSERVACIONES", fecha_registro, fecha_nacimiento';

@Injectable()
export class SupabasePatientRepository extends PatientRepository {
  private readonly supabase = inject(SUPABASE);

  async search({ query, page, pageSize }: PatientSearch): Promise<Result<Page<Patient>, AppError>> {
    const from = (page - 1) * pageSize;

    let request = this.supabase.from('pacientes').select(COLUMNS, { count: 'exact' });
    // Cada palabra debe aparecer en el nombre, en cualquier orden: "garcia juan" encuentra "JUAN GARCIA".
    for (const word of query.split(/\s+/).filter(Boolean)) {
      request = request.ilike('NOMBRE COMPLETO', `%${escapeLike(word)}%`);
    }

    const { data, count, error } = await request
      .order('fecha_registro', { ascending: false })
      // Desempate estable: sin él, dos pacientes del mismo día podrían saltar entre páginas.
      .order('ID PACIENTE', { ascending: false })
      .range(from, from + pageSize - 1)
      .overrideTypes<PatientRow[], { merge: false }>();

    if (error) return err(toAppError(error));
    return ok({ items: data.map(toPatient), total: count ?? 0 });
  }

  async update(patient: Patient): Promise<Result<void, AppError>> {
    const { data, error } = await this.supabase
      .from('pacientes')
      .update({
        'NOMBRE COMPLETO': patient.name,
        'TELEFONO CEL': patient.phone,
        // La DB solo acepta Masculino/Femenino/Otro o NULL (migración #4): "" se guarda como NULL.
        GENERO: patient.gender || null,
        fecha_nacimiento: patient.birthDate,
        SUCURSAL: patient.branch,
        OBSERVACIONES: patient.observations,
      })
      .eq('ID PACIENTE', patient.id)
      .select('"ID PACIENTE"');

    if (error) return err(toAppError(error));
    if (data.length === 0) return err(appError('notFound', 'El paciente ya no existe o no tienes permiso para editarlo.'));
    return ok(undefined);
  }

  async delete(id: string): Promise<Result<void, AppError>> {
    // .select() devuelve las filas borradas: si RLS impide borrar no hay error, solo 0 filas.
    const { data, error } = await this.supabase
      .from('pacientes')
      .delete()
      .eq('ID PACIENTE', id)
      .select('"ID PACIENTE"');

    if (error) return err(toAppError(error));
    if (data.length === 0) return err(appError('notFound', 'El paciente ya no existe o no tienes permiso para eliminarlo.'));
    return ok(undefined);
  }
}

/**
 * `%` y `_` son comodines de `ilike`: se escriben literales.
 * La barra va doble porque PostgREST quita una al leer el filtro (probado contra DEV).
 */
function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, '\\\\$&');
}

function toPatient(row: PatientRow): Patient {
  return {
    id: row.id,
    name: row['NOMBRE COMPLETO'] ?? '',
    branch: row.SUCURSAL ?? '',
    phone: row['TELEFONO CEL'] ?? '',
    gender: row.GENERO ?? '',
    observations: row.OBSERVACIONES ?? '',
    registeredOn: row.fecha_registro,
    birthDate: row.fecha_nacimiento,
  };
}
