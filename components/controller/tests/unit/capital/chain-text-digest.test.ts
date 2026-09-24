import { createHash } from 'crypto';
import { chainTextDigest, isChainTextDigest, resolveChainText } from '@coopenomics/extension-kit';
import { chainTextMismatches } from '../../../src/extensions/capital/domain/utils/chain-text-digest';
import { ProjectDomainEntity } from '../../../src/extensions/capital/domain/entities/project.entity';

const sha = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');

describe('тексты проекта в цепи — хешем', () => {
  it('хеш считается от байтов UTF-8, как у контракта', () => {
    expect(chainTextDigest('Описание проекта')).toBe(sha('Описание проекта'));
    expect(isChainTextDigest(chainTextDigest('Описание проекта'))).toBe(true);
  });

  it('пустой текст остаётся пустой строкой', () => {
    expect(chainTextDigest('')).toBe('');
    expect(chainTextDigest(undefined)).toBe('');
    expect(chainTextDigest(null)).toBe('');
  });

  it('хешем считается только 64 шестнадцатеричных символа в нижнем регистре', () => {
    expect(isChainTextDigest('a'.repeat(64))).toBe(true);
    expect(isChainTextDigest('A'.repeat(64))).toBe(false);
    expect(isChainTextDigest('a'.repeat(63))).toBe(false);
    expect(isChainTextDigest('Описание')).toBe(false);
    expect(isChainTextDigest('')).toBe(false);
  });

  it('хеш из цепи текст в базе не заменяет, старый текст из цепи копируется', () => {
    expect(resolveChainText(sha('текст'), 'текст')).toBe('текст');
    expect(resolveChainText(sha('текст'), undefined)).toBe('');
    expect(resolveChainText('старый текст из цепи', 'что угодно')).toBe('старый текст из цепи');
    expect(resolveChainText('', 'текст')).toBe('');
  });

  it('расхождение находится по каждому полю отдельно', () => {
    const chain = { description: sha('описание'), invite: '' };
    expect(chainTextMismatches(chain, { description: 'описание', invite: '' })).toEqual([]);
    expect(chainTextMismatches(chain, { description: 'другое', invite: '' })).toEqual(['description']);
    expect(chainTextMismatches(chain, { description: 'описание', invite: 'приглашение мимо цепи' })).toEqual(['invite']);
  });

  it('строки со старым текстом в цепи сверке не подлежат', () => {
    expect(chainTextMismatches({ description: 'старый текст', invite: '' }, { description: 'другой', invite: '' })).toEqual([]);
  });

  it('дельта с хешем сохраняет текст сущности, дельта со старым текстом его переписывает', () => {
    const entity = Object.create(ProjectDomainEntity.prototype) as ProjectDomainEntity;
    entity.description = 'текст в базе';
    entity.invite = 'приглашение в базе';

    entity.updateFromBlockchain(
      { description: sha('текст в базе'), invite: sha('приглашение в базе'), status: 'active' } as any,
      10
    );
    expect(entity.description).toBe('текст в базе');
    expect(entity.invite).toBe('приглашение в базе');

    entity.updateFromBlockchain({ description: 'текст из цепи', invite: '', status: 'active' } as any, 11);
    expect(entity.description).toBe('текст из цепи');
    expect(entity.invite).toBe('');
  });
});
