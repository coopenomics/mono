/**
 * Фотография пайщика: одна на аккаунт, лежит в хранилище ядра, в аккаунте
 * остаётся ключ. Замена снимка убирает прежний файл, снятие возвращает
 * удостоверение к инициалам. Расширения берут ссылку через порт и своей копии
 * не держат.
 */
import { UserAvatarService } from '~/application/account/services/user-avatar.service';

const PNG = Buffer.from('фотография пайщика').toString('base64');

function make(user: { avatar_key?: string | null } = {}) {
  const bucket = {
    put: jest.fn(async () => undefined),
    delete: jest.fn(async () => undefined),
    getReadUrl: jest.fn(async (key: string) => `/backend/api/storage/core-avatars/${key}`),
  } as any;
  const stored = { username: 'ant', avatar_key: user.avatar_key ?? null };
  const users = {
    findByUsername: jest.fn(async (username: string) => (username === 'ant' ? stored : null)),
    updateByUsername: jest.fn(async (_username: string, updates: Record<string, unknown>) => {
      Object.assign(stored, updates);
      return stored;
    }),
  } as any;
  return { service: new UserAvatarService(bucket, users), bucket, users, stored };
}

describe('UserAvatarService', () => {
  it('загрузка кладёт файл в хранилище, а в аккаунт — ключ по содержимому', async () => {
    const { service, bucket, stored } = make();
    const url = await service.upload('ant', PNG, 'image/png');
    expect(bucket.put).toHaveBeenCalledTimes(1);
    const key = bucket.put.mock.calls[0][0] as string;
    expect(key).toMatch(/^avatars\/ant\/[0-9a-f]{64}\.png$/);
    expect(stored.avatar_key).toBe(key);
    expect(url).toContain(key);
  });

  it('замена снимка убирает прежний файл', async () => {
    const { service, bucket } = make({ avatar_key: 'avatars/ant/old.png' });
    await service.upload('ant', PNG, 'image/png');
    expect(bucket.delete).toHaveBeenCalledWith('avatars/ant/old.png');
  });

  it('повторная загрузка того же снимка прежний файл не удаляет — ключ тот же', async () => {
    const { service, bucket, stored } = make();
    await service.upload('ant', PNG, 'image/png');
    const key = stored.avatar_key;
    bucket.delete.mockClear();
    await service.upload('ant', PNG, 'image/png');
    expect(stored.avatar_key).toBe(key);
    expect(bucket.delete).not.toHaveBeenCalled();
  });

  it('чужой тип файла отклоняется до хранилища', async () => {
    const { service, bucket } = make();
    await expect(service.upload('ant', PNG, 'application/pdf')).rejects.toThrow(/JPEG, PNG или WEBP/);
    expect(bucket.put).not.toHaveBeenCalled();
  });

  it('снятие очищает ключ и удаляет файл; без фотографии — ничего не делает', async () => {
    const { service, bucket, stored } = make({ avatar_key: 'avatars/ant/one.png' });
    await service.remove('ant');
    expect(stored.avatar_key).toBeNull();
    expect(bucket.delete).toHaveBeenCalledWith('avatars/ant/one.png');

    bucket.delete.mockClear();
    await service.remove('ant');
    expect(bucket.delete).not.toHaveBeenCalled();
  });

  it('ссылка запрашивается у хранилища; без фотографии — пусто', async () => {
    const withPhoto = make({ avatar_key: 'avatars/ant/one.png' });
    await expect(withPhoto.service.getAvatarUrl('ant')).resolves.toContain('avatars/ant/one.png');

    const without = make();
    await expect(without.service.getAvatarUrl('ant')).resolves.toBeNull();
    await expect(without.service.getAvatarUrl('kate')).resolves.toBeNull();
  });

  it('ссылки пачкой: повторы схлопываются, безфотографийные в выдачу не попадают', async () => {
    const { service } = make({ avatar_key: 'avatars/ant/one.png' });
    const urls = await service.getAvatarUrls(['ant', 'ant', 'kate', '']);
    expect([...urls.keys()]).toEqual(['ant']);
  });

  it('уборка прежнего файла не роняет загрузку: снимок уже заменён', async () => {
    const { service, bucket, stored } = make({ avatar_key: 'avatars/ant/old.png' });
    bucket.delete.mockRejectedValueOnce(new Error('объекта уже нет'));
    await expect(service.upload('ant', PNG, 'image/png')).resolves.toContain('avatars/ant/');
    expect(stored.avatar_key).not.toBe('avatars/ant/old.png');
  });
});
