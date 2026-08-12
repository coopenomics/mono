/**
 * Unit-тесты BranchInteractor.selectBranch — подача заявления пайщика о выборе
 * кооперативного участка.
 *
 * Контракт `soviet::selectbranch` авторизован кооперативом целиком, поэтому
 * сверка «кто подаёт» и «на кого выписан документ» — обязанность backend:
 *   - чужой username в теле запроса → 403, на цепь ничего не уходит;
 *   - подписанное заявление на другого пайщика или на другой участок → 400;
 *   - согласованный набор → действие уходит на цепь как есть.
 */
jest.mock('~/config/config', () => ({
  __esModule: true,
  default: { coopname: 'voskhod' },
}));

import { BadRequestException } from '@nestjs/common';
import httpStatus from 'http-status';
import { HttpApiError } from '~/utils/httpApiError';
import { BranchInteractor } from '~/application/branch/use-cases/branch.interactor';

const COOP = 'voskhod';
const BRANAME = 'axslcjrlmjaq';
const DOC_HASH = 'DOC1';

function makeDocument(overrides: Record<string, any> = {}) {
  return {
    version: '1.1.0',
    hash: 'hash',
    doc_hash: DOC_HASH,
    meta_hash: 'meta_hash',
    meta: {
      title: 'Заявление пайщика о выборе кооперативного участка',
      registry_id: 101,
      lang: 'ru',
      generator: 'coopjs',
      version: '2026.8.9',
      coopname: COOP,
      username: 'ant',
      created_at: '10.08.2026 14:53',
      block_num: 1,
      timezone: 'Europe/Moscow',
      links: [],
      braname: BRANAME,
      ...overrides,
    },
    signatures: [],
  } as any;
}

function makeInteractor() {
  const documentRepository = { findByHash: jest.fn(async () => ({ doc_hash: DOC_HASH })) } as any;
  const branchBlockchainPort = { selectBranch: jest.fn(async () => ({})) } as any;

  const interactor = new BranchInteractor(
    {} as any, // paymentMethodRepository
    {} as any, // organizationRepository
    {} as any, // individualRepository
    documentRepository,
    branchBlockchainPort,
    {} as any // documentInteractor
  );

  return { interactor, documentRepository, branchBlockchainPort };
}

const input = (overrides: Record<string, any> = {}) => ({
  coopname: COOP,
  username: 'ant',
  braname: BRANAME,
  document: makeDocument(),
  ...overrides,
});

describe('BranchInteractor.selectBranch', () => {
  it('подаёт заявление за себя — действие уходит на цепь', async () => {
    const { interactor, branchBlockchainPort } = makeInteractor();

    await expect(interactor.selectBranch(input() as any, 'ant')).resolves.toBe(true);

    expect(branchBlockchainPort.selectBranch).toHaveBeenCalledTimes(1);
    const sent = branchBlockchainPort.selectBranch.mock.calls[0][0];
    expect(sent.username).toBe('ant');
    expect(sent.braname).toBe(BRANAME);
    // meta уезжает на цепь строкой
    expect(typeof sent.document.meta).toBe('string');
  });

  it('чужой пайщик в теле запроса — 403 и ничего не уходит на цепь', async () => {
    const { interactor, branchBlockchainPort } = makeInteractor();

    let thrown: unknown;
    try {
      await interactor.selectBranch(input({ username: 'ant' }) as any, 'someoneelse');
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeInstanceOf(HttpApiError);
    expect((thrown as HttpApiError).getStatus()).toBe(httpStatus.FORBIDDEN);
    expect(branchBlockchainPort.selectBranch).not.toHaveBeenCalled();
  });

  it('документ выписан на другого пайщика — 400', async () => {
    const { interactor, branchBlockchainPort } = makeInteractor();

    const data = input({ document: makeDocument({ username: 'zedthsruylcf' }) });

    await expect(interactor.selectBranch(data as any, 'ant')).rejects.toThrow(BadRequestException);
    expect(branchBlockchainPort.selectBranch).not.toHaveBeenCalled();
  });

  it('в документе другой участок, чем выбран — 400', async () => {
    const { interactor, branchBlockchainPort } = makeInteractor();

    const data = input({ document: makeDocument({ braname: 'hokfdgkscmva' }) });

    await expect(interactor.selectBranch(data as any, 'ant')).rejects.toThrow(BadRequestException);
    expect(branchBlockchainPort.selectBranch).not.toHaveBeenCalled();
  });

  it('документ не найден в реестре — 400', async () => {
    const { interactor, documentRepository, branchBlockchainPort } = makeInteractor();
    documentRepository.findByHash.mockResolvedValueOnce(null);

    await expect(interactor.selectBranch(input() as any, 'ant')).rejects.toThrow(BadRequestException);
    expect(branchBlockchainPort.selectBranch).not.toHaveBeenCalled();
  });

  it('чужой кооператив — 400', async () => {
    const { interactor, branchBlockchainPort } = makeInteractor();

    const data = input({ coopname: 'othercoop' });

    await expect(interactor.selectBranch(data as any, 'ant')).rejects.toThrow(HttpApiError);
    expect(branchBlockchainPort.selectBranch).not.toHaveBeenCalled();
  });
});
