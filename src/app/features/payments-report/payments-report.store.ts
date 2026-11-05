import { Injectable, computed, inject, signal } from '@angular/core';
import { Expense } from '../../core/models/expense';
import { PaymentReportEntry, PaymentsReportRepository, PaymentsReportSearch } from '../../core/repositories/payments-report.repository';

export interface AmountByKey {
  key: string;
  label: string;
  amount: number;
  color: string | null;
}

interface PaymentsReportState {
  payments: PaymentReportEntry[];
  expenses: Expense[];
  loading: boolean;
  /** Mensaje para el usuario; null si no hay error. */
  error: string | null;
  /** Falso hasta que llega la primera respuesta: distingue "cargando" de "sin movimientos". */
  loaded: boolean;
}

/** "efectivo" → "Efectivo". */
function capitalize(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

function sumAmount(list: { amount: number }[]): number {
  return list.reduce((sum, item) => sum + item.amount, 0);
}

/** Agrupa y suma por una clave, ordenado de mayor a menor monto (= el ranking del Dashboard). */
function groupByAmount<T>(items: T[], key: (item: T) => { key: string; label: string; color?: string | null }, amount: (item: T) => number): AmountByKey[] {
  const byKey = new Map<string, AmountByKey>();
  for (const item of items) {
    const { key: k, label, color } = key(item);
    const current = byKey.get(k) ?? { key: k, label, amount: 0, color: color ?? null };
    current.amount += amount(item);
    byKey.set(k, current);
  }
  return [...byKey.values()].sort((a, b) => b.amount - a.amount);
}

/**
 * Estado de Settings · Ingresos y egresos (= PaymentsReport Notifier de Flutter). Trae todos los
 * pagos y egresos del período con una sola llamada a `payments_report` (RPC `SECURITY DEFINER`,
 * cambio #19: el rol y la sucursal se deciden en el servidor, no en este store) y deriva los
 * totales/agrupaciones; la tabla de detalle de cada sección se pagina en memoria en la página,
 * como el resto de los reportes nuevos de E2.8. Se provee en la página (providers: [PaymentsReportStore]).
 */
@Injectable()
export class PaymentsReportStore {
  private readonly repo = inject(PaymentsReportRepository);

  private readonly state = signal<PaymentsReportState>({
    payments: [],
    expenses: [],
    loading: false,
    error: null,
    loaded: false,
  });

  readonly loading = computed(() => this.state().loading);
  readonly error = computed(() => this.state().error);
  readonly loaded = computed(() => this.state().loaded);

  /** = "Ingresos por nuevas ventas": el abono inicial que ya trae cada venta al confirmarse (E2.6). */
  readonly newSales = computed(() => this.state().payments.filter((p) => p.type === 'nueva_venta'));
  /** = "Ingresos por saldos pagados": abonos posteriores sobre una venta ya existente. */
  readonly balancePayments = computed(() => this.state().payments.filter((p) => p.type === 'abono_saldo'));
  readonly expenses = computed(() => this.state().expenses);

  readonly newSalesByMethod = computed(() => groupByAmount(this.newSales(), (p) => ({ key: p.paymentMethod, label: capitalize(p.paymentMethod) }), (p) => p.amount));
  readonly balancePaymentsByMethod = computed(() => groupByAmount(this.balancePayments(), (p) => ({ key: p.paymentMethod, label: capitalize(p.paymentMethod) }), (p) => p.amount));
  readonly expensesByCategory = computed(() =>
    groupByAmount(this.expenses(), (e) => ({ key: e.categoryName ?? 'sin-categoria', label: e.categoryName ?? 'Sin categoría', color: e.categoryColor }), (e) => e.amount),
  );

  readonly totals = computed(() => {
    const newSales = sumAmount(this.newSales());
    const balancePayments = sumAmount(this.balancePayments());
    const expenses = sumAmount(this.expenses());
    const income = newSales + balancePayments;
    return { newSales, balancePayments, income, expenses, net: income - expenses };
  });

  /** Número de la última búsqueda lanzada: una respuesta vieja no pisa a una más nueva. */
  private lastRequest = 0;

  async load(search: PaymentsReportSearch): Promise<void> {
    const request = ++this.lastRequest;
    this.state.update((s) => ({ ...s, loading: true, error: null }));

    const result = await this.repo.load(search);
    if (request !== this.lastRequest) return;

    if (result.ok) {
      this.state.update((s) => ({ ...s, payments: result.value.payments, expenses: result.value.expenses, loading: false, loaded: true }));
    } else {
      this.state.update((s) => ({ ...s, loading: false, error: result.error.message, loaded: true }));
    }
  }
}
