import { Injectable, computed, signal } from '@angular/core';

export interface CurrencyConfig {
  /** Código ISO 4217. */
  code: string;
  /** Prefijo que se muestra: `S/.` */
  symbol: string;
  /** Locale para miles y decimales (`en-US` = 1,250.00). */
  locale: string;
  decimals: number;
}

export interface Option {
  /** Valor guardado en la DB. */
  value: string;
  /** Texto que se muestra. */
  label: string;
}

export interface Branch extends Option {
  /**
   * false = sucursal cerrada: se muestra en filtros e historial (tiene datos viejos),
   * pero no se ofrece al crear registros nuevos.
   */
  active: boolean;
}

export interface CompanyConfig {
  currency: CurrencyConfig;
  branches: Branch[];
  paymentMethods: Option[];
  timeZone: string;
}

// Valores actuales de la óptica (BranchEnum y PaymentMethodEnum de Flutter, más
// OFTALMIC CENTER, cerrada pero con historial en pacientes, revisiones y ventas).
// En la Fase 4b saldrán de la tabla `sucursales` de cada empresa.
const DEFAULT_CONFIG: CompanyConfig = {
  currency: { code: 'PEN', symbol: 'S/.', locale: 'en-US', decimals: 2 },
  branches: [
    { value: 'OFTALVISION', label: 'OFTALVISION', active: true },
    { value: 'MEDILENT', label: 'MEDILENT', active: true },
    { value: 'OFTALMIC CENTER', label: 'OFTALMIC CENTER', active: false },
  ],
  paymentMethods: [
    { value: 'efectivo', label: 'Efectivo' },
    { value: 'tarjeta', label: 'Tarjeta' },
    { value: 'transferencia', label: 'Transferencia' },
    { value: 'yape', label: 'Yape' },
    { value: 'nomina', label: 'Nómina' },
    { value: 'otro', label: 'Otro' },
  ],
  timeZone: 'America/Lima',
};

/**
 * Configuración de la empresa: moneda, sucursales y métodos de pago.
 * Regla 4b: nada de esto se escribe a mano en el código; siempre se lee de aquí.
 */
@Injectable({ providedIn: 'root' })
export class ConfigService {
  private readonly state = signal<CompanyConfig>(DEFAULT_CONFIG);
  readonly config = this.state.asReadonly();
  /** Sucursales para registros nuevos (selects de venta, paciente, egreso, usuario). */
  readonly activeBranches = computed(() => this.state().branches.filter((b) => b.active));
}
