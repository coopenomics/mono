import { PostgresVerificationReviewRepository } from './postgres-verification-review.repository';
import { PostgresTwoFactorRepository } from './postgres-two-factor.repository';
import { PostgresAccessRulesRepository } from './postgres-access-rules.repository';

/**
 * Хранилища CoopID читают ответ записи с `RETURNING` как строки: сколько строк
 * вернулось — столько записей затронуто. До 25.09.2026 ответ прежней прослойки
 * («строки и число задетых» парой) разбирался как одна запись: отзыв
 * верификации падал уже после того, как цепь его провела, а повтор кода
 * второго фактора принимался.
 */
const database = (rows: unknown[]) => ({ query: jest.fn().mockResolvedValue(rows) });

describe('хранилища CoopID: ответ записи с RETURNING', () => {
  const reviewRow = {
    id: 'rev-1',
    username: 'ant',
    status: 'approved',
    photos: [],
    created_at: new Date(0),
    decided_at: new Date(0),
  };

  it('решение по заявке: запись читается из возвращённой строки, владельцу уходит сигнал', async () => {
    const db = database([reviewRow]);
    const feed = { publishLocal: jest.fn().mockResolvedValue(undefined) };
    const repository = new PostgresVerificationReviewRepository(db as never, feed as never);

    const review = await repository.decide({ id: 'rev-1', status: 'approved' as never, decided_by: 'chairman', clear_photos: true });

    expect(review).toMatchObject({ id: 'rev-1' });
    expect(db.query.mock.calls[0][0]).toContain('RETURNING *');
    expect(feed.publishLocal).toHaveBeenCalledTimes(1);
  });

  it('решение по заявке, которой нет: пусто, без падения', async () => {
    const repository = new PostgresVerificationReviewRepository(database([]) as never, null);

    await expect(
      repository.decide({ id: 'нет', status: 'rejected' as never, decided_by: 'chairman', clear_photos: false })
    ).resolves.toBeNull();
  });

  it('код второго фактора: шаг занят только когда правка вернула строку — повтор кода не проходит', async () => {
    await expect(new PostgresTwoFactorRepository(database([{ subject_id: 'u1' }]) as never).claimStep('u1', 7)).resolves.toBe(true);
    await expect(new PostgresTwoFactorRepository(database([]) as never).claimStep('u1', 7)).resolves.toBe(false);
  });

  it('очистка истёкших правил доступа отвечает числом удалённых', async () => {
    const repository = new PostgresAccessRulesRepository(database([{ id: 1 }, { id: 1 }, { id: 1 }]) as never);

    await expect(repository.deleteExpired(new Date())).resolves.toBe(3);
  });
});
