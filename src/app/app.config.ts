import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideLucideConfig } from '@lucide/angular';
import { routes } from './app.routes';
import { SessionStore } from './core/auth/session.store';
import { SupabaseAppConfigRepository } from './core/data/supabase-app-config.repository';
import { SupabaseAuditLogRepository } from './core/data/supabase-audit-log.repository';
import { SupabaseAuthRepository } from './core/data/supabase-auth.repository';
import { SupabaseDashboardRepository } from './core/data/supabase-dashboard.repository';
import { SupabaseExpenseRepository } from './core/data/supabase-expense.repository';
import { SupabaseMountRepository } from './core/data/supabase-mount.repository';
import { SupabasePatientLifecycleRepository } from './core/data/supabase-patient-lifecycle.repository';
import { SupabasePatientRepository } from './core/data/supabase-patient.repository';
import { SupabasePaymentRepository } from './core/data/supabase-payment.repository';
import { SupabasePaymentsReportRepository } from './core/data/supabase-payments-report.repository';
import { SupabaseResinRepository } from './core/data/supabase-resin.repository';
import { SupabaseReviewRepository } from './core/data/supabase-review.repository';
import { SupabaseSaleRepository } from './core/data/supabase-sale.repository';
import { SupabaseSalesBySellerReportRepository } from './core/data/supabase-sales-by-seller-report.repository';
import { SupabaseSellerRepository } from './core/data/supabase-seller.repository';
import { SupabaseBranchSettingsRepository } from './core/data/supabase-branch-settings.repository';
import { SupabaseDiscountAuthorizationRepository } from './core/data/supabase-discount-authorization.repository';
import { SupabaseTeamPermissionsRepository } from './core/data/supabase-team-permissions.repository';
import { SupabaseUserAdminRepository } from './core/data/supabase-user-admin.repository';
import { AppConfigRepository } from './core/repositories/app-config.repository';
import { AuditLogRepository } from './core/repositories/audit-log.repository';
import { AuthRepository } from './core/repositories/auth.repository';
import { DashboardRepository } from './core/repositories/dashboard.repository';
import { ExpenseRepository } from './core/repositories/expense.repository';
import { MountRepository } from './core/repositories/mount.repository';
import { PatientLifecycleRepository } from './core/repositories/patient-lifecycle.repository';
import { PatientRepository } from './core/repositories/patient.repository';
import { PaymentRepository } from './core/repositories/payment.repository';
import { PaymentsReportRepository } from './core/repositories/payments-report.repository';
import { ResinRepository } from './core/repositories/resin.repository';
import { ReviewRepository } from './core/repositories/review.repository';
import { SaleRepository } from './core/repositories/sale.repository';
import { SalesBySellerReportRepository } from './core/repositories/sales-by-seller-report.repository';
import { SellerRepository } from './core/repositories/seller.repository';
import { BranchSettingsRepository } from './core/repositories/branch-settings.repository';
import { DiscountAuthorizationRepository } from './core/repositories/discount-authorization.repository';
import { TeamPermissionsRepository } from './core/repositories/team-permissions.repository';
import { UserAdminRepository } from './core/repositories/user-admin.repository';
import { ThemeService } from './core/theme/theme.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // withComponentInputBinding: el `data` y los parámetros de la ruta llegan como input() de la página.
    provideRouter(routes, withComponentInputBinding()),
    // Íconos Lucide con trazo 1.75px (sistema de diseño, Iconografía).
    provideLucideConfig({ strokeWidth: 1.75 }),
    // Repositorio abstracto → implementación (= Provider<AuthRepository>((ref) => AuthRepositoryImpl())).
    { provide: AuthRepository, useClass: SupabaseAuthRepository },
    { provide: AuditLogRepository, useClass: SupabaseAuditLogRepository },
    { provide: AppConfigRepository, useClass: SupabaseAppConfigRepository },
    { provide: PatientRepository, useClass: SupabasePatientRepository },
    { provide: PatientLifecycleRepository, useClass: SupabasePatientLifecycleRepository },
    { provide: ReviewRepository, useClass: SupabaseReviewRepository },
    { provide: ExpenseRepository, useClass: SupabaseExpenseRepository },
    { provide: SaleRepository, useClass: SupabaseSaleRepository },
    { provide: PaymentRepository, useClass: SupabasePaymentRepository },
    { provide: PaymentsReportRepository, useClass: SupabasePaymentsReportRepository },
    { provide: SalesBySellerReportRepository, useClass: SupabaseSalesBySellerReportRepository },
    { provide: MountRepository, useClass: SupabaseMountRepository },
    { provide: ResinRepository, useClass: SupabaseResinRepository },
    { provide: SellerRepository, useClass: SupabaseSellerRepository },
    { provide: TeamPermissionsRepository, useClass: SupabaseTeamPermissionsRepository },
    { provide: BranchSettingsRepository, useClass: SupabaseBranchSettingsRepository },
    { provide: DiscountAuthorizationRepository, useClass: SupabaseDiscountAuthorizationRepository },
    { provide: UserAdminRepository, useClass: SupabaseUserAdminRepository },
    { provide: DashboardRepository, useClass: SupabaseDashboardRepository },
    // Crea ThemeService al arrancar para aplicar el primario guardado antes de la primera pantalla.
    provideAppInitializer(() => {
      inject(ThemeService);
    }),
    // Restaura la sesión antes de la primera navegación: los guards ya saben si hay usuario
    // (= el splash + AuthStatus.checking de Flutter). Mientras tanto se ve el splash de index.html.
    provideAppInitializer(() => inject(SessionStore).restore()),
  ],
};
