import { TestBed } from '@angular/core/testing';
import { appError } from '../../core/errors/app-error';
import { UserAdminRepository } from '../../core/repositories/user-admin.repository';
import { FakeUserAdminRepository, fakeManagedUser } from '../../testing/fake-user-admin.repository';
import { UsersStore } from './users.store';

describe('UsersStore', () => {
  let repo: FakeUserAdminRepository;
  let store: UsersStore;

  beforeEach(() => {
    repo = new FakeUserAdminRepository();
    repo.users = [fakeManagedUser('1', 'admin'), fakeManagedUser('2', 'vendedor')];
    TestBed.configureTestingModule({
      providers: [UsersStore, { provide: UserAdminRepository, useValue: repo }],
    });
    store = TestBed.inject(UsersStore);
  });

  it('empieza sin cargar y sin usuarios', () => {
    expect(store.loaded()).toBe(false);
    expect(store.users()).toEqual([]);
  });

  it('carga la lista del repositorio', async () => {
    await store.load();
    expect(store.users().map((u) => u.id)).toEqual(['1', '2']);
    expect(store.loaded()).toBe(true);
  });

  it('un error se guarda como mensaje', async () => {
    repo.listFailWith = appError('network', 'Sin conexión.');
    await store.load();
    expect(store.error()).toBe('Sin conexión.');
    expect(store.loaded()).toBe(true);
  });

  it('al crear, refresca la lista', async () => {
    await store.load();
    const result = await store.create({ name: 'Nuevo', branch: 'OFTALVISION', role: 'vendedor', email: 'nuevo@optinova.test', password: 'Secreto1' });
    expect(result.ok).toBe(true);
    expect(store.users().map((u) => u.name)).toContain('Nuevo');
  });

  it('si crear falla, no cambia la lista', async () => {
    await store.load();
    repo.createFailWith = appError('server', 'Falló.');
    const result = await store.create({ name: 'Nuevo', branch: null, role: 'vendedor', email: 'x@x.test', password: 'Secreto1' });
    expect(result.ok).toBe(false);
    expect(store.users().length).toBe(2);
  });

  it('al editar, refresca la lista', async () => {
    await store.load();
    const result = await store.update('1', { name: 'Admin Editado', branch: 'MEDILENT', role: 'admin' });
    expect(result.ok).toBe(true);
    expect(store.users().find((u) => u.id === '1')?.name).toBe('Admin Editado');
  });

  it('al activar/desactivar, refresca la lista', async () => {
    await store.load();
    const result = await store.setActive('2', false);
    expect(result.ok).toBe(true);
    expect(store.users().find((u) => u.id === '2')?.active).toBe(false);
  });

  it('restablecer contraseña no recarga la lista (no cambia nada visible)', async () => {
    await store.load();
    const result = await store.resetPassword('1', 'NuevaClave1');
    expect(result.ok).toBe(true);
    expect(repo.resetPasswordCalls).toEqual([{ userId: '1', newPassword: 'NuevaClave1' }]);
  });
});
