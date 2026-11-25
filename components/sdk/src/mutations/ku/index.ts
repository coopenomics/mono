/** Одобрить заявку доверенного встречной подписью председателя участка */
export * as ApproveTrusted from './approveTrusted'

/** Отменить собрание пайщиков участка */
export * as CancelDecision from './cancelDecision'

/** Закрыть голосование и утвердить протокол собрания */
export * as CloseDecision from './closeDecision'

/** Объявить собрание пайщиков кооперативного участка */
export * as CreateDecision from './createDecision'

/** Отклонить заявку доверенного лица */
export * as DeclineTrusted from './declineTrusted'

/** Направить заявление председателя собрания в совет об учреждении участка */
export * as ExecDecision from './execDecision'

/** Сгенерировать заявление председателя собрания в совет об учреждении участка */
export * as GenerateEstablishmentPetition from './generateEstablishmentPetition'
export * as GenerateEstablishmentDecision from './generateEstablishmentDecision'

/** Сгенерировать договор о полной индивидуальной материальной ответственности доверенного лица */
export * as GenerateTrustedLiabilityAgreement from './generateTrustedLiabilityAgreement'

/** Сгенерировать бюллетень голосования на собрании участка */
export * as GenerateMeetingBallot from './generateMeetingBallot'

/** Сгенерировать протокол решения собрания пайщиков участка */
export * as GenerateMeetingDecision from './generateMeetingDecision'

/** Сгенерировать предложение повестки собрания пайщиков участка */
export * as GenerateMeetingProposal from './generateMeetingProposal'

/** Сгенерировать заявление о приёме доверенным лицом участка */
export * as GenerateTrustedStatement from './generateTrustedStatement'

/** Присоединиться к собранию пайщиков кооперативного участка */
export * as JoinDecision from './joinDecision'

/** Подать заявку на приём доверенным лицом кооперативного участка */
export * as RequestTrusted from './requestTrusted'

/** Назначить председателя собрания из числа участников */

/** Открыть голосование на собрании пайщиков участка */
export * as StartDecision from './startDecision'

/** Подать бюллетень на собрании пайщиков участка */
export * as VoteOnDecision from './voteOnDecision'

/** Сгенерировать доверенность председателю участка (номер, протокол и срок вписывает узел) */
export * as GenerateTrusteePowerOfAttorney from './generateTrusteePowerOfAttorney'

/** Сгенерировать доверенность доверенному лицу участка (реквизиты вписывает узел) */
export * as GenerateTrustedPowerOfAttorney from './generateTrustedPowerOfAttorney'

/** Сгенерировать договор о полной материальной ответственности председателя участка */
export * as GenerateTrusteeLiabilityAgreement from './generateTrusteeLiabilityAgreement'

/** Подписать доверенность председателя участка — на встречную подпись председателю совета */
export * as SignTrusteeAuthority from './signTrusteeAuthority'

/** Подписать договор о полной материальной ответственности председателя участка */
export * as SignTrusteeLiability from './signTrusteeLiability'
