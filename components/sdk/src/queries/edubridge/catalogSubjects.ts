import { eduCatalogSubjectSelector } from '../../selectors/edubridge/courseSelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'edubridgeCatalogSubjects'

export const query = Selector('Query')({
  [name]: eduCatalogSubjectSelector,
})

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
