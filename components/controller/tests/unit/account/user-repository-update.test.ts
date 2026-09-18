/**
 * Обновление аккаунта через TypeORM-репозиторий.
 *
 * Репозиторий перекладывает доменные поля в колонки записи. Раньше он
 * перечислял их строками в двух методах подряд, и добавленная фотография
 * пайщика в перечень не попала: сервис отчитывался об успехе, база оставалась
 * прежней, и снимок держался до первого перехода на другую страницу. Тест на
 * сервис этого не видел — репозиторий в нём подменён.
 */
import { UserTypeormRepository } from '~/infrastructure/database/typeorm/repositories/user.typeorm-repository';

function make(stored: Record<string, unknown> = {}) {
  const entity = {
    ...{ id: '1', username: 'ant', avatar_key: null, avatar_mime: null },
    ...stored,
    toDomainEntity: () => ({ username: 'ant', ...stored }),
  };
  const repository = {
    update: jest.fn(async () => ({ affected: 1 })),
    findOne: jest.fn(async () => entity),
  } as any;
  return { repo: new UserTypeormRepository(repository), repository };
}

describe('UserTypeormRepository.updateByUsername', () => {
  it('записывает фотографию пайщика — ключ объекта и его тип', async () => {
    const { repo, repository } = make();
    await repo.updateByUsername('ant', { avatar_key: 'avatars/ant/abc.jpg', avatar_mime: 'image/jpeg' });
    expect(repository.update).toHaveBeenCalledWith(
      { username: 'ant' },
      { avatar_key: 'avatars/ant/abc.jpg', avatar_mime: 'image/jpeg' }
    );
  });

  it('снятие фотографии очищает оба поля, а не пропускает их как пустые', async () => {
    const { repo, repository } = make({ avatar_key: 'avatars/ant/abc.jpg' });
    await repo.updateByUsername('ant', { avatar_key: null, avatar_mime: null });
    expect(repository.update).toHaveBeenCalledWith({ username: 'ant' }, { avatar_key: null, avatar_mime: null });
  });

  it('адрес почты приводится к общему виду', async () => {
    const { repo, repository } = make();
    await repo.updateByUsername('ant', { email: '  Ant@Example.COM ' });
    expect(repository.update.mock.calls[0][1]).toEqual({ email: 'ant@example.com' });
  });

  it('обновление без единого поля до базы не доходит', async () => {
    const { repo, repository } = make();
    const result = await repo.updateByUsername('ant', {});
    expect(repository.update).not.toHaveBeenCalled();
    expect(result).not.toBeNull();
  });

  it('обновление по идентификатору переносит те же поля', async () => {
    const { repo, repository } = make();
    await repo.updateById('1', { avatar_key: 'avatars/ant/abc.jpg', avatar_mime: 'image/jpeg' });
    expect(repository.update).toHaveBeenCalledWith('1', {
      avatar_key: 'avatars/ant/abc.jpg',
      avatar_mime: 'image/jpeg',
    });
  });
});
