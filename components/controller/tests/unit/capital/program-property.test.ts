/**
 * Паевой взнос имуществом в «Благорост» (p.cap.prop): подача заявления,
 * подпись акта пайщиком, сборка акта и итог процесса после удаления строки.
 */
jest.mock('@coopenomics/extension-kit', () => ({
  ...jest.requireActual('@coopenomics/extension-kit'),
  verifySignedDocumentAgainstStoredDraft: jest.fn(async () => undefined),
}));
import { verifySignedDocumentAgainstStoredDraft } from '@coopenomics/extension-kit';
import { PropertyManagementInteractor, chainPropertyDescription } from '~/extensions/capital/application/use-cases/property-management.interactor';
import { PropertyManagementService } from '~/extensions/capital/application/services/property-management.service';
import { ProgramPropertySyncService } from '~/extensions/capital/application/syncers/program-property-sync.service';
import { ProgramPropertyDomainEntity } from '~/extensions/capital/domain/entities/program-property.entity';
import { ProgramPropertyStatus } from '~/extensions/capital/domain/enums/program-property-status.enum';
import { ProgramPropertyMapper } from '~/extensions/capital/infrastructure/mappers/program-property.mapper';

const HASH = 'ab'.repeat(32);

const position = {
  property_hash: HASH,
  property_name: 'Ноутбук',
  property_description: 'Исправен, с зарядным устройством',
  property_quantity: '1',
  property_unit: 'шт.',
  property_amount: '85000.0000 RUB',
};

const statement = (meta: Record<string, unknown> = {}) =>
  ({
    version: '1.0.0',
    hash: 'h',
    doc_hash: 'd',
    meta_hash: 'm',
    signatures: [],
    meta: { registry_id: 1070, coopname: 'voskhod', username: 'ant', ...position, ...meta },
  }) as any;

function property(status: string, extra: Record<string, unknown> = {}): ProgramPropertyDomainEntity {
  return new ProgramPropertyDomainEntity(
    { _id: 'x', block_num: 10, present: true, property_hash: HASH, status: status as any, blockchain_status: status } as any,
    {
      id: 1,
      coopname: 'voskhod',
      username: 'ant',
      status,
      property_hash: HASH,
      property_amount: '85000.0000 RUB',
      property_description: 'Ноутбук',
      statement: statement(),
      authorization: { meta: { decision_id: 7 } },
      act: undefined,
      created_at: '2026-10-30T00:00:00.000Z',
      ...extra,
    } as any
  );
}

function setup(found: ProgramPropertyDomainEntity | null = null) {
  const port = {
    createProgramProperty: jest.fn(async () => ({ ok: 'create' })),
    signProgramPropertyAct1: jest.fn(async () => ({ ok: 'act1' })),
  } as any;
  const utils = { convertSignedDocumentToBlockchainFormat: jest.fn((d: unknown) => d) } as any;
  const repo = {
    findBySyncKey: jest.fn(async () => found),
    findAllPaginated: jest.fn(),
    update: jest.fn(async (e: unknown) => e),
  } as any;
  return { port, repo, interactor: new PropertyManagementInteractor(port, utils, repo) };
}

const actInput = (meta: Record<string, unknown> = {}) =>
  ({
    coopname: 'voskhod',
    username: 'ant',
    property_hash: HASH,
    act: { doc_hash: 'a', meta: { registry_id: 1072, property_hash: HASH.toUpperCase(), ...meta } },
  }) as any;

describe('Паевой взнос имуществом: заявление', () => {
  it('позиция, оценка и хэш берутся из подписанного заявления; описание в цепи — одной строкой', async () => {
    const { interactor, port } = setup();
    await interactor.createProgramProperty({ coopname: 'voskhod', username: 'ant', statement: statement({ property_hash: HASH.toUpperCase() }) });

    const sent = port.createProgramProperty.mock.calls[0][0];
    expect(sent.property_hash).toBe(HASH);
    expect(sent.property_amount).toBe('85000.0000 RUB');
    expect(sent.property_description).toBe('Ноутбук. Исправен, с зарядным устройством. Количество: 1 шт.');
    expect(sent.property_description).toBe(chainPropertyDescription(position));
  });

  it('чужой документ вместо заявления 1070 — отказ до цепи', async () => {
    const { interactor, port } = setup();
    await expect(
      interactor.createProgramProperty({ coopname: 'voskhod', username: 'ant', statement: statement({ registry_id: 1040 }) })
    ).rejects.toMatchObject({ code: 'CAPITAL_PROPERTY_STATEMENT_INVALID' });
    expect(port.createProgramProperty).not.toHaveBeenCalled();
  });

  it('заявление составлено на другого пайщика — отказ до цепи', async () => {
    const { interactor, port } = setup();
    await expect(
      interactor.createProgramProperty({ coopname: 'voskhod', username: 'bob', statement: statement() })
    ).rejects.toMatchObject({ code: 'CAPITAL_PROPERTY_STATEMENT_MISMATCH' });
    expect(port.createProgramProperty).not.toHaveBeenCalled();
  });

  it('сервис сверяет заявление с черновиком из хранилища и валюту оценки до цепи', async () => {
    const interactor = { createProgramProperty: jest.fn(async () => 'tx') } as any;
    const documentPort = { getByHash: jest.fn() } as any;
    const service = new PropertyManagementService(interactor, documentPort);

    await expect(service.createProgramProperty({ coopname: 'voskhod', username: 'ant', statement: statement() })).resolves.toBe('tx');
    expect(verifySignedDocumentAgainstStoredDraft).toHaveBeenCalled();

    await expect(
      service.createProgramProperty({ coopname: 'voskhod', username: 'ant', statement: statement({ property_amount: '100.0000 USD' }) })
    ).rejects.toBeDefined();
  });
});

describe('Паевой взнос имуществом: акт приёма-передачи', () => {
  it('пайщик подписывает акт после решения совета — в цепь направляется act1pgprp с хэшем взноса', async () => {
    const { interactor, port } = setup(property('authorized'));
    await interactor.signProgramPropertyAct(actInput());
    expect(port.signProgramPropertyAct1).toHaveBeenCalledWith(expect.objectContaining({ property_hash: HASH, username: 'ant' }));
  });

  it('до решения совета акт не подписывается — отказ до цепи', async () => {
    const { interactor, port } = setup(property('approved'));
    await expect(interactor.signProgramPropertyAct(actInput())).rejects.toMatchObject({ code: 'CAPITAL_PROPERTY_NOT_AUTHORIZED' });
    expect(port.signProgramPropertyAct1).not.toHaveBeenCalled();
  });

  it('чужой пайщик акт не подписывает', async () => {
    const { interactor, port } = setup(property('authorized'));
    await expect(interactor.signProgramPropertyAct({ ...actInput(), username: 'bob' })).rejects.toMatchObject({
      code: 'CAPITAL_PROPERTY_NOT_OWNER',
    });
    expect(port.signProgramPropertyAct1).not.toHaveBeenCalled();
  });

  it('акт по другому взносу или не акт 1072 — отказ', async () => {
    const { interactor } = setup(property('authorized'));
    await expect(interactor.signProgramPropertyAct(actInput({ property_hash: 'cd'.repeat(32) }))).rejects.toMatchObject({
      code: 'CAPITAL_PROPERTY_ACT_MISMATCH',
    });
    await expect(interactor.signProgramPropertyAct(actInput({ registry_id: 1042 }))).rejects.toMatchObject({
      code: 'CAPITAL_PROPERTY_ACT_MISMATCH',
    });
  });

  it('взнос, которого нет или который уже завершён, — не найден', async () => {
    await expect(setup(null).interactor.signProgramPropertyAct(actInput())).rejects.toMatchObject({ code: 'CAPITAL_PROPERTY_NOT_FOUND' });
    const finished = property('authorized');
    finished.markFinal(ProgramPropertyStatus.ACT2);
    await expect(setup(finished).interactor.signProgramPropertyAct(actInput())).rejects.toMatchObject({
      code: 'CAPITAL_PROPERTY_NOT_FOUND',
    });
  });

  it('данные акта: позиция из заявления, номер решения из протокола совета', async () => {
    const { interactor } = setup(property('authorized'));
    await expect(interactor.buildActGenerationData({ coopname: 'voskhod', username: 'ant', property_hash: HASH })).resolves.toEqual({
      coopname: 'voskhod',
      username: 'ant',
      registry_id: 1072,
      decision_id: 7,
      ...position,
    });
  });

  it('протокола совета нет — акт не собирается', async () => {
    const { interactor } = setup(property('authorized', { authorization: undefined }));
    await expect(interactor.buildActGenerationData({ coopname: 'voskhod', username: 'ant', property_hash: HASH })).rejects.toMatchObject({
      code: 'CAPITAL_PROPERTY_DECISION_MISSING',
    });
  });

  it('акт генерируется с сохранением тела: вторая подпись председателя ложится на этот документ', async () => {
    const interactor = { buildActGenerationData: jest.fn(async () => ({ registry_id: 1072 })) } as any;
    const documentPort = { generate: jest.fn(async () => ({})) } as any;
    await new PropertyManagementService(interactor, documentPort).generateCapitalizationPropertyInvestAct(
      { coopname: 'voskhod', username: 'ant', property_hash: HASH },
      { skip_save: true } as any
    );
    expect(documentPort.generate).toHaveBeenCalledWith({ data: { registry_id: 1072 }, options: { skip_save: false } });
  });

  it('сервис сверяет подписанный акт с черновиком из хранилища', async () => {
    (verifySignedDocumentAgainstStoredDraft as jest.Mock).mockClear();
    const interactor = { signProgramPropertyAct: jest.fn(async () => 'tx') } as any;
    await new PropertyManagementService(interactor, { getByHash: jest.fn() } as any).signProgramPropertyAct(actInput());
    expect(verifySignedDocumentAgainstStoredDraft).toHaveBeenCalledTimes(1);
  });
});

describe('Паевой взнос имуществом: итог после удаления строки в цепи', () => {
  function syncer(found: ProgramPropertyDomainEntity | null) {
    const repo = { findBySyncKey: jest.fn(async () => found), update: jest.fn(async (e: unknown) => e) } as any;
    const logger = { setContext: jest.fn(), debug: jest.fn(), error: jest.fn(), log: jest.fn(), warn: jest.fn() } as any;
    return { repo, service: new ProgramPropertySyncService(repo, {} as any, logger, {} as any) };
  }
  const action = (name: string, receiver = 'capital') =>
    ({ account: 'capital', receiver, name, data: { property_hash: HASH.toUpperCase() } }) as any;

  it('приём акта председателем (act2pgprp) — статус «принято»', async () => {
    const { repo, service } = syncer(property('act1'));
    await service.handleAccepted(action('act2pgprp'));
    expect(repo.update.mock.calls[0][0]).toMatchObject({ status: ProgramPropertyStatus.ACT2, present: false });
  });

  it('отказ (declinepgprp) — статус «отклонено»', async () => {
    const { repo, service } = syncer(property('act1'));
    await service.handleDeclined(action('declinepgprp'));
    expect(repo.findBySyncKey).toHaveBeenCalledWith('property_hash', HASH);
    expect(repo.update.mock.calls[0][0]).toMatchObject({ status: ProgramPropertyStatus.DECLINED });
  });

  it('уведомление получателю того же действия итог повторно не пишет', async () => {
    const { repo, service } = syncer(property('act1'));
    await service.handleAccepted(action('act2pgprp', 'ant'));
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('статус «отклонено» переживает чтение записи из базы', () => {
    const entity = property('act1');
    entity.markFinal(ProgramPropertyStatus.DECLINED);
    const record = { ...ProgramPropertyMapper.toEntity(entity), created_at: new Date('2026-10-30T00:00:00Z') } as any;
    expect(ProgramPropertyMapper.toDomain(record).status).toBe(ProgramPropertyStatus.DECLINED);
  });
});
