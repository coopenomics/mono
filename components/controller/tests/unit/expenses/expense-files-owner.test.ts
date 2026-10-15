/**
 * Файлы расхода (платёжки, чеки) доступны совету, подавшему смету и
 * получателю строки. Роль `user` в guard'е этого не различает, а номера
 * файлов идут подряд.
 */
import { ForbiddenException } from '@nestjs/common';
import { ExpenseFilesService } from '~/extensions/expenses/application/services/expense-files.service';

const PROPOSAL = 'a'.repeat(64);
const ITEM = 'b'.repeat(64);
const OTHER_ITEM = 'c'.repeat(64);

function build() {
  const bucket = { getReadUrl: jest.fn().mockResolvedValue('https://files/x'), put: jest.fn() };
  const files = {
    findById: jest.fn(async (id: number) =>
      id === 1
        ? { id: 1, proposal_hash: PROPOSAL, item_hash: ITEM, storage_key: 'k' }
        : id === 2
          ? { id: 2, proposal_hash: PROPOSAL, item_hash: null, storage_key: 'k2' }
          : null
    ),
    findByProposal: jest.fn().mockResolvedValue([]),
    findByItem: jest.fn().mockResolvedValue([]),
  };
  const payments = {};
  const proposals = {
    findByProposalHash: jest.fn(async (hash: string) =>
      hash === PROPOSAL
        ? {
            username: 'initiator',
            items: [
              { item_hash: ITEM, recipient: 'bob' },
              { item_hash: OTHER_ITEM, recipient: 'carol' },
            ],
          }
        : null
    ),
  };
  const service = new ExpenseFilesService(bucket as any, files as any, payments as any, proposals as any);
  return { service, bucket };
}

const bob = { username: 'bob', role: 'user' } as any;
const carol = { username: 'carol', role: 'user' } as any;
const initiator = { username: 'initiator', role: 'user' } as any;
const mallory = { username: 'mallory', role: 'user' } as any;
const chairman = { username: 'ant', role: 'chairman' } as any;

describe('файлы расхода: кто читает', () => {
  it('получатель строки читает файл своей строки', async () => {
    const { service } = build();
    await expect(service.getReadUrl(1, bob)).resolves.toMatchObject({ readUrl: 'https://files/x' });
    await expect(service.listByItem('voskhod', PROPOSAL, ITEM, bob)).resolves.toEqual([]);
  });

  it('получатель другой строки той же сметы — отказ по строке, доступ к файлам уровня сметы', async () => {
    const { service } = build();
    await expect(service.getReadUrl(1, carol)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.getReadUrl(2, carol)).resolves.toBeDefined();
    await expect(service.listByProposal('voskhod', PROPOSAL, carol)).resolves.toEqual([]);
  });

  it('подавший смету и совет читают всё', async () => {
    const { service } = build();
    await expect(service.getReadUrl(1, initiator)).resolves.toBeDefined();
    await expect(service.getReadUrl(1, chairman)).resolves.toBeDefined();
  });

  it('посторонний пайщик — отказ везде, ссылка не выдаётся', async () => {
    const { service, bucket } = build();
    await expect(service.getReadUrl(1, mallory)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.getReadUrl(2, mallory)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.listByProposal('voskhod', PROPOSAL, mallory)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.listByItem('voskhod', PROPOSAL, ITEM, mallory)).rejects.toBeInstanceOf(ForbiddenException);
    expect(bucket.getReadUrl).not.toHaveBeenCalled();
  });

  it('загрузка в чужую смету — отказ до записи в хранилище', async () => {
    const { service, bucket } = build();
    const input = {
      coopname: 'voskhod',
      proposal_hash: PROPOSAL,
      item_hash: ITEM,
      kind: 'PAYMENT_PROOF',
      mime_type: 'image/png',
      size_bytes: 1,
      checksum_sha256: 'd'.repeat(64),
      content_base64: 'AA==',
    } as any;
    await expect(service.uploadFile(input, mallory)).rejects.toBeInstanceOf(ForbiddenException);
    expect(bucket.put).not.toHaveBeenCalled();
  });
});
