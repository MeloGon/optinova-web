import { TestBed } from '@angular/core/testing';
import { appError } from '../../core/errors/app-error';
import { BranchAdminRepository } from '../../core/repositories/branch-admin.repository';
import { FakeBranchAdminRepository, fakeManagedBranch } from '../../testing/fake-branch-admin.repository';
import { BranchesStore } from './branches.store';

describe('BranchesStore', () => {
  let repo: FakeBranchAdminRepository;
  let store: BranchesStore;

  beforeEach(() => {
    repo = new FakeBranchAdminRepository();
    repo.branches = [fakeManagedBranch(1, 'OFTALVISION'), fakeManagedBranch(2, 'MEDILENT'), fakeManagedBranch(3, 'OFTALMIC CENTER', false)];
    TestBed.configureTestingModule({
      providers: [BranchesStore, { provide: BranchAdminRepository, useValue: repo }],
    });
    store = TestBed.inject(BranchesStore);
  });

  it('empieza sin cargar y sin sucursales', () => {
    expect(store.loaded()).toBe(false);
    expect(store.branches()).toEqual([]);
  });

  it('carga y agrupa por empresa', async () => {
    await store.load();
    expect(store.groups().length).toBe(1);
    expect(store.groups()[0].branches.map((b) => b.name)).toEqual(['OFTALVISION', 'MEDILENT', 'OFTALMIC CENTER']);
  });

  it('un error se guarda como mensaje', async () => {
    repo.listFailWith = appError('network', 'Sin conexión.');
    await store.load();
    expect(store.error()).toBe('Sin conexión.');
    expect(store.loaded()).toBe(true);
  });

  it('al crear, refresca la lista', async () => {
    await store.load();
    const result = await store.create('san isidro');
    expect(result.ok).toBe(true);
    expect(store.branches().map((b) => b.name)).toContain('SAN ISIDRO');
  });

  it('al renombrar, refresca la lista', async () => {
    await store.load();
    const result = await store.update(2, { name: 'medilent norte' });
    expect(result.ok).toBe(true);
    expect(store.branches().find((b) => b.id === 2)?.name).toBe('MEDILENT NORTE');
  });

  it('si renombrar falla, devuelve el error y no cambia la lista', async () => {
    await store.load();
    repo.updateFailWith = appError('server', 'Ya existe una sucursal con ese nombre');
    const result = await store.update(2, { name: 'OFTALVISION' });
    expect(result.ok).toBe(false);
    expect(store.branches().find((b) => b.id === 2)?.name).toBe('MEDILENT');
  });

  it('cierra y reabre sin borrar', async () => {
    await store.load();
    await store.update(2, { active: false });
    expect(store.branches().find((b) => b.id === 2)?.active).toBe(false);
    await store.update(2, { active: true });
    expect(store.branches().find((b) => b.id === 2)?.active).toBe(true);
  });

  it('detecta la última sucursal abierta de una empresa', async () => {
    await store.load();
    expect(store.isLastOpen(store.branches()[0])).toBe(false);
    await store.update(2, { active: false });
    expect(store.isLastOpen(store.branches().find((b) => b.id === 1)!)).toBe(true);
    expect(store.isLastOpen(store.branches().find((b) => b.id === 2)!)).toBe(false);
  });

  it('crear una empresa agrega su grupo', async () => {
    await store.load();
    const result = await store.createCompany({
      name: 'Óptica Norte',
      branch: 'principal',
      adminName: 'Ana',
      adminEmail: 'ana@norte.test',
      adminPassword: 'Secreto1',
    });
    expect(result.ok).toBe(true);
    expect(store.groups().map((g) => g.companyName)).toContain('Óptica Norte');
    expect(repo.companiesCreated.length).toBe(1);
  });

  it('si crear la empresa falla, no cambia la lista', async () => {
    await store.load();
    repo.createCompanyFailWith = appError('server', 'Ya existe una empresa con ese nombre');
    const result = await store.createCompany({ name: 'X', branch: 'Y', adminName: 'A', adminEmail: 'a@a.test', adminPassword: 'Secreto1' });
    expect(result.ok).toBe(false);
    expect(store.groups().length).toBe(1);
  });
});
