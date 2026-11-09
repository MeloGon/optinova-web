import { Injectable, inject } from '@angular/core';
import { AppError, toAppError } from '../errors/app-error';
import { ManagedBranch } from '../models/managed-branch';
import { BranchAdminRepository, BranchEdit, NewCompany } from '../repositories/branch-admin.repository';
import { Result, err, ok } from '../result';
import { SUPABASE } from '../supabase/supabase.client';

interface BranchRow {
  id: number;
  nombre: string;
  activa: boolean;
  organizacion_id: string;
  organizaciones: { nombre: string } | null;
}

/** Lo que devuelve el Edge Function cuando algo sale mal: `{ error: "mensaje para el usuario" }`. */
interface FunctionErrorBody {
  error?: string;
}

@Injectable()
export class SupabaseBranchAdminRepository extends BranchAdminRepository {
  private readonly supabase = inject(SUPABASE);

  async list(): Promise<Result<ManagedBranch[], AppError>> {
    const { data, error } = await this.supabase
      .from('sucursales')
      .select('id, nombre, activa, organizacion_id, organizaciones(nombre)')
      .order('nombre');
    if (error) return err(toAppError(error));
    return ok(
      (data as unknown as BranchRow[]).map((row) => ({
        id: row.id,
        name: row.nombre,
        active: row.activa,
        companyId: row.organizacion_id,
        companyName: row.organizaciones?.nombre ?? '',
      })),
    );
  }

  async create(name: string, companyId?: string): Promise<Result<void, AppError>> {
    const { error } = await this.supabase.rpc('crear_sucursal', {
      p_nombre: name,
      p_organizacion: companyId ?? null,
    });
    if (error) return err(toAppError(error));
    return ok(undefined);
  }

  async update(id: number, edit: BranchEdit): Promise<Result<void, AppError>> {
    const { error } = await this.supabase.rpc('editar_sucursal', {
      p_id: id,
      p_nombre: edit.name ?? null,
      p_activa: edit.active ?? null,
    });
    if (error) return err(toAppError(error));
    return ok(undefined);
  }

  async createCompany(draft: NewCompany): Promise<Result<void, AppError>> {
    const { error } = await this.supabase.functions.invoke('megadmin-users', {
      body: {
        action: 'create_organization',
        nombre: draft.name,
        sucursal: draft.branch,
        adminNombre: draft.adminName,
        adminEmail: draft.adminEmail,
        adminPassword: draft.adminPassword,
      },
    });
    if (!error) return ok(undefined);

    // Igual que `SupabaseUserAdminRepository`: functions.invoke no lee el cuerpo `{ error }`.
    const context = (error as { context?: Response }).context;
    let message = error.message;
    if (context) {
      const parsed = (await context.json().catch(() => null)) as FunctionErrorBody | null;
      if (parsed?.error) message = parsed.error;
    }
    return err(toAppError({ status: context?.status, message }));
  }
}
