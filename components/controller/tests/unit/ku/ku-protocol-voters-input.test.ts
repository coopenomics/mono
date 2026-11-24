import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  BranchMeetingDecisionGenerateDocumentInputDTO,
  BranchMeetingDecisionSignedMetaDocumentInputDTO,
} from '~/extensions/ku/application/dto/ku-documents.dto';

/**
 * Протокол собрания пайщиков участка (323) со списком «Присутствовали пайщики».
 *
 * Стол передаёт подавших бюллетень полем `voters`, сборщик протокола 1.1 кладёт
 * список в мету документа. До 24.11.2026 входы протокола поля не объявляли, и
 * подписанный протокол отклонялся схемой: «Field "voters" is not defined by type
 * "BranchMeetingDecisionSignedMetaDocumentInput"» — председатель не мог
 * завершить собрание. Протоколы версии 1.0 списка не несут, поле необязательное.
 */
const votersErrors = async (cls: any, voters: unknown) => {
  const input = plainToInstance(cls, voters === undefined ? {} : { voters });
  const errors = await validate(input as object, { skipMissingProperties: true });
  return errors.filter((e) => e.property === 'voters');
};

describe.each([
  ['подписанная мета протокола', BranchMeetingDecisionSignedMetaDocumentInputDTO],
  ['генерация протокола', BranchMeetingDecisionGenerateDocumentInputDTO],
])('%s: список подавших бюллетень', (_name, cls) => {
  it('принимает список имён аккаунтов', async () => {
    expect(await votersErrors(cls, ['alice', 'bob'])).toHaveLength(0);
  });

  it('принимает протокол без списка (версия 1.0)', async () => {
    expect(await votersErrors(cls, undefined)).toHaveLength(0);
  });

  it('отклоняет не строки', async () => {
    expect(await votersErrors(cls, [1, 2])).toHaveLength(1);
  });
});
