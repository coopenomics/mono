import { beforeAll, describe, it } from 'vitest'
import { Cooperative } from 'cooptypes'
import { generator, mongoUri } from './utils'
import { testDocumentGeneration } from './utils/testDocument'

const branchName = 'РОМАШКА'
const branchAddress = 'г. Красногорск, ул. Ленина, д. 1'
const branchHash = 'BRANCH_MEETING_HASH_TEST'

const branchAgendaQuestions = [
  {
    number: '1',
    title: 'Об организации кооперативного участка',
    context: 'Учреждение кооперативного участка по месту, определяемому собранием.',
    decision: 'Организовать кооперативный участок по адресу привязки, определённому собранием пайщиков',
  },
  {
    number: '2',
    title: 'Об избрании председателя кооперативного участка',
    context: 'Избрание председателя из числа участников собрания.',
    decision: 'Избрать председателем кооперативного участка председателя настоящего собрания пайщиков',
  },
]

const branchBallotQuestions = [
  {
    id: '1',
    number: '1',
    title: `Об организации кооперативного участка «${branchName}»`,
    context: 'Учреждение кооперативного участка с привязкой к указанному адресу.',
    decision: `Организовать кооперативный участок «${branchName}»`,
  },
  {
    id: '2',
    number: '2',
    title: 'Об избрании председателя кооперативного участка',
    context: 'Избрание председателя из числа участников собрания.',
    decision: 'Избрать председателем кооперативного участка Иванова Петра Сидоровича',
  },
]

const branchProtocolQuestions = [
  {
    number: '1',
    title: `Об организации кооперативного участка «${branchName}»`,
    context: 'Учреждение кооперативного участка с привязкой к указанному адресу.',
    decision: `Организовать кооперативный участок «${branchName}»`,
    counter_votes_for: '5',
    counter_votes_against: '0',
    counter_votes_abstained: '0',
    votes_for_percent: 100,
    votes_against_percent: 0,
    votes_abstained_percent: 0,
    is_accepted: true,
  },
  {
    number: '2',
    title: 'Об избрании председателя кооперативного участка',
    context: 'Избрание председателя из числа участников собрания.',
    decision: 'Избрать председателем кооперативного участка Иванова Петра Сидоровича',
    counter_votes_for: '5',
    counter_votes_against: '0',
    counter_votes_abstained: '0',
    votes_for_percent: 100,
    votes_against_percent: 0,
    votes_abstained_percent: 0,
    is_accepted: true,
  },
]

beforeAll(async () => {
  await generator.connect(mongoUri)
})

describe('тест генератора документов кооперативных участков', () => {
  it('генерируем предложение повестки собрания пайщиков (320)', async () => {
    await testDocumentGeneration<Cooperative.Registry.BranchMeetingProposal.Action>({
      registry_id: Cooperative.Registry.BranchMeetingProposal.registry_id,
      coopname: 'voskhod',
      username: 'individual',
      lang: 'ru',
      type: 'createbranch',
      hash: branchHash,
      questions: branchAgendaQuestions,
    })
  })

  it('генерируем бюллетень для голосования на собрании пайщиков (322)', async () => {
    await testDocumentGeneration<Cooperative.Registry.BranchMeetingBallot.Action>({
      registry_id: Cooperative.Registry.BranchMeetingBallot.registry_id,
      coopname: 'voskhod',
      username: 'individual',
      lang: 'ru',
      hash: branchHash,
      answers: [
        { id: '1', number: '1', vote: 'for' },
        { id: '2', number: '2', vote: 'for' },
      ],
      questions: branchBallotQuestions,
    })
  })

  it('генерируем протокол решения собрания пайщиков (323)', async () => {
    await testDocumentGeneration<Cooperative.Registry.BranchMeetingDecision.Action>({
      registry_id: Cooperative.Registry.BranchMeetingDecision.registry_id,
      coopname: 'voskhod',
      username: 'individual',
      lang: 'ru',
      hash: branchHash,
      protocol_number: '15-03-2024',
      chairman: 'individual',
      open_at_datetime: '15.03.2024 10:00',
      close_at_datetime: '15.03.2024 18:00',
      current_quorum_percent: 100,
      questions: branchProtocolQuestions,
    })
  })

  it('генерируем заявление председателя собрания в совет (324)', async () => {
    await testDocumentGeneration<Cooperative.Registry.BranchEstablishmentPetition.Action>({
      registry_id: Cooperative.Registry.BranchEstablishmentPetition.registry_id,
      coopname: 'voskhod',
      username: 'individual',
      lang: 'ru',
      hash: branchHash,
      branch_name: branchName,
      address: branchAddress,
      chairman: 'ant',
    })
  })

  it('генерируем решение совета об учреждении кооперативного участка (325)', async () => {
    await testDocumentGeneration<Cooperative.Registry.BranchEstablishmentSovietDecision.Action>({
      registry_id: Cooperative.Registry.BranchEstablishmentSovietDecision.registry_id,
      coopname: 'voskhod',
      username: 'ant',
      lang: 'ru',
      decision_id: 1,
      branch_name: branchName,
      address: branchAddress,
      chairman: 'ant',
    })
  })

  it('генерируем заявление о приёме доверенным лицом участка (326)', async () => {
    await testDocumentGeneration<Cooperative.Registry.BranchTrustedStatement.Action>({
      registry_id: Cooperative.Registry.BranchTrustedStatement.registry_id,
      coopname: 'voskhod',
      username: 'individual',
      lang: 'ru',
      hash: branchHash,
      braname: branchName,
    })
  })

  it('генерируем договор о материальной ответственности доверенного лица (327)', async () => {
    await testDocumentGeneration<Cooperative.Registry.BranchTrustedLiabilityAgreement.Action>({
      registry_id: Cooperative.Registry.BranchTrustedLiabilityAgreement.registry_id,
      coopname: 'voskhod',
      username: 'individual',
      lang: 'ru',
      hash: branchHash,
      branch_name: branchName,
      trustee: 'ant',
    })
  })

  it('генерируем договор о материальной ответственности председателя участка (328)', async () => {
    await testDocumentGeneration<Cooperative.Registry.BranchTrusteeLiabilityAgreement.Action>({
      registry_id: Cooperative.Registry.BranchTrusteeLiabilityAgreement.registry_id,
      coopname: 'voskhod',
      username: 'ant',
      lang: 'ru',
      hash: branchHash,
      branch_name: branchName,
    })
  })

  it('генерируем доверенность председателю кооперативного участка (329)', async () => {
    await testDocumentGeneration<Cooperative.Registry.BranchTrusteePowerOfAttorney.Action>({
      registry_id: Cooperative.Registry.BranchTrusteePowerOfAttorney.registry_id,
      coopname: 'voskhod',
      username: 'ant',
      lang: 'ru',
      hash: branchHash,
      branch_name: branchName,
      branch_address: branchAddress,
    })
  })

  it('генерируем доверенность доверенному лицу кооперативного участка (330)', async () => {
    await testDocumentGeneration<Cooperative.Registry.BranchTrustedPowerOfAttorney.Action>({
      registry_id: Cooperative.Registry.BranchTrustedPowerOfAttorney.registry_id,
      coopname: 'voskhod',
      username: 'individual',
      lang: 'ru',
      hash: branchHash,
      branch_name: branchName,
      trustee: 'ant',
    })
  })
})
