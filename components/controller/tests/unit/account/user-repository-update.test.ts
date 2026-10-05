/**
 * Обновление аккаунта в хранилище пользователей.
 *
 * Хранилище перекладывает доменные поля в колонки записи по перечню. Добавленная
 * фотография пайщика однажды в перечень не попала: сервис отчитывался об
 * успехе, база оставалась прежней, и снимок держался до первого перехода на
 * другую страницу. Тест на сервис этого не видел — хранилище в нём подменено.
 */
import { UserKyselyRepository } from '~/infrastructure/database/kysely/repositories/user.kysely-repository';
import { recordingKysely } from '../helpers/kysely-recorder';

describe('UserKyselyRepository: обновление аккаунта', () => {
  it('записывает фотографию пайщика — ключ объекта и его тип', async () => {
    const { db, queries } = recordingKysely();
    await new UserKyselyRepository(db).updateByUsername('ant', { avatar_key: 'avatars/ant/abc.jpg', avatar_mime: 'image/jpeg' });
    expect(queries[0].sql).toContain('"avatar_key" = $1');
    expect(queries[0].sql).toContain('"avatar_mime" = $2');
    expect(queries[0].sql).toContain('where "username" = $3');
    expect(queries[0].parameters).toEqual(['avatars/ant/abc.jpg', 'image/jpeg', 'ant']);
  });

  it('снятие фотографии очищает оба поля, а не пропускает их как пустые', async () => {
    const { db, queries } = recordingKysely();
    await new UserKyselyRepository(db).updateByUsername('ant', { avatar_key: null, avatar_mime: null });
    expect(queries[0].sql).toContain('"avatar_key" = $1');
    expect(queries[0].sql).toContain('"avatar_mime" = $2');
    expect(queries[0].parameters).toEqual([null, null, 'ant']);
  });

  it('адрес почты приводится к общему виду', async () => {
    const { db, queries } = recordingKysely();
    await new UserKyselyRepository(db).updateByUsername('ant', { email: '  Ant@Example.COM ' });
    expect(queries[0].parameters).toEqual(['ant@example.com', 'ant']);
  });

  it('обновление по идентификатору переносит те же поля', async () => {
    const { db, queries } = recordingKysely();
    await new UserKyselyRepository(db).updateById('1', { avatar_key: 'avatars/ant/abc.jpg', avatar_mime: 'image/jpeg' });
    expect(queries[0].sql).toContain('where "id" = $3');
    expect(queries[0].parameters).toEqual(['avatars/ant/abc.jpg', 'image/jpeg', '1']);
  });
});
