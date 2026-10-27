import { TestBed } from '@angular/core/testing';
import { appError } from '../../core/errors/app-error';
import { ExpenseRepository } from '../../core/repositories/expense.repository';
import { FakeExpenseRepository, fakeCategory, fakeExpense } from '../../testing/fake-expense.repository';
import { ExpensesStore } from './expenses.store';

describe('ExpensesStore', () => {
  let repo: FakeExpenseRepository;
  let store: ExpensesStore;

  beforeEach(() => {
    repo = new FakeExpenseRepository();
    repo.expenses = [
      { ...fakeExpense(1, 'Luz'), amount: 100, branch: 'OFTALVISION' },
      { ...fakeExpense(2, 'Agua'), amount: 50, branch: 'MEDILENT' },
      { ...fakeExpense(3, 'Internet'), amount: 80, branch: 'OFTALVISION' },
    ];
    repo.categories = [fakeCategory(1, 'Servicios')];
    TestBed.configureTestingModule({
      providers: [ExpensesStore, { provide: ExpenseRepository, useValue: repo }],
    });
    store = TestBed.inject(ExpensesStore);
  });

  it('empieza sin cargar y sin resultados', () => {
    expect(store.loaded()).toBe(false);
    expect(store.items()).toEqual([]);
    expect(store.total()).toBe(0);
  });

  it('carga la página pedida y el total', async () => {
    await store.load({ query: '', branch: null, page: 1, pageSize: 2 });
    expect(store.items().map((e) => e.id)).toEqual(['1', '2']);
    expect(store.total()).toBe(3);
    expect(store.loaded()).toBe(true);
  });

  it('filtra por sucursal', async () => {
    await store.load({ query: '', branch: 'MEDILENT', page: 1, pageSize: 10 });
    expect(store.items().map((e) => e.id)).toEqual(['2']);
  });

  it('la suma de la página es solo de los items cargados, no del total', async () => {
    await store.load({ query: '', branch: null, page: 1, pageSize: 2 });
    expect(store.pageTotal()).toBe(150); // 100 + 50, no los 230 de los tres
  });

  it('un error se guarda como mensaje', async () => {
    repo.failWith = appError('network', 'Sin conexión.');
    await store.load({ query: '', branch: null, page: 1, pageSize: 10 });
    expect(store.error()).toBe('Sin conexión.');
    expect(store.loaded()).toBe(true);
  });

  it('carga las categorías del repositorio', async () => {
    await store.loadCategories();
    expect(store.categories().map((c) => c.name)).toEqual(['Servicios']);
  });

  it('al crear guarda con quien lo registró y refresca la lista pedida', async () => {
    await store.load({ query: '', branch: null, page: 1, pageSize: 10 });
    const { id, categoryName, categoryColor, registeredBy, ...draft } = fakeExpense(0, 'Nuevo');
    void id;
    void categoryName;
    void categoryColor;
    void registeredBy;

    const result = await store.create(draft, 'Supervisor Prueba');

    expect(result.ok).toBe(true);
    expect(repo.created[0].registeredBy).toBe('Supervisor Prueba');
    expect(store.items().map((e) => e.description)).toContain('Nuevo');
  });

  it('si crear falla devuelve el error y no cambia la lista', async () => {
    await store.load({ query: '', branch: null, page: 1, pageSize: 10 });
    repo.createFailWith = appError('server', 'Falló.');
    const { id, categoryName, categoryColor, registeredBy, ...draft } = fakeExpense(0, 'Nuevo');
    void id;
    void categoryName;
    void categoryColor;
    void registeredBy;

    const result = await store.create(draft, 'Supervisor Prueba');

    expect(result.ok).toBe(false);
    expect(store.items().length).toBe(3);
  });

  it('al editar guarda en el repositorio y refresca la lista', async () => {
    await store.load({ query: '', branch: null, page: 1, pageSize: 10 });

    const result = await store.update({ ...store.items()[0], description: 'Luz cambiada' });

    expect(result.ok).toBe(true);
    expect(store.items()[0].description).toBe('Luz cambiada');
  });

  it('al eliminar borra en el repositorio y refresca la lista', async () => {
    await store.load({ query: '', branch: null, page: 1, pageSize: 10 });

    const result = await store.remove(store.items()[0].id);

    expect(result.ok).toBe(true);
    expect(repo.deleted).toEqual(['1']);
    expect(store.items().length).toBe(2);
  });

  it('al crear una categoría vuelve a pedir la lista de categorías', async () => {
    const result = await store.createCategory({ name: 'Nueva', color: '#000000' });

    expect(result.ok).toBe(true);
    expect(store.categories().map((c) => c.name)).toEqual(['Servicios', 'Nueva']);
  });

  it('al eliminar una categoría vuelve a pedir la lista de categorías', async () => {
    const result = await store.deleteCategory(1);

    expect(result.ok).toBe(true);
    expect(store.categories()).toEqual([]);
  });

  it('si eliminar una categoría falla por estar en uso, devuelve el error', async () => {
    await store.loadCategories();
    repo.deleteCategoryFailWith = appError('server', 'No se puede eliminar: hay egresos registrados con esta categoría.');

    const result = await store.deleteCategory(1);

    expect(result.ok).toBe(false);
    expect(store.categories().length).toBe(1);
  });
});
