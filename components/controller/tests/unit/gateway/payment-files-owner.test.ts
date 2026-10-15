/**
 * Чек платежа по номеру файла читают совет и сам плательщик. Номера файлов
 * идут подряд, поэтому без проверки чужие чеки перебирались бы по номеру.
 * Сверку ведёт гард операции по таблице прав ядра (`PaymentFile:read`,
 * владелец — плательщик платежа); сервис отдаёт файл и отвечает «не найден».
 */
import { NotFoundException } from '@nestjs/common';
import { OWN, makeGuard, requirementOf } from '../rights/core-rights.harness';
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

const RESOLVER = 'gateway/resolvers/payment-files.resolver.ts';
const bob = { username: 'bob', role: 'user', status: 'active' };
const mallory = { username: 'mallory', role: 'user', status: 'active' };
const member = { username: 'kim', role: 'member', status: 'active' };

describe('файлы платежа: кто читает', () => {
  const stand = { payments: { [HASH]: 'bob' }, files: { 1: HASH } };
  const byFile = requirementOf(RESOLVER, 'paymentFile');
  const byPayment = requirementOf(RESOLVER, 'paymentProofs');

  it('плательщик получает ссылку на свой чек и список чеков', async () => {
    const { pass } = makeGuard(stand);
    const { service } = build();
    await expect(pass(byFile, bob, { id: 1 })).resolves.toBe(true);
    await expect(pass(byPayment, bob, { coopname: 'voskhod', payment_hash: HASH })).resolves.toBe(true);
    await expect(service.getReadUrl(1)).resolves.toMatchObject({ readUrl: 'https://files/x' });
    await expect(service.listByPayment('voskhod', HASH)).resolves.toHaveLength(1);
  });

  it('другой пайщик — отказ до входа в операцию', async () => {
    const { pass } = makeGuard(stand);
    await expect(pass(byFile, mallory, { id: 1 })).rejects.toMatchObject(OWN);
    await expect(pass(byPayment, mallory, { coopname: 'voskhod', payment_hash: HASH })).rejects.toMatchObject(OWN);
  });

  it('совет читает любой чек', async () => {
    const { pass } = makeGuard(stand);
    await expect(pass(byFile, member, { id: 1 })).resolves.toBe(true);
  });

  it('несуществующий файл — «не найден» отвечает сама операция', async () => {
    const { pass } = makeGuard(stand);
    const { service } = build();
    await expect(pass(byFile, mallory, { id: 2 })).resolves.toBe(true);
    await expect(service.getReadUrl(2)).rejects.toBeInstanceOf(NotFoundException);
  });
});
