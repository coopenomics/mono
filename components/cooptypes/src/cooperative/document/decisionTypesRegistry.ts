import {
  AnnualGeneralMeetingSovietDecision, // 300
  BranchEstablishmentSovietDecision, // 325
  BranchFinancialAidProtocol, // 1112
  DecisionOfParticipantApplication, // 501
  DecisionOfParticipantExit, // 201
  FreeDecision,
  MarketplaceShareContributionDecision, // 1117
  MarketplaceShareReturnDecision, // 1114
  MarketplaceWriteoffProtocol, // 1107
  ResultContributionDecision, // 1041
  ReturnByMoneyDecision, // 901
} from '../registry'

/**
 * Решение совета, доступное для автоматизации роботом.
 */
export interface IDecisionTypeInfo {
  /** Имя типа решения в контракте soviet — ключ повестки. */
  type: string
  /** Название решения человеческим языком. */
  title: string
  /** Кто и что просит у совета. */
  description: string
  /** Номер шаблона протокола в реестре документов. */
  protocol_registry_id: number
  /**
   * Расширение, которое приносит это решение, — имя из реестра расширений
   * платформы (`extensions.registry.ts`). `null` — ядро: решение есть у любого
   * кооператива, ставить для него ничего не нужно.
   *
   * Признак `is_builtin` у записи расширения на установку не влияет — он лишь
   * запрещает удалять расширение из каталога. Кооператив получает сразу только
   * те расширения, у которых объявлены `defaults`; у стола «Кооперативный
   * участок» их нет, его ставит председатель, и до установки решений участка у
   * кооператива не бывает.
   */
  extension: 'capital' | 'market' | 'trustee' | null
}

/**
 * ЕДИНСТВЕННОЕ место, где перечислены решения совета, доступные автоматизации.
 * Реестр действий робота, кворум и подпись протокола читают только отсюда.
 *
 * Тип попадает сюда, когда выполнены ОБА условия:
 *
 *  1. Контракт заводит по нему повестку — зовёт `soviet::createagenda`. Имён в
 *     `soviet_actions` (`contracts/cpp/lib/consts.hpp`) втрое больше, но это
 *     реестр документов совета, а не список голосований: `completegm`,
 *     `ballot`, `gmnotify`, `branchliab`, `branchauth` привязываются к пакету
 *     через `newlink` и `make_complete_document`, голосования по ним нет.
 *  2. У него есть шаблон протокола. Без протокола роботу нечего сформировать и
 *     нечего подписать ключом председателя, автоматизировать такой тип нельзя.
 *
 * Повестки без протокола (`createexp`, `ledgerwthd`, `capresexpns`,
 * `capwthdrprog`, `createdebt`) в реестр не входят намеренно: пока шаблон не
 * описан, показывать их в столе робота незачем.
 *
 * ПОДДЕРЖИВАТЬ ЗДЕСЬ. Появился новый тип повестки или шаблон протокола у
 * старого — правится этот файл, больше нигде списка нет. Забыть не даёт гейт
 * `tests/unit/soviet-robot/decision-types-registry.test.ts` в controller: он
 * вычитывает вызовы `create_agenda` прямо из исходников контрактов и падает,
 * когда появляется тип, не описанный ни здесь, ни в списке исключений.
 */
export const decisionTypesRegistry: Record<string, IDecisionTypeInfo> = {
  joincoop: {
    type: 'joincoop',
    title: 'Приём пайщика в кооператив',
    description: 'Заявление о вступлении: совет принимает пайщика в кооператив.',
    protocol_registry_id: DecisionOfParticipantApplication.registry_id,
    extension: null,
  },
  leavecoop: {
    type: 'leavecoop',
    title: 'Выход пайщика из кооператива',
    description: 'Заявление о выходе с возвратом паевого взноса.',
    protocol_registry_id: DecisionOfParticipantExit.registry_id,
    extension: null,
  },
  createwthd: {
    type: 'createwthd',
    title: 'Возврат паевого взноса деньгами',
    description: 'Заявление на возврат паевого взноса из кошелька.',
    protocol_registry_id: ReturnByMoneyDecision.registry_id,
    extension: null,
  },
  creategm: {
    type: 'creategm',
    title: 'Созыв общего собрания пайщиков',
    description: 'Предложение повестки планового общего собрания.',
    protocol_registry_id: AnnualGeneralMeetingSovietDecision.registry_id,
    extension: null,
  },
  freedecision: {
    type: 'freedecision',
    title: 'Свободное решение совета',
    description: 'Вопрос повестки в свободной форме, поданный инициатором.',
    protocol_registry_id: FreeDecision.registry_id,
    extension: null,
  },
  branchdec: {
    type: 'branchdec',
    title: 'Учреждение кооперативного участка',
    description: 'Решение собрания пайщиков об учреждении кооперативного участка.',
    protocol_registry_id: BranchEstablishmentSovietDecision.registry_id,
    extension: 'trustee',
  },
  brnaid: {
    type: 'brnaid',
    title: 'Материальная помощь доверенному участка',
    description: 'Заявление на материальную помощь доверенному кооперативного участка.',
    protocol_registry_id: BranchFinancialAidProtocol.registry_id,
    extension: 'trustee',
  },
  mktwroff: {
    type: 'mktwroff',
    title: 'Списание скоропорта',
    description: 'Проект списания скоропортящегося имущества со склада участка.',
    protocol_registry_id: MarketplaceWriteoffProtocol.registry_id,
    extension: 'market',
  },
  mktissue: {
    type: 'mktissue',
    title: 'Выдача имущества пайщику',
    description: 'Заявление пайщика о возврате паевого взноса имуществом: совет разрешает выдать заказ со Стола заказов.',
    protocol_registry_id: MarketplaceShareReturnDecision.registry_id,
    extension: 'market',
  },
  mktretrn: {
    type: 'mktretrn',
    title: 'Гарантийный возврат имущества',
    description: 'Заявление пайщика о внесении паевого взноса имуществом: совет принимает возвращённое имущество и восстанавливает паевой взнос.',
    protocol_registry_id: MarketplaceShareContributionDecision.registry_id,
    extension: 'market',
  },
  createresult: {
    type: 'createresult',
    title: 'Приём результата интеллектуальной деятельности',
    description: 'Заявление о внесении результата интеллектуальной деятельности из задания.',
    protocol_registry_id: ResultContributionDecision.registry_id,
    extension: 'capital',
  },
}

/**
 * Решения, доступные кооперативу: ядровые плюс те, чьё расширение установлено.
 *
 * Кооператив без Благороста, Стола заказов и Кооперативного участка не должен
 * видеть в столе робота их решения — таких повесток у него не бывает.
 */
export function decisionTypesForExtensions(installedExtensions: readonly string[]): IDecisionTypeInfo[] {
  const installed = new Set(installedExtensions)
  return Object.values(decisionTypesRegistry).filter(
    info => info.extension === null || installed.has(info.extension),
  )
}

/** Расширения, от установки которых зависит хотя бы одно решение реестра. */
export function decisionTypeExtensions(): string[] {
  const names = Object.values(decisionTypesRegistry)
    .map(info => info.extension)
    .filter((name): name is NonNullable<IDecisionTypeInfo['extension']> => name !== null)
  return [...new Set(names)]
}
