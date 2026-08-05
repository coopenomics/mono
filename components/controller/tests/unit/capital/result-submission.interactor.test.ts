/**
 * Unit-тесты ResultSubmissionInteractor — доменный слой приёма РИД
 * (процесс p.cap.rid, слайс result_submission).
 *
 * Что здесь защищается. Интерактор — последняя точка, где значения ещё можно
 * подменить до отправки в цепь. Контракт проверяет `result.username == username`
 * и требует подписи ровно от нужных лиц, но эта защита работает только пока
 * бэкенд подставляет username из сессии, а не из клиентского ввода. Тесты
 * фиксируют именно это, а не факт вызова порта.
 *
 * Реестр случаев: test-registry/capital.result-submission.yaml
 */

import { Classes } from '@coopenomics/sdk';
import { ResultSubmissionInteractor } from '~/extensions/capital/application/use-cases/result-submission.interactor';
import { ProjectOrigin } from '~/extensions/capital/domain/enums/project-origin.enum';

function makeLoggerStub() {
  return {
    setContext: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as any;
}

/** Документ в том виде, в каком он доходит до интерактора: домен, ещё не цепь. */
function makeSignedDocument(overrides: Record<string, any> = {}) {
  return {
    version: '2',
    hash: 'doc-hash',
    doc_hash: 'doc-hash',
    meta_hash: 'meta-hash',
    meta: { foo: 'bar' },
    signatures: [],
    ...overrides,
  } as any;
}

type Overrides = {
  project?: any;
  result?: any;
  segment?: any;
  transactResult?: any;
};

function makeInteractor(o: Overrides = {}) {
  const project = 'project' in o ? o.project : { project_hash: 'ph', origin: ProjectOrigin.BLOCKCHAIN };
  const transactResult = o.transactResult ?? { transaction_id: 'tx-1' };

  const capitalBlockchainPort = {
    pushResult: jest.fn(async () => transactResult),
    convertSegment: jest.fn(async () => transactResult),
    signAct1: jest.fn(async () => transactResult),
    signAct2: jest.fn(async () => transactResult),
  } as any;

  const resultRepository = {
    findByResultHash: jest.fn(async () => ('result' in o ? o.result : { project_hash: 'ph', username: 'alice' })),
    findAllPaginated: jest.fn(),
    findById: jest.fn(),
  } as any;

  const segmentRepository = {
    markAsCompleted: jest.fn(async () => ('segment' in o ? o.segment : { username: 'alice' })),
  } as any;

  const projectRepository = {
    findByHash: jest.fn(async () => project),
  } as any;

  const domainToBlockchainUtils = {
    // Ровно то, что делает настоящая утилита со значимой для нас частью:
    // meta сериализуется. Подмена документа тестами не проверяется.
    convertSignedDocumentToBlockchainFormat: jest.fn((doc: any) => ({ ...doc, meta: JSON.stringify(doc.meta) })),
  } as any;

  const segmentSyncService = {
    syncSegment: jest.fn(async () => ('segment' in o ? o.segment : { username: 'alice' })),
  } as any;

  const resultSyncService = {
    syncResult: jest.fn(async () => undefined),
  } as any;

  const interactor = new ResultSubmissionInteractor(
    capitalBlockchainPort,
    resultRepository,
    segmentRepository,
    projectRepository,
    domainToBlockchainUtils,
    segmentSyncService,
    resultSyncService,
    makeLoggerStub()
  );

  return {
    interactor,
    capitalBlockchainPort,
    resultRepository,
    segmentRepository,
    projectRepository,
    domainToBlockchainUtils,
    segmentSyncService,
    resultSyncService,
  };
}

function pushInput(overrides: Record<string, any> = {}) {
  return {
    coopname: 'coop',
    username: 'alice',
    project_hash: 'PH',
    result_hash: 'rh',
    contribution_amount: '100.0000 RUB',
    debt_amount: '0.0000 RUB',
    statement: makeSignedDocument(),
    debt_hashes: [],
    ...overrides,
  } as any;
}

describe('ResultSubmissionInteractor', () => {
  describe('pushResult', () => {
    // cap.rid.side.28
    it('отклоняет персональный LOCAL-проект до обращения к цепи', async () => {
      const { interactor, capitalBlockchainPort } = makeInteractor({
        project: { project_hash: 'ph', origin: ProjectOrigin.LOCAL },
      });

      await expect(interactor.pushResult(pushInput())).rejects.toThrow('внесение результата');
      expect(capitalBlockchainPort.pushResult).not.toHaveBeenCalled();
    });

    it('отклоняет отсутствующий проект до обращения к цепи', async () => {
      const { interactor, capitalBlockchainPort } = makeInteractor({ project: null });

      await expect(interactor.pushResult(pushInput())).rejects.toThrow('Проект не найден');
      expect(capitalBlockchainPort.pushResult).not.toHaveBeenCalled();
    });

    it('ищет проект по хэшу в нижнем регистре', async () => {
      const { interactor, projectRepository } = makeInteractor();

      await interactor.pushResult(pushInput({ project_hash: 'PH' }));

      expect(projectRepository.findByHash).toHaveBeenCalledWith('ph');
    });

    // cap.rid.break.01
    it('падает, если сегмент не синхронизировался после приёма цепью', async () => {
      const { interactor } = makeInteractor({ segment: null });

      await expect(interactor.pushResult(pushInput())).rejects.toThrow(
        'Не удалось синхронизировать сегмент PH:alice после внесения результата'
      );
    });

    it('синхронизирует результат раньше сегмента и возвращает сегмент', async () => {
      const segment = { username: 'alice', project_hash: 'ph' };
      const { interactor, resultSyncService, segmentSyncService } = makeInteractor({ segment });
      const order: string[] = [];
      resultSyncService.syncResult.mockImplementation(async () => {
        order.push('result');
      });
      segmentSyncService.syncSegment.mockImplementation(async () => {
        order.push('segment');
        return segment;
      });

      const returned = await interactor.pushResult(pushInput());

      expect(order).toEqual(['result', 'segment']);
      expect(returned).toBe(segment);
      expect(resultSyncService.syncResult).toHaveBeenCalledWith('rh', { transaction_id: 'tx-1' });
    });

    it('передаёт в цепь заявление в блокчейн-формате, сохраняя остальные поля', async () => {
      const { interactor, capitalBlockchainPort } = makeInteractor();

      await interactor.pushResult(pushInput());

      const sent = capitalBlockchainPort.pushResult.mock.calls[0][0];
      expect(sent.username).toBe('alice');
      expect(sent.contribution_amount).toBe('100.0000 RUB');
      expect(sent.statement.meta).toBe(JSON.stringify({ foo: 'bar' }));
    });
  });

  describe('convertSegment', () => {
    // cap.rid.break.02
    it('падает, если сегмент не удалось пометить завершённым после конвертации в цепи', async () => {
      const { interactor } = makeInteractor({ segment: null });

      await expect(
        interactor.convertSegment(
          {
            coopname: 'coop',
            username: 'alice',
            project_hash: 'PH',
            result_hash: 'rh',
            wallet_amount: '0.0000 RUB',
            capital_amount: '100.0000 RUB',
            convert_statement: makeSignedDocument(),
          } as any,
          { username: 'alice' } as any
        )
      ).rejects.toThrow('Не удалось найти сегмент PH:alice для установки флага завершения после конвертации');
    });

    it('ищет проект по хэшу в нижнем регистре', async () => {
      const { interactor, projectRepository } = makeInteractor();

      await interactor.convertSegment(
        {
          coopname: 'coop',
          username: 'alice',
          project_hash: 'PH',
          result_hash: 'rh',
          wallet_amount: '0.0000 RUB',
          capital_amount: '100.0000 RUB',
          convert_statement: makeSignedDocument(),
        } as any,
        { username: 'alice' } as any
      );

      expect(projectRepository.findByHash).toHaveBeenCalledWith('ph');
    });

    it('передаёт в цепь заявление о конвертации в блокчейн-формате и суммы без изменений', async () => {
      const { interactor, capitalBlockchainPort } = makeInteractor();

      await interactor.convertSegment(
        {
          coopname: 'coop',
          username: 'alice',
          project_hash: 'PH',
          result_hash: 'rh',
          wallet_amount: '30.0000 RUB',
          capital_amount: '70.0000 RUB',
          convert_statement: makeSignedDocument(),
        } as any,
        { username: 'alice' } as any
      );

      const sent = capitalBlockchainPort.convertSegment.mock.calls[0][0];
      expect(sent.username).toBe('alice');
      expect(sent.wallet_amount).toBe('30.0000 RUB');
      expect(sent.capital_amount).toBe('70.0000 RUB');
      expect(sent.convert_statement.meta).toBe(JSON.stringify({ foo: 'bar' }));
    });

    it('помечает сегмент завершённым, а не пересинхронизирует его из цепи', async () => {
      // После convertsegm запись сегмента в цепи удалена — читать оттуда нечего.
      const segment = { username: 'alice' };
      const { interactor, segmentRepository, segmentSyncService } = makeInteractor({ segment });

      const returned = await interactor.convertSegment(
        {
          coopname: 'coop',
          username: 'alice',
          project_hash: 'PH',
          result_hash: 'rh',
          wallet_amount: '0.0000 RUB',
          capital_amount: '100.0000 RUB',
          convert_statement: makeSignedDocument(),
        } as any,
        { username: 'alice' } as any
      );

      expect(segmentRepository.markAsCompleted).toHaveBeenCalledWith('coop', 'PH', 'alice');
      expect(segmentSyncService.syncSegment).not.toHaveBeenCalled();
      expect(returned).toBe(segment);
    });

    it('отклоняет персональный LOCAL-проект до обращения к цепи', async () => {
      const { interactor, capitalBlockchainPort } = makeInteractor({
        project: { project_hash: 'ph', origin: ProjectOrigin.LOCAL },
      });

      await expect(
        interactor.convertSegment(
          {
            coopname: 'coop',
            username: 'alice',
            project_hash: 'PH',
            result_hash: 'rh',
            wallet_amount: '0.0000 RUB',
            capital_amount: '100.0000 RUB',
            convert_statement: makeSignedDocument(),
          } as any,
          { username: 'alice' } as any
        )
      ).rejects.toThrow('конвертацию сегмента');
      expect(capitalBlockchainPort.convertSegment).not.toHaveBeenCalled();
    });
  });

  describe('signActAsContributor', () => {
    // cap.rid.side.32
    it('отклоняет result_hash, которого нет в базе', async () => {
      const { interactor, capitalBlockchainPort } = makeInteractor({ result: null });

      await expect(
        interactor.signActAsContributor({
          coopname: 'coop',
          username: 'alice',
          result_hash: 'rh',
          act: makeSignedDocument(),
        } as any)
      ).rejects.toThrow('Результат с хэшем rh не найден или не содержит project_hash');
      expect(capitalBlockchainPort.signAct1).not.toHaveBeenCalled();
    });

    it('отклоняет результат без project_hash', async () => {
      const { interactor, capitalBlockchainPort } = makeInteractor({ result: { username: 'alice' } });

      await expect(
        interactor.signActAsContributor({
          coopname: 'coop',
          username: 'alice',
          result_hash: 'rh',
          act: makeSignedDocument(),
        } as any)
      ).rejects.toThrow('не найден или не содержит project_hash');
      expect(capitalBlockchainPort.signAct1).not.toHaveBeenCalled();
    });

    // cap.rid.side.33
    it('требует подпись ровно того пользователя, чьё имя пришло из сессии', async () => {
      const spy = jest.spyOn(Classes.Document, 'assertDocumentSignatures').mockImplementation(() => undefined);
      const { interactor } = makeInteractor();
      const act = makeSignedDocument();

      await interactor.signActAsContributor({
        coopname: 'coop',
        username: 'alice',
        result_hash: 'rh',
        act,
      } as any);

      expect(spy).toHaveBeenCalledWith(act, ['alice']);
    });

    it('не отправляет акт в цепь, если проверка подписей не прошла', async () => {
      jest.spyOn(Classes.Document, 'assertDocumentSignatures').mockImplementation(() => {
        throw new Error('Отсутствует подпись');
      });
      const { interactor, capitalBlockchainPort } = makeInteractor();

      await expect(
        interactor.signActAsContributor({
          coopname: 'coop',
          username: 'alice',
          result_hash: 'rh',
          act: makeSignedDocument(),
        } as any)
      ).rejects.toThrow('Отсутствует подпись');
      expect(capitalBlockchainPort.signAct1).not.toHaveBeenCalled();
    });

    it('синхронизирует сегмент по project_hash из результата, а не из клиентского ввода', async () => {
      jest.spyOn(Classes.Document, 'assertDocumentSignatures').mockImplementation(() => undefined);
      const { interactor, segmentSyncService } = makeInteractor({
        result: { project_hash: 'ph-from-db', username: 'alice' },
      });

      await interactor.signActAsContributor({
        coopname: 'coop',
        username: 'alice',
        result_hash: 'rh',
        act: makeSignedDocument(),
      } as any);

      expect(segmentSyncService.syncSegment).toHaveBeenCalledWith('coop', 'ph-from-db', 'alice', {
        transaction_id: 'tx-1',
      });
    });

    it('передаёт в цепь акт в блокчейн-формате и хэш результата', async () => {
      jest.spyOn(Classes.Document, 'assertDocumentSignatures').mockImplementation(() => undefined);
      const { interactor, capitalBlockchainPort } = makeInteractor();

      await interactor.signActAsContributor({
        coopname: 'coop',
        username: 'alice',
        result_hash: 'rh',
        act: makeSignedDocument(),
      } as any);

      const sent = capitalBlockchainPort.signAct1.mock.calls[0][0];
      expect(sent.coopname).toBe('coop');
      expect(sent.username).toBe('alice');
      expect(sent.result_hash).toBe('rh');
      expect(sent.act.meta).toBe(JSON.stringify({ foo: 'bar' }));
    });

    it('падает, если сегмент не синхронизировался после подписания', async () => {
      jest.spyOn(Classes.Document, 'assertDocumentSignatures').mockImplementation(() => undefined);
      const { interactor } = makeInteractor({ segment: null });

      await expect(
        interactor.signActAsContributor({
          coopname: 'coop',
          username: 'alice',
          result_hash: 'rh',
          act: makeSignedDocument(),
        } as any)
      ).rejects.toThrow('после подписания акта участником');
    });
  });

  describe('signActAsChairman', () => {
    // cap.rid.side.36
    it('отклоняет результат без username', async () => {
      const { interactor, capitalBlockchainPort } = makeInteractor({ result: { project_hash: 'ph' } });

      await expect(
        interactor.signActAsChairman({
          coopname: 'coop',
          chairman: 'bob',
          result_hash: 'rh',
          act: makeSignedDocument(),
        } as any)
      ).rejects.toThrow('Результат с хэшем rh не найден или не содержит username');
      expect(capitalBlockchainPort.signAct2).not.toHaveBeenCalled();
    });

    // cap.rid.side.37 — исправлено: project_hash проверяется наравне с username
    it('отклоняет результат без project_hash, а не синхронизирует по пустому хэшу', async () => {
      const { interactor, capitalBlockchainPort, segmentSyncService } = makeInteractor({
        result: { username: 'alice' },
      });

      await expect(
        interactor.signActAsChairman({
          coopname: 'coop',
          chairman: 'bob',
          result_hash: 'rh',
          act: makeSignedDocument(),
        } as any)
      ).rejects.toThrow('Результат с хэшем rh не найден или не содержит username и project_hash');
      expect(capitalBlockchainPort.signAct2).not.toHaveBeenCalled();
      expect(segmentSyncService.syncSegment).not.toHaveBeenCalled();
    });

    // cap.rid.side.35
    it('требует обе подписи — участника из базы и председателя из сессии', async () => {
      const spy = jest.spyOn(Classes.Document, 'assertDocumentSignatures').mockImplementation(() => undefined);
      const { interactor } = makeInteractor({ result: { project_hash: 'ph', username: 'alice' } });
      const act = makeSignedDocument();

      await interactor.signActAsChairman({
        coopname: 'coop',
        chairman: 'bob',
        result_hash: 'rh',
        act,
      } as any);

      expect(spy).toHaveBeenCalledWith(act, ['alice', 'bob']);
    });

    // cap.rid.side.34
    it('подставляет в цепь участника из базы, игнорируя username из запроса', async () => {
      jest.spyOn(Classes.Document, 'assertDocumentSignatures').mockImplementation(() => undefined);
      const { interactor, capitalBlockchainPort } = makeInteractor({
        result: { project_hash: 'ph', username: 'alice' },
      });

      await interactor.signActAsChairman({
        coopname: 'coop',
        chairman: 'bob',
        result_hash: 'rh',
        username: 'mallory',
        act: makeSignedDocument(),
      } as any);

      const sent = capitalBlockchainPort.signAct2.mock.calls[0][0];
      expect(sent.username).toBe('alice');
      expect(sent.chairman).toBe('bob');
    });

    it('синхронизирует сегмент по проекту и участнику из результата, а не из запроса', async () => {
      jest.spyOn(Classes.Document, 'assertDocumentSignatures').mockImplementation(() => undefined);
      const { interactor, segmentSyncService } = makeInteractor({
        result: { project_hash: 'ph-from-db', username: 'alice' },
      });

      await interactor.signActAsChairman({
        coopname: 'coop',
        chairman: 'bob',
        result_hash: 'rh',
        project_hash: 'подложный',
        username: 'mallory',
        act: makeSignedDocument(),
      } as any);

      expect(segmentSyncService.syncSegment).toHaveBeenCalledWith('coop', 'ph-from-db', 'alice', {
        transaction_id: 'tx-1',
      });
    });

    it('падает, если сегмент не синхронизировался после подписания председателем', async () => {
      jest.spyOn(Classes.Document, 'assertDocumentSignatures').mockImplementation(() => undefined);
      const { interactor } = makeInteractor({
        result: { project_hash: 'ph', username: 'alice' },
        segment: null,
      });

      await expect(
        interactor.signActAsChairman({
          coopname: 'coop',
          chairman: 'bob',
          result_hash: 'rh',
          act: makeSignedDocument(),
        } as any)
      ).rejects.toThrow('Не удалось синхронизировать сегмент ph:alice после подписания акта председателем');
    });

    it('не синхронизирует результат: в цепи его уже нет отдельной записью', async () => {
      jest.spyOn(Classes.Document, 'assertDocumentSignatures').mockImplementation(() => undefined);
      const { interactor, resultSyncService } = makeInteractor({
        result: { project_hash: 'ph', username: 'alice' },
      });

      await interactor.signActAsChairman({
        coopname: 'coop',
        chairman: 'bob',
        result_hash: 'rh',
        act: makeSignedDocument(),
      } as any);

      expect(resultSyncService.syncResult).not.toHaveBeenCalled();
    });

    it('не отправляет акт в цепь, если проверка подписей не прошла', async () => {
      jest.spyOn(Classes.Document, 'assertDocumentSignatures').mockImplementation(() => {
        throw new Error('Нет подписи председателя');
      });
      const { interactor, capitalBlockchainPort } = makeInteractor({
        result: { project_hash: 'ph', username: 'alice' },
      });

      await expect(
        interactor.signActAsChairman({
          coopname: 'coop',
          chairman: 'bob',
          result_hash: 'rh',
          act: makeSignedDocument(),
        } as any)
      ).rejects.toThrow('Нет подписи председателя');
      expect(capitalBlockchainPort.signAct2).not.toHaveBeenCalled();
    });
  });
});
