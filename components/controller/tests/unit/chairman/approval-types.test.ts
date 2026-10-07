import fs from 'node:fs';
import path from 'node:path';
import { APPROVAL_TYPE_MAP, approvalInfoOf } from '~/extensions/chairman/domain/approval-types';

/**
 * Заголовок уведомления председателю берётся по типу одобрения — имени
 * действия контракта. Тип, которого нет в карте, получает общий заголовок
 * «Новый запрос на одобрение», и председатель не видит, что именно подписывать.
 */
describe('типы одобрений образования', () => {
  const EDU_TYPES = {
    apprvcontr: 'Договор УХД преподавателя',
    apprvridact: 'Акт приёма-передачи результата работы преподавателя',
  } as const;

  it('договор преподавателя несёт свой заголовок и описание', () => {
    for (const [type, title] of Object.entries(EDU_TYPES)) {
      const info = APPROVAL_TYPE_MAP[type as keyof typeof APPROVAL_TYPE_MAP];
      expect(info.title).toBe(title);
      expect(info.description).toMatch(/подпись председателя/);
    }
  });

  it('тип одобрения — действие контракта edubridge, иначе карта не сработает', () => {
    const header = fs.readFileSync(
      path.join(__dirname, '../../../../contracts/cpp/edubridge/edubridge.hpp'),
      'utf8'
    );
    for (const type of Object.keys(EDU_TYPES)) {
      expect(header).toMatch(new RegExp(`\\[\\[eosio::action\\]\\]\\s+void\\s+${type}\\(`));
    }
  });

  it('запись цепи несёт действие подачи и действие одобрения — заголовок находится по действию одобрения', () => {
    expect(approvalInfoOf({ type: 'signcontract', callback_action_approve: 'apprvcontr' })?.title).toBe('Договор УХД преподавателя');
    expect(approvalInfoOf({ type: 'createcmmt', callback_action_approve: 'approvecmmt' })).toBe(APPROVAL_TYPE_MAP.approvecmmt);
    expect(approvalInfoOf({ type: 'unknown', callback_action_approve: 'unknown' })).toBeUndefined();
  });

  it('допуск к курсу одобрения не требует — действий приложения к договору в контракте и карте нет', () => {
    const header = fs.readFileSync(
      path.join(__dirname, '../../../../contracts/cpp/edubridge/edubridge.hpp'),
      'utf8'
    );
    for (const action of ['signannex', 'apprvannex', 'dclineannex']) {
      expect(header).not.toMatch(new RegExp(`void\\s+${action}\\(`));
      expect(APPROVAL_TYPE_MAP).not.toHaveProperty(action);
    }
  });
});
