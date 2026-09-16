import { client } from 'src/shared/api/client'
import { Mutations } from '@coopenomics/sdk'
import { signDocument } from 'src/shared/lib/document'
import { getTimezone } from 'src/shared/lib/utils/dates/timezone'
import moment from 'moment-timezone'

export type ICreateMeetInput = Mutations.Meet.CreateAnnualGeneralMeet.IInput['data']
export type ICreateMeetResult = Mutations.Meet.CreateAnnualGeneralMeet.IOutput[typeof Mutations.Meet.CreateAnnualGeneralMeet.name]

export type IGenerateAgendaInput = Mutations.Meet.GenerateAnnualGeneralMeetAgendaDocument.IInput['data']
export type IGenerateAgendaResult = Mutations.Meet.GenerateAnnualGeneralMeetAgendaDocument.IOutput[typeof Mutations.Meet.GenerateAnnualGeneralMeetAgendaDocument.name]

export interface ICreateMeetWithAgendaInput {
  coopname: string
  initiator: string
  presider: string
  secretary: string
  open_at: string
  close_at: string
  username: string
  type: 'regular' | 'extra'
  /** Необязательно; до 10000 символов, как на бэкенде */
  details?: string
  agenda_points: {
    title: string
    context: string
    decision: string
  }[]
}

/**
 * Генерирует документ повестки собрания
 * @private Внутренняя функция, не экспортируется
 */
async function generateAgenda(data: IGenerateAgendaInput, options?: any): Promise<IGenerateAgendaResult> {
  const { [Mutations.Meet.GenerateAnnualGeneralMeetAgendaDocument.name]: generatedDocument } = await client.Mutation(
    Mutations.Meet.GenerateAnnualGeneralMeetAgendaDocument.mutation,
    {
      variables: {
        data,
        options
      }
    }
  );

  return generatedDocument;
}

export async function createMeet(data: ICreateMeetInput): Promise<ICreateMeetResult> {
  const { [Mutations.Meet.CreateAnnualGeneralMeet.name]: result } = await client.Mutation(
    Mutations.Meet.CreateAnnualGeneralMeet.mutation,
    {
      variables: {
        data
      }
    }
  );

  return result;
}

export async function createMeetWithAgenda(data: ICreateMeetWithAgendaInput): Promise<ICreateMeetResult> {


  // Получаем московский часовой пояс для форматирования
  const timezone = getTimezone()

  // Преобразуем формат даты для документа, явно указывая московский часовой пояс
  // Добавляем маркер '(Мск)' к датам, так как в шаблоне документа этот маркер не добавляется автоматически
  const openAtFormatted = `${moment(data.open_at).tz(timezone).format('DD.MM.YYYY HH:mm')} (Мск)`
  const closeAtFormatted = `${moment(data.close_at).tz(timezone).format('DD.MM.YYYY HH:mm')} (Мск)`

  // Формируем вопросы повестки в требуемом формате
  const questions = data.agenda_points.map((point, index) => ({
    number: String(index + 1),
    title: point.title,
    decision: point.decision,
    context: point.context || ''
  }))

  // Генерируем документ повестки с правильными параметрами согласно DTO
  const generatedDocument = await generateAgenda({
    coopname: data.coopname,
    username: data.username,
    meet: {
      type: data.type,
      open_at_datetime: openAtFormatted,
      close_at_datetime: closeAtFormatted
    },
    questions: questions,
    is_repeated: false
  })


  // Подписываем документ
  const signedDocument = await signDocument(generatedDocument, data.username)

  const detailsTrimmed = data.details?.trim()

  // Создаем собрание
  const result = await createMeet({
    coopname: data.coopname,
    agenda: data.agenda_points,
    initiator: data.initiator,
    presider: data.presider,
    secretary: data.secretary,
    open_at: data.open_at,
    close_at: data.close_at,
    proposal: signedDocument,
    ...(detailsTrimmed ? { details: detailsTrimmed } : {}),
  })
  return result
}
