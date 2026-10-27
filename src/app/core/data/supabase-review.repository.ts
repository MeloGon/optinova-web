import { Injectable, inject } from '@angular/core';
import { AppError, appError, toAppError } from '../errors/app-error';
import { Review } from '../models/review';
import { NewReview, ReviewRepository } from '../repositories/review.repository';
import { Result, err, ok } from '../result';
import { SUPABASE } from '../supabase/supabase.client';

/** Fila de `revisiones` tal como viene de la DB. */
interface ReviewRow {
  id: string;
  paciente_id: string | null;
  paciente_nombre: string | null;
  sucursal: string | null;
  fecha: string;
  motivo_consulta: string | null;
  historia_clinica: string | null;
  tipo_graduacion: string | null;
  diagnostico_optometrico: string | null;
  od_esf: string | null;
  od_cil: string | null;
  od_eje: string | null;
  od_av: string | null;
  oi_esf: string | null;
  oi_cil: string | null;
  oi_eje: string | null;
  oi_av: string | null;
  adicion: string | null;
  dip: string | null;
  od_cb_lc: string | null;
  od_diam_lc: string | null;
  oi_cb_lc: string | null;
  oi_diam_lc: string | null;
  av_sin_rx_od_lejos: string | null;
  av_sin_rx_oi_lejos: string | null;
  cv_od_lejos: string | null;
  cv_oi_lejos: string | null;
  av_sin_rx_od_cerca: string | null;
  av_sin_rx_oi_cerca: string | null;
  av_con_rx_od_cerca: string | null;
  av_con_rx_oi_cerca: string | null;
  observaciones: string | null;
}

// `paciente_id` como texto: el mismo motivo que el ID de pacientes (ver supabase-patient.repository).
const COLUMNS = `
  id::text, paciente_id::text, paciente_nombre, sucursal, fecha,
  motivo_consulta, historia_clinica, tipo_graduacion, diagnostico_optometrico,
  od_esf, od_cil, od_eje, od_av, oi_esf, oi_cil, oi_eje, oi_av,
  adicion, dip, od_cb_lc, od_diam_lc, oi_cb_lc, oi_diam_lc,
  av_sin_rx_od_lejos, av_sin_rx_oi_lejos, cv_od_lejos, cv_oi_lejos,
  av_sin_rx_od_cerca, av_sin_rx_oi_cerca, av_con_rx_od_cerca, av_con_rx_oi_cerca,
  observaciones
`;

/** Las medidas: las mismas columnas al crear y al editar (paciente, sucursal y fecha no se editan). */
function toMeasureColumns(review: NewReview | Review) {
  return {
    motivo_consulta: review.reasonConsult,
    historia_clinica: review.clinicHistory,
    tipo_graduacion: review.graduationType,
    diagnostico_optometrico: review.optometricDiagnosis,
    od_esf: review.odEsf,
    od_cil: review.odCil,
    od_eje: review.odEje,
    od_av: review.odAv,
    oi_esf: review.oiEsf,
    oi_cil: review.oiCil,
    oi_eje: review.oiEje,
    oi_av: review.oiAv,
    adicion: review.addition,
    dip: review.dip,
    od_cb_lc: review.odCbLc,
    od_diam_lc: review.odDiamLc,
    oi_cb_lc: review.oiCbLc,
    oi_diam_lc: review.oiDiamLc,
    av_sin_rx_od_lejos: review.avSinRxOdLejos,
    av_sin_rx_oi_lejos: review.avSinRxOiLejos,
    cv_od_lejos: review.cvOdLejos,
    cv_oi_lejos: review.cvOiLejos,
    av_sin_rx_od_cerca: review.avSinRxOdCerca,
    av_sin_rx_oi_cerca: review.avSinRxOiCerca,
    av_con_rx_od_cerca: review.avConRxOdCerca,
    av_con_rx_oi_cerca: review.avConRxOiCerca,
    observaciones: review.observations,
  };
}

@Injectable()
export class SupabaseReviewRepository extends ReviewRepository {
  private readonly supabase = inject(SUPABASE);

  async getByPatient(patientId: string): Promise<Result<Review[], AppError>> {
    const { data, error } = await this.supabase
      .from('revisiones')
      .select(COLUMNS)
      .eq('paciente_id', patientId)
      .order('fecha', { ascending: false })
      .order('id', { ascending: false })
      .overrideTypes<ReviewRow[], { merge: false }>();

    if (error) return err(toAppError(error));
    return ok(data.map(toReview));
  }

  async create(review: NewReview): Promise<Result<Review, AppError>> {
    const { data, error } = await this.supabase
      .from('revisiones')
      .insert({
        ...toMeasureColumns(review),
        // Sin id: lo asigna la secuencia (migración #7).
        paciente_id: review.patientId,
        paciente_nombre: review.patientName,
        sucursal: review.branch,
        fecha: review.date,
      })
      .select(COLUMNS)
      .single<ReviewRow>();

    if (error) return err(toAppError(error));
    return ok(toReview(data));
  }

  async update(review: Review): Promise<Result<void, AppError>> {
    const { data, error } = await this.supabase
      .from('revisiones')
      .update(toMeasureColumns(review))
      .eq('id', review.id)
      .select('id');

    if (error) return err(toAppError(error));
    if (data.length === 0) {
      return err(appError('notFound', 'La medida ya no existe o no tienes permiso para editarla.'));
    }
    return ok(undefined);
  }

  async delete(id: string): Promise<Result<void, AppError>> {
    const { data, error } = await this.supabase.from('revisiones').delete().eq('id', id).select('id');

    if (error) return err(toAppError(error));
    if (data.length === 0) {
      return err(appError('notFound', 'La medida ya no existe o no tienes permiso para eliminarla.'));
    }
    return ok(undefined);
  }
}

function toReview(row: ReviewRow): Review {
  return {
    id: row.id,
    patientId: row.paciente_id,
    patientName: row.paciente_nombre ?? '',
    branch: row.sucursal ?? '',
    date: row.fecha,
    reasonConsult: row.motivo_consulta ?? '',
    clinicHistory: row.historia_clinica ?? '',
    graduationType: row.tipo_graduacion ?? '',
    optometricDiagnosis: row.diagnostico_optometrico ?? '',
    odEsf: row.od_esf ?? '',
    odCil: row.od_cil ?? '',
    odEje: row.od_eje ?? '',
    odAv: row.od_av ?? '',
    oiEsf: row.oi_esf ?? '',
    oiCil: row.oi_cil ?? '',
    oiEje: row.oi_eje ?? '',
    oiAv: row.oi_av ?? '',
    addition: row.adicion ?? '',
    dip: row.dip ?? '',
    odCbLc: row.od_cb_lc ?? '',
    odDiamLc: row.od_diam_lc ?? '',
    oiCbLc: row.oi_cb_lc ?? '',
    oiDiamLc: row.oi_diam_lc ?? '',
    avSinRxOdLejos: row.av_sin_rx_od_lejos ?? '',
    avSinRxOiLejos: row.av_sin_rx_oi_lejos ?? '',
    cvOdLejos: row.cv_od_lejos ?? '',
    cvOiLejos: row.cv_oi_lejos ?? '',
    avSinRxOdCerca: row.av_sin_rx_od_cerca ?? '',
    avSinRxOiCerca: row.av_sin_rx_oi_cerca ?? '',
    avConRxOdCerca: row.av_con_rx_od_cerca ?? '',
    avConRxOiCerca: row.av_con_rx_oi_cerca ?? '',
    observations: row.observaciones ?? '',
  };
}
