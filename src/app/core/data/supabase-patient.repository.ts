import { Injectable, inject } from '@angular/core';
import { AppError, appError, toAppError } from '../errors/app-error';
import { Page } from '../models/page';
import { Patient } from '../models/patient';
import { NewPatient, PatientRepository, PatientSearch } from '../repositories/patient.repository';
import { Result, err, ok } from '../result';
import { SUPABASE } from '../supabase/supabase.client';

/** Fila de `pacientes` tal como viene de la DB. */
interface PatientRow {
  /** `id::text` (ver COLUMNS). */
  id: string;
  nombre: string | null;
  sucursal: string | null;
  telefono: string | null;
  telefono_secundario: string | null;
  genero: string | null;
  observaciones: string | null;
  fecha_registro: string;
  fecha_nacimiento: string | null;
}

// El ID se pide como texto: un bigint grande llegaría como número JSON y perdería dígitos.
const COLUMNS =
  'id::text, nombre, sucursal, telefono, telefono_secundario, genero, observaciones, fecha_registro, fecha_nacimiento';

/** Lo que el usuario puede cambiar de un paciente (las mismas columnas al crear y al editar). */
function toColumns(patient: NewPatient) {
  return {
    nombre: patient.name,
    sucursal: patient.branch,
    telefono: patient.phone,
    telefono_secundario: patient.secondaryPhone,
    // La DB solo acepta Masculino/Femenino/Otro o NULL (migración #4): "" se guarda como NULL.
    genero: patient.gender || null,
    observaciones: patient.observations,
    fecha_nacimiento: patient.birthDate,
  };
}

@Injectable()
export class SupabasePatientRepository extends PatientRepository {
  private readonly supabase = inject(SUPABASE);

  async search({ query, page, pageSize }: PatientSearch): Promise<Result<Page<Patient>, AppError>> {
    const from = (page - 1) * pageSize;

    let request = this.supabase.from('pacientes').select(COLUMNS, { count: 'exact' });
    // Cada palabra debe aparecer en el nombre, en cualquier orden: "garcia juan" encuentra "JUAN GARCIA".
    for (const word of query.split(/\s+/).filter(Boolean)) {
      request = request.ilike('nombre', `%${escapeLike(word)}%`);
    }

    const { data, count, error } = await request
      .order('fecha_registro', { ascending: false })
      // Desempate estable: sin él, dos pacientes del mismo día podrían saltar entre páginas.
      .order('id', { ascending: false })
      .range(from, from + pageSize - 1)
      .overrideTypes<PatientRow[], { merge: false }>();

    if (error) return err(toAppError(error));
    return ok({ items: data.map(toPatient), total: count ?? 0 });
  }

  async create(patient: NewPatient): Promise<Result<Patient, AppError>> {
    // Sin id ni fecha_registro: la secuencia y el valor por defecto de la DB los asignan.
    const { data, error } = await this.supabase
      .from('pacientes')
      .insert(toColumns(patient))
      .select(COLUMNS)
      .single<PatientRow>();

    if (error) return err(toAppError(error));
    return ok(toPatient(data));
  }

  async findByName(name: string): Promise<Result<Patient[], AppError>> {
    const { data, error } = await this.supabase
      .from('pacientes')
      .select(COLUMNS)
      // Sin comodines: igualdad exacta, sin distinguir mayúsculas.
      .ilike('nombre', escapeLike(name.trim()))
      .limit(5)
      .overrideTypes<PatientRow[], { merge: false }>();

    if (error) return err(toAppError(error));
    return ok(data.map(toPatient));
  }

  async update(patient: Patient): Promise<Result<void, AppError>> {
    // .select() devuelve las filas cambiadas: si RLS lo impide no hay error, solo 0 filas.
    const { data, error } = await this.supabase
      .from('pacientes')
      .update(toColumns(patient))
      .eq('id', patient.id)
      .select('id');

    if (error) return err(toAppError(error));
    if (data.length === 0) {
      return err(appError('notFound', 'El paciente ya no existe o no tienes permiso para editarlo.'));
    }
    return ok(undefined);
  }

  async delete(id: string): Promise<Result<void, AppError>> {
    // .select() devuelve las filas borradas: si RLS impide borrar no hay error, solo 0 filas.
    const { data, error } = await this.supabase.from('pacientes').delete().eq('id', id).select('id');

    if (error) return err(toAppError(error));
    if (data.length === 0) {
      return err(appError('notFound', 'El paciente ya no existe o no tienes permiso para eliminarlo.'));
    }
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
    name: row.nombre ?? '',
    branch: row.sucursal ?? '',
    phone: row.telefono ?? '',
    secondaryPhone: row.telefono_secundario ?? '',
    gender: row.genero ?? '',
    observations: row.observaciones ?? '',
    registeredOn: row.fecha_registro,
    birthDate: row.fecha_nacimiento,
  };
}
