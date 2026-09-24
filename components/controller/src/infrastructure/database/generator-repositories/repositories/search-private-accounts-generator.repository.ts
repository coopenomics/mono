import { Injectable, Inject } from '@nestjs/common';
import { SearchPrivateAccountsRepository } from '~/domain/common/repositories/search-private-accounts.repository';
import type {
  SearchPrivateAccountsInputDomainInterface,
  PrivateAccountSearchResultDomainInterface,
  PrivateAccountSearchDataDomainInterface,
} from '~/domain/common/interfaces/search-private-accounts-domain.interface';
import type { IndividualDomainInterface } from '~/domain/common/interfaces/individual-domain.interface';
import type { EntrepreneurDomainInterface } from '~/domain/common/interfaces/entrepreneur-domain.interface';
import type { OrganizationDomainInterface } from '~/domain/common/interfaces/organization-domain.interface';
import { GENERATOR_PORT, GeneratorPort } from '~/domain/document/ports/generator.port';
import type { ISearchResult } from '@coopenomics/factory';

/**
 * Инфраструктурная реализация репозитория поиска приватных аккаунтов
 * Использует фабрику документов для выполнения поиска
 */
@Injectable()
export class SearchPrivateAccountsRepositoryImplementation implements SearchPrivateAccountsRepository {
  constructor(@Inject(GENERATOR_PORT) private readonly generatorPort: GeneratorPort) {}

  /**
   * Выполняет поиск приватных аккаунтов через фабрику документов
   * @param input Входные данные для поиска
   * @returns Массив результатов поиска, преобразованных в доменные интерфейсы
   */
  async searchPrivateAccounts(
    input: SearchPrivateAccountsInputDomainInterface
  ): Promise<PrivateAccountSearchResultDomainInterface[]> {
    // Вызываем метод поиска из фабрики документов
    const factoryResults: ISearchResult[] = await this.generatorPort.search(input.query);

    // Преобразуем результаты фабрики в доменные интерфейсы
    const domainResults: PrivateAccountSearchResultDomainInterface[] = factoryResults.map((result) =>
      this.convertFactoryResultToDomain(result)
    );

    return domainResults;
  }

  /**
   * Преобразует результат из фабрики в доменный интерфейс
   * @param factoryResult Результат поиска из фабрики
   * @returns Результат поиска в доменном формате
   */
  private convertFactoryResultToDomain(factoryResult: ISearchResult): PrivateAccountSearchResultDomainInterface {
    let domainData: PrivateAccountSearchDataDomainInterface;

    switch (factoryResult.type) {
      case 'individual':
        domainData = this.convertIndividualData(factoryResult.data as any);
        break;
      case 'entrepreneur':
        domainData = this.convertEntrepreneurData(factoryResult.data as any);
        break;
      case 'organization':
        domainData = this.convertOrganizationData(factoryResult.data as any);
        break;
      default:
        // i18n-ignore: внутренняя ошибка генератора поиска приватных аккаунтов (неизвестный factoryResult.type), до пайщика не доходит
        throw new Error(`Неизвестный тип данных: ${factoryResult.type}`);
    }

    return {
      type: factoryResult.type,
      data: domainData,
      score: factoryResult.score,
      highlightedFields: factoryResult.highlightedFields,
    };
  }

  /**
   * Преобразует данные физического лица из фабрики в доменный интерфейс
   * @param data Данные из фабрики
   * @returns Доменный интерфейс физического лица
   */
  private convertIndividualData(data: any): IndividualDomainInterface {
    return {
      username: data.username,
      first_name: data.first_name,
      last_name: data.last_name,
      middle_name: data.middle_name,
      birthdate: data.birthdate,
      full_address: data.full_address,
      phone: data.phone,
      email: data.email,
      passport: data.passport
        ? {
            series: data.passport.series,
            number: data.passport.number,
            issued_by: data.passport.issued_by,
            issued_at: data.passport.issued_at,
            code: data.passport.code,
          }
        : undefined,
    };
  }

  /**
   * Преобразует данные индивидуального предпринимателя из фабрики в доменный интерфейс
   * @param data Данные из фабрики
   * @returns Доменный интерфейс индивидуального предпринимателя
   */
  private convertEntrepreneurData(data: any): EntrepreneurDomainInterface {
    return {
      username: data.username,
      first_name: data.first_name,
      last_name: data.last_name,
      middle_name: data.middle_name,
      birthdate: data.birthdate,
      phone: data.phone,
      email: data.email,
      country: data.country,
      city: data.city,
      full_address: data.full_address,
      details: {
        inn: data.details.inn,
        ogrn: data.details.ogrn,
      },
    };
  }

  /**
   * Преобразует данные организации из фабрики в доменный интерфейс
   * @param data Данные из фабрики
   * @returns Доменный интерфейс организации
   */
  private convertOrganizationData(data: any): OrganizationDomainInterface {
    return {
      username: data.username,
      type: data.type,
      short_name: data.short_name,
      full_name: data.full_name,
      represented_by: {
        first_name: data.represented_by.first_name,
        last_name: data.represented_by.last_name,
        middle_name: data.represented_by.middle_name,
        position: data.represented_by.position,
        based_on: data.represented_by.based_on,
      },
      country: data.country,
      city: data.city,
      full_address: data.full_address,
      fact_address: data.fact_address,
      phone: data.phone,
      email: data.email,
      details: {
        inn: data.details.inn,
        ogrn: data.details.ogrn,
        kpp: data.details.kpp,
      },
    };
  }
}
