import { TestBed } from '@angular/core/testing';
import { appError } from '../errors/app-error';
import { BranchAdminRepository } from '../repositories/branch-admin.repository';
import { FakeBranchAdminRepository, fakeManagedBranch } from '../../testing/fake-branch-admin.repository';
import { CompanyBranchesService } from './company-branches.service';
import { ConfigService } from './config.service';

describe('CompanyBranchesService', () => {
  let repo: FakeBranchAdminRepository;
  let service: CompanyBranchesService;
  let config: ConfigService;

  beforeEach(() => {
    repo = new FakeBranchAdminRepository();
    repo.branches = [
      fakeManagedBranch(1, 'OFTALVISION'),
      fakeManagedBranch(2, 'OFTALMIC CENTER', false),
      { ...fakeManagedBranch(3, 'CENTRO'), companyId: 'org-2', companyName: 'Otra Optica' },
    ];
    TestBed.configureTestingModule({ providers: [{ provide: BranchAdminRepository, useValue: repo }] });
    service = TestBed.inject(CompanyBranchesService);
    config = TestBed.inject(ConfigService);
  });

  it('deja en la config solo las sucursales de la empresa, abiertas y cerradas', async () => {
    await service.load('org-1');
    expect(config.config().branches).toEqual([
      { value: 'OFTALVISION', label: 'OFTALVISION', active: true },
      { value: 'OFTALMIC CENTER', label: 'OFTALMIC CENTER', active: false },
    ]);
    expect(config.activeBranches().map((b) => b.value)).toEqual(['OFTALVISION']);
  });

  it('otra empresa ve las suyas', async () => {
    await service.load('org-2');
    expect(config.config().branches.map((b) => b.value)).toEqual(['CENTRO']);
  });

  it('reload recoge los cambios', async () => {
    await service.load('org-1');
    await repo.create('SAN ISIDRO');
    await service.reload();
    expect(config.activeBranches().map((b) => b.value)).toContain('SAN ISIDRO');
  });

  it('si no se pueden leer, queda vacía y no la de otra empresa', async () => {
    repo.listFailWith = appError('network', 'Sin conexión.');
    await service.load('org-1');
    expect(config.config().branches).toEqual([]);
  });
});
