import { decisionsRegistry } from './decisionsRegistry'

/**
 * Описание типа решения совета для людей: реестр действий автоматизации робота
 * решений совета показывает эти названия, а не имена действий контракта.
 */
export interface IDecisionTypeInfo {
  /** Имя типа решения в контракте soviet (ключ повестки). */
  type: string
  /** Название решения человеческим языком. */
  title: string
  /** Кто и что просит у совета. */
  description: string
  /** Номер шаблона протокола в реестре документов; пусто — протокол ещё не описан, робот такой тип не обслуживает. */
  protocol_registry_id?: number
  /** Область платформы, из которой приходит решение. */
  area: 'membership' | 'meet' | 'branch' | 'capital' | 'wallet' | 'expense' | 'ledger' | 'marketplace'
}

/**
 * Реестр типов решений совета. Зеркало списка допустимых типов повестки контракта
 * (`soviet_actions` в `contracts/cpp/lib/consts.hpp`): ключи обязаны совпадать.
 *
 * Робот решений совета обслуживает только типы с `protocol_registry_id`: без шаблона
 * протокола подписать решение нечем. Остальные показываются в реестре автоматизаций
 * как недоступные.
 */
export const decisionTypesRegistry: Record<string, IDecisionTypeInfo> = {
  joincoop: {
    type: 'joincoop',
    title: 'Приём пайщика в кооператив',
    description: 'Заявление о вступлении: совет принимает пайщика в кооператив.',
    protocol_registry_id: decisionsRegistry.joincoop,
    area: 'membership',
  },
  leavecoop: {
    type: 'leavecoop',
    title: 'Выход пайщика из кооператива',
    description: 'Заявление о выходе с возвратом паевого взноса.',
    protocol_registry_id: decisionsRegistry.leavecoop,
    area: 'membership',
  },
  freedecision: {
    type: 'freedecision',
    title: 'Свободное решение совета',
    description: 'Вопрос повестки в свободной форме, поданный инициатором.',
    protocol_registry_id: decisionsRegistry.freedecision,
    area: 'membership',
  },
  creategm: {
    type: 'creategm',
    title: 'Созыв общего собрания пайщиков',
    description: 'Предложение повестки планового общего собрания.',
    protocol_registry_id: decisionsRegistry.creategm,
    area: 'meet',
  },
  completegm: {
    type: 'completegm',
    title: 'Итоги общего собрания пайщиков',
    description: 'Решение общего собрания пайщиков.',
    area: 'meet',
  },
  ballot: {
    type: 'ballot',
    title: 'Бюллетень общего собрания',
    description: 'Бюллетень участника общего собрания пайщиков.',
    area: 'meet',
  },
  gmnotify: {
    type: 'gmnotify',
    title: 'Уведомление об общем собрании',
    description: 'Уведомление участника общего собрания пайщиков.',
    area: 'meet',
  },
  branchdec: {
    type: 'branchdec',
    title: 'Учреждение кооперативного участка',
    description: 'Решение собрания пайщиков об учреждении кооперативного участка.',
    protocol_registry_id: decisionsRegistry.branchdec,
    area: 'branch',
  },
  branchliab: {
    type: 'branchliab',
    title: 'Материальная ответственность председателя участка',
    description: 'Договор о полной материальной ответственности председателя кооперативного участка.',
    area: 'branch',
  },
  branchauth: {
    type: 'branchauth',
    title: 'Доверенность председателю участка',
    description: 'Доверенность председателю кооперативного участка.',
    area: 'branch',
  },
  brnaid: {
    type: 'brnaid',
    title: 'Материальная помощь доверенному участка',
    description: 'Заявление на материальную помощь доверенному кооперативного участка.',
    protocol_registry_id: decisionsRegistry.brnaid,
    area: 'branch',
  },
  capitalinvst: {
    type: 'capitalinvst',
    title: 'Инвестиции по договору УХД',
    description: 'Заявление на инвестиции по договору участия в хозяйственной деятельности.',
    area: 'capital',
  },
  createresult: {
    type: 'createresult',
    title: 'Приём результата задания',
    description: 'Заявление о внесении результата интеллектуальной деятельности из задания.',
    protocol_registry_id: decisionsRegistry.createresult,
    area: 'capital',
  },
  createdebt: {
    type: 'createdebt',
    title: 'Ссуда под будущее задание',
    description: 'Заявление на ссуду под залог будущего результата задания.',
    area: 'capital',
  },
  capresexpns: {
    type: 'capresexpns',
    title: 'Выплата по расходам задания',
    description: 'Выплата по расходам, понесённым при выполнении задания.',
    area: 'capital',
  },
  capwthdrprog: {
    type: 'capwthdrprog',
    title: 'Возврат членских взносов по программе',
    description: 'Возврат накопленных членских взносов по программе.',
    area: 'capital',
  },
  capwthdrproj: {
    type: 'capwthdrproj',
    title: 'Возврат членских взносов по проекту',
    description: 'Возврат накопленных членских взносов по проекту.',
    area: 'capital',
  },
  capwthdrres: {
    type: 'capwthdrres',
    title: 'Возврат из задания',
    description: 'Возврат средств из задания.',
    area: 'capital',
  },
  createwthd: {
    type: 'createwthd',
    title: 'Возврат паевого взноса деньгами',
    description: 'Заявление на возврат паевого взноса из кошелька.',
    protocol_registry_id: decisionsRegistry.createwthd,
    area: 'wallet',
  },
  createexp: {
    type: 'createexp',
    title: 'Служебная записка о расходах',
    description: 'Смета расходов, поданная через шасси расходов.',
    area: 'expense',
  },
  ledgerwthd: {
    type: 'ledgerwthd',
    title: 'Списание со счёта',
    description: 'Заявление на списание со счёта через реестр проводок.',
    area: 'ledger',
  },
  authoffs2c: {
    type: 'authoffs2c',
    title: 'Паевой взнос имуществом',
    description: 'Заявление о внесении паевого взноса имуществом.',
    area: 'marketplace',
  },
  authoffc2r: {
    type: 'authoffc2r',
    title: 'Возврат паевого взноса имуществом',
    description: 'Заявление о возврате паевого взноса имуществом.',
    area: 'marketplace',
  },
  mktwroff: {
    type: 'mktwroff',
    title: 'Списание скоропорта',
    description: 'Проект списания скоропортящегося имущества со склада участка.',
    protocol_registry_id: decisionsRegistry.mktwroff,
    area: 'marketplace',
  },
  mktissue: {
    type: 'mktissue',
    title: 'Выдача имущества пайщику',
    description: 'Заявление о возврате паевого взноса имуществом в паевой ветке Стола заказов.',
    // Протокол 1114 появится вместе с документами паевой ветки (компонент «Паевая модель заказчика»).
    area: 'marketplace',
  },
}

/** Типы решений, которые робот решений совета умеет доводить до протокола. */
export function robotServiceableDecisionTypes(): IDecisionTypeInfo[] {
  return Object.values(decisionTypesRegistry).filter(info => info.protocol_registry_id !== undefined)
}
