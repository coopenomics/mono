/**
 * Чек платежа по номеру файла читают совет и сам плательщик. Номера файлов
 * идут подряд, поэтому без проверки чужие чеки перебирались бы по номеру.
 */
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PaymentFilesService } from '~/application/gateway/services/payment-files.service';

const HASH = 'a'.repeat(64);

function build() {
  const bucket = { getReadUrl: jest.fn().mockResolvedValue('https://files/x') };
  const files = {
    findById: jest.fn(async (id: number) => (id === 1 ? { id: 1, payment_hash: HASH, storage_key: 'k' } : null)),
    findByPayment: jest.fn().mockResolvedValue([{ id: 1, payment_hash: HASH, storage_key: 'k' }]),
  };
  const payments = { findByHash: jest.fn(async (hash: string) => (hash === HASH ? { username: 'bob' } : null)) };
  const service = new PaymentFilesService(bucket as any, files as any, payments as any);
  return { service, bucket };
}

const bob = { username: 'bob', role: 'user' } as any;
const mallory = { username: 'mallory', role: 'user' } as any;
const member = { username: 'kim', role: 'member' } as any;

describe('файлы платежа: кто читает', () => {
  it('плательщик получает ссылку на свой чек и список чеков', async () => {
    const { service } = build();
    await expect(service.getReadUrl(1, bob)).resolves.toMatchObject({ readUrl: 'https://files/x' });
    await expect(service.listByPayment('voskhod', HASH, bob)).resolves.toHaveLength(1);
  });

  it('другой пайщик — отказ, ссылка не выдаётся', async () => {
    const { service, bucket } = build();
    await expect(service.getReadUrl(1, mallory)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.listByPayment('voskhod', HASH, mallory)).rejects.toBeInstanceOf(ForbiddenException);
    expect(bucket.getReadUrl).not.toHaveBeenCalled();
  });

  it('совет читает любой чек', async () => {
    const { service } = build();
    await expect(service.getReadUrl(1, member)).resolves.toBeDefined();
  });

  it('несуществующий файл — «не найден» до проверки владельца', async () => {
    const { service } = build();
    await expect(service.getReadUrl(2, mallory)).rejects.toBeInstanceOf(NotFoundException);
  });
});
