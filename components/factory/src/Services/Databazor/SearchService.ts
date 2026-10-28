import type { ExternalEntrepreneurData, ExternalIndividualData, ExternalOrganizationData } from '../../Models'
import { Entrepreneur, Individual, Organization } from '../../Models'
import type { IFactoryStorage, Where } from '../../Storage'

export interface ISearchResult {
  type: 'individual' | 'entrepreneur' | 'organization'
  data: ExternalIndividualData | ExternalEntrepreneurData | ExternalOrganizationData
  score?: number // для будущего ранжирования
  highlightedFields?: string[] // поля, в которых найдено совпадение
}

export class SearchService {
  private storage: IFactoryStorage

  constructor(storage: IFactoryStorage) {
    this.storage = storage
  }

  // Экранирование специальных символов регулярных выражений
  private escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  async search(query: string): Promise<ISearchResult[]> {
    if (!query || query.trim().length === 0) {
      return []
    }

    const results: ISearchResult[] = []
    const trimmedQuery = query.trim()

    console.log(`[SearchService] Поиск по запросу: "${trimmedQuery}"`)

    // Экранируем специальные символы для безопасного использования в regex
    const escapedQuery = this.escapeRegex(trimmedQuery)

    // Разбиваем запрос на слова для поиска по полному ФИО
    const queryWords = trimmedQuery.split(/\s+/).filter(word => word.length > 0)

    try {
      // Поиск в коллекции individuals
      console.log(`[SearchService] Поиск в individuals...`)
      const individualResults = await this.searchIndividuals(escapedQuery, queryWords, trimmedQuery)
      console.log(`[SearchService] Найдено individuals: ${individualResults.length}`)
      results.push(...individualResults)

      // Поиск в коллекции entrepreneurs
      console.log(`[SearchService] Поиск в entrepreneurs...`)
      const entrepreneurResults = await this.searchEntrepreneurs(escapedQuery, queryWords, trimmedQuery)
      console.log(`[SearchService] Найдено entrepreneurs: ${entrepreneurResults.length}`)
      results.push(...entrepreneurResults)

      // Поиск в коллекции organizations
      console.log(`[SearchService] Поиск в organizations...`)
      const organizationResults = await this.searchOrganizations(escapedQuery)
      console.log(`[SearchService] Найдено organizations: ${organizationResults.length}`)
      results.push(...organizationResults)

      console.log(`[SearchService] Общее количество результатов: ${results.length}`)

      // Ограничиваем общее количество результатов до 10
      return results.slice(0, 10)
    }
    catch (error) {
      console.error('[SearchService] Ошибка при поиске:', error)
      return []
    }
  }

  private async searchIndividuals(regexPattern: string, queryWords: string[], originalQuery: string): Promise<ISearchResult[]> {
    const individualModel = new Individual(this.storage)
    const results: ISearchResult[] = []

    // Создаем два отдельных запроса для лучшей типизации
    let filter: any

    if (queryWords.length > 1) {
      // Комбинированный фильтр для поиска по отдельным полям И по полному ФИО
      filter = {
        deleted: false,
        $or: [
          // Поиск по отдельным полям
          { first_name: { $regex: regexPattern, $options: 'i' } },
          { last_name: { $regex: regexPattern, $options: 'i' } },
          { middle_name: { $regex: regexPattern, $options: 'i' } },
          // Поиск по полному ФИО (все слова должны быть найдены)
          {
            $and: queryWords.map(word => ({
              $or: [
                { first_name: { $regex: this.escapeRegex(word), $options: 'i' } },
                { last_name: { $regex: this.escapeRegex(word), $options: 'i' } },
                { middle_name: { $regex: this.escapeRegex(word), $options: 'i' } },
              ],
            })),
          },
        ],
      }
    }
    else {
      // Простой фильтр для одного слова
      filter = {
        deleted: false,
        $or: [
          { first_name: { $regex: regexPattern, $options: 'i' } },
          { last_name: { $regex: regexPattern, $options: 'i' } },
          { middle_name: { $regex: regexPattern, $options: 'i' } },
        ],
      }
    }

    console.log(`[SearchService] Фильтр для individuals:`, JSON.stringify(filter, null, 2))

    const individuals = await individualModel.getMany(filter)

    console.log(`[SearchService] Результаты поиска individuals:`, {
      total: individuals.totalResults,
      found: individuals.results.length,
      query: originalQuery,
      names: individuals.results.map(ind => `${ind.last_name} ${ind.first_name} ${ind.middle_name || ''} (deleted: ${ind.deleted || false})`),
    })

    for (const individual of individuals.results) {
      const highlightedFields = []

      // Создаем RegExp для проверки подсветки
      const testRegex = new RegExp(regexPattern, 'i')

      // Проверяем отдельные поля
      if (individual.first_name && testRegex.test(individual.first_name))
        highlightedFields.push('first_name')
      if (individual.last_name && testRegex.test(individual.last_name))
        highlightedFields.push('last_name')
      if (individual.middle_name && testRegex.test(individual.middle_name))
        highlightedFields.push('middle_name')

      // Проверяем полное ФИО
      const fullName = `${individual.last_name || ''} ${individual.first_name || ''} ${individual.middle_name || ''}`.trim()
      if (this.matchesFullName(fullName, queryWords)) {
        highlightedFields.push('full_name')
      }

      results.push({
        type: 'individual',
        data: individual,
        highlightedFields,
      })
    }

    return results
  }

  private async searchEntrepreneurs(regexPattern: string, queryWords: string[], originalQuery: string): Promise<ISearchResult[]> {
    const entrepreneurModel = new Entrepreneur(this.storage)
    const results: ISearchResult[] = []

    // Создаем фильтр с правильной типизацией
    let filter: any

    if (queryWords.length > 1) {
      // Комбинированный фильтр
      filter = {
        deleted: false,
        $or: [
          // Поиск по отдельным полям
          { first_name: { $regex: regexPattern, $options: 'i' } },
          { last_name: { $regex: regexPattern, $options: 'i' } },
          { middle_name: { $regex: regexPattern, $options: 'i' } },
          { 'details.inn': { $regex: regexPattern, $options: 'i' } },
          { 'details.ogrn': { $regex: regexPattern, $options: 'i' } },
          // Поиск по полному ФИО
          {
            $and: queryWords.map(word => ({
              $or: [
                { first_name: { $regex: this.escapeRegex(word), $options: 'i' } },
                { last_name: { $regex: this.escapeRegex(word), $options: 'i' } },
                { middle_name: { $regex: this.escapeRegex(word), $options: 'i' } },
              ],
            })),
          },
        ],
      }
    }
    else {
      // Простой фильтр
      filter = {
        deleted: false,
        $or: [
          { first_name: { $regex: regexPattern, $options: 'i' } },
          { last_name: { $regex: regexPattern, $options: 'i' } },
          { middle_name: { $regex: regexPattern, $options: 'i' } },
          { 'details.inn': { $regex: regexPattern, $options: 'i' } },
          { 'details.ogrn': { $regex: regexPattern, $options: 'i' } },
        ],
      }
    }

    console.log(`[SearchService] Фильтр для entrepreneurs:`, JSON.stringify(filter, null, 2))

    const entrepreneurs = await entrepreneurModel.getMany(filter)

    console.log(`[SearchService] Результаты поиска entrepreneurs:`, {
      total: entrepreneurs.totalResults,
      found: entrepreneurs.results.length,
      query: originalQuery,
      names: entrepreneurs.results.map(ent => `${ent.last_name} ${ent.first_name} ${ent.middle_name || ''} (deleted: ${ent.deleted || false})`),
    })

    for (const entrepreneur of entrepreneurs.results) {
      const highlightedFields = []

      // Создаем RegExp для проверки подсветки
      const testRegex = new RegExp(regexPattern, 'i')

      // Проверяем отдельные поля
      if (entrepreneur.first_name && testRegex.test(entrepreneur.first_name))
        highlightedFields.push('first_name')
      if (entrepreneur.last_name && testRegex.test(entrepreneur.last_name))
        highlightedFields.push('last_name')
      if (entrepreneur.middle_name && testRegex.test(entrepreneur.middle_name))
        highlightedFields.push('middle_name')
      if (entrepreneur.details?.inn && testRegex.test(entrepreneur.details.inn))
        highlightedFields.push('details.inn')
      if (entrepreneur.details?.ogrn && testRegex.test(entrepreneur.details.ogrn))
        highlightedFields.push('details.ogrn')

      // Проверяем полное ФИО
      const fullName = `${entrepreneur.last_name || ''} ${entrepreneur.first_name || ''} ${entrepreneur.middle_name || ''}`.trim()
      if (this.matchesFullName(fullName, queryWords)) {
        highlightedFields.push('full_name')
      }

      results.push({
        type: 'entrepreneur',
        data: entrepreneur,
        highlightedFields,
      })
    }

    return results
  }

  private async searchOrganizations(regexPattern: string): Promise<ISearchResult[]> {
    const organizationModel = new Organization(this.storage)
    const results: ISearchResult[] = []

    const organizations = await organizationModel.getMany({
      deleted: false,
      $or: [
        { short_name: { $regex: regexPattern, $options: 'i' } },
        { 'details.inn': { $regex: regexPattern, $options: 'i' } },
        { 'details.ogrn': { $regex: regexPattern, $options: 'i' } },
      ],
    })

    for (const organization of organizations.results) {
      const highlightedFields = []

      // Создаем RegExp для проверки подсветки
      const testRegex = new RegExp(regexPattern, 'i')

      if (testRegex.test(organization.short_name))
        highlightedFields.push('short_name')
      if (organization.details?.inn && testRegex.test(organization.details.inn))
        highlightedFields.push('details.inn')
      if (organization.details?.ogrn && testRegex.test(organization.details.ogrn))
        highlightedFields.push('details.ogrn')

      results.push({
        type: 'organization',
        data: organization as ExternalOrganizationData,
        highlightedFields,
      })
    }

    return results
  }

  private matchesFullName(fullName: string, queryWords: string[]): boolean {
    // Проверяем, содержит ли полное ФИО все слова из запроса
    const fullNameLower = fullName.toLowerCase()
    return queryWords.every(word => fullNameLower.includes(word.toLowerCase()))
  }
}
