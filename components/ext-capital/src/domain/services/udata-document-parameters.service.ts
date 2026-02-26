import { Injectable, Inject, Logger } from '@nestjs/common';
import { UDATA_REPOSITORY, UdataRepository } from '~/domain/common/repositories/udata.repository';
import { Cooperative } from 'cooptypes';
import moment from 'moment';
import 'moment/locale/ru';
import { randomBytes } from 'crypto';

export const UDATA_DOCUMENT_PARAMETERS_SERVICE = Symbol('UdataDocumentParametersService');

/**
 * Сервис для генерации и сохранения параметров документов в Udata.
 * Используется для генерации уникальных номеров и дат документов,
 * которые затем используются в шаблонах документов.
 */
@Injectable()
export class UdataDocumentParametersService {
  private readonly logger = new Logger(UdataDocumentParametersService.name);

  constructor(@Inject(UDATA_REPOSITORY) private readonly udataRepository: UdataRepository) {}

  /**
   * Генерирует уникальный номер документа на основе хеша
   * Берет первые 16 символов из случайного хеша
   */
  private generateDocumentNumber(): string {
    const hash = randomBytes(32).toString('hex');
    return hash.substring(0, 16).toUpperCase();
  }

  /**
   * Генерирует дату в формате DD.MM.YYYY
   */
  private generateDate(): string {
    return moment().format('DD.MM.YYYY');
  }

  /**
   * Генерирует дату в формате "DD месяца YYYY года"
   */
  private generateFormattedDate(): string {
    return moment().locale('ru').format('DD MMMM YYYY г.');
  }

  /**
   * Генерирует и сохраняет параметры для оферты Благорост
   */
  async generateBlagorostOfferParameters(coopname: string, username: string): Promise<void> {
    // Проверяем, не существуют ли уже параметры
    const existingNumber = await this.udataRepository.get(
      coopname,
      username,
      Cooperative.Model.UdataKey.BLAGOROST_AGREEMENT_NUMBER
    );

    if (existingNumber?.value) {
      this.logger.log(
        `Параметры оферты Благорост уже существуют для ${username}: ${existingNumber.value}`
      );
      return;
    }

    const number = this.generateDocumentNumber();
    const date = this.generateFormattedDate();

    await Promise.all([
      this.udataRepository.save({
        coopname,
        username,
        key: Cooperative.Model.UdataKey.BLAGOROST_AGREEMENT_NUMBER,
        value: number,
      }),
      this.udataRepository.save({
        coopname,
        username,
        key: Cooperative.Model.UdataKey.BLAGOROST_AGREEMENT_CREATED_AT,
        value: date,
      }),
    ]);

    this.logger.log(`Созданы параметры оферты Благорост для ${username}: ${number}, ${date}`);
  }

  /**
   * Генерирует и сохраняет параметры для оферты Генератор
   */
  async generateGeneratorOfferParameters(coopname: string, username: string): Promise<void> {
    // Проверяем, не существуют ли уже параметры
    const existingNumber = await this.udataRepository.get(
      coopname,
      username,
      Cooperative.Model.UdataKey.GENERATOR_AGREEMENT_NUMBER
    );

    if (existingNumber?.value) {
      this.logger.log(
        `Параметры оферты Генератор уже существуют для ${username}: ${existingNumber.value}`
      );
      return;
    }

    const number = this.generateDocumentNumber();
    const date = this.generateFormattedDate();

    await Promise.all([
      this.udataRepository.save({
        coopname,
        username,
        key: Cooperative.Model.UdataKey.GENERATOR_AGREEMENT_NUMBER,
        value: number,
      }),
      this.udataRepository.save({
        coopname,
        username,
        key: Cooperative.Model.UdataKey.GENERATOR_AGREEMENT_CREATED_AT,
        value: date,
      }),
    ]);

    this.logger.log(`Созданы параметры оферты Генератор для ${username}: ${number}, ${date}`);
  }

  /**
   * Генерирует и сохраняет параметры для договора УХД (Generation Contract)
   */
  async generateGenerationContractParameters(coopname: string, username: string): Promise<void> {
    // Проверяем, не существуют ли уже параметры
    const existingNumber = await this.udataRepository.get(
      coopname,
      username,
      Cooperative.Model.UdataKey.BLAGOROST_CONTRIBUTOR_CONTRACT_NUMBER
    );

    if (existingNumber?.value) {
      this.logger.log(
        `Параметры договора УХД уже существуют для ${username}: ${existingNumber.value}`
      );
      return;
    }

    const number = this.generateDocumentNumber();
    const date = this.generateDate();

    await Promise.all([
      this.udataRepository.save({
        coopname,
        username,
        key: Cooperative.Model.UdataKey.BLAGOROST_CONTRIBUTOR_CONTRACT_NUMBER,
        value: number,
      }),
      this.udataRepository.save({
        coopname,
        username,
        key: Cooperative.Model.UdataKey.BLAGOROST_CONTRIBUTOR_CONTRACT_CREATED_AT,
        value: date,
      }),
    ]);

    this.logger.log(`Созданы параметры договора УХД для ${username}: ${number}, ${date}`);
  }

  /**
   * Генерирует и сохраняет параметры для соглашения о хранении
   */
  async generateStorageAgreementParameters(coopname: string, username: string): Promise<void> {
    // Проверяем, не существуют ли уже параметры
    const existingNumber = await this.udataRepository.get(
      coopname,
      username,
      Cooperative.Model.UdataKey.BLAGOROST_STORAGE_AGREEMENT_NUMBER
    );

    if (existingNumber?.value) {
      this.logger.log(
        `Параметры соглашения о хранении уже существуют для ${username}: ${existingNumber.value}`
      );
      return;
    }

    const number = this.generateDocumentNumber();
    const date = this.generateDate();

    await Promise.all([
      this.udataRepository.save({
        coopname,
        username,
        key: Cooperative.Model.UdataKey.BLAGOROST_STORAGE_AGREEMENT_NUMBER,
        value: number,
      }),
      this.udataRepository.save({
        coopname,
        username,
        key: Cooperative.Model.UdataKey.BLAGOROST_STORAGE_AGREEMENT_CREATED_AT,
        value: date,
      }),
    ]);

    this.logger.log(`Созданы параметры соглашения о хранении для ${username}: ${number}, ${date}`);
  }

  /**
   * Генерирует и сохраняет параметры для соглашения Благорост (если еще не существуют)
   * Используется для пути Генератора
   */
  async generateBlagorostAgreementParametersIfNotExist(
    coopname: string,
    username: string
  ): Promise<void> {
    // Проверяем, не существуют ли уже параметры
    const existingNumber = await this.udataRepository.get(
      coopname,
      username,
      Cooperative.Model.UdataKey.BLAGOROST_AGREEMENT_NUMBER
    );

    if (existingNumber?.value) {
      this.logger.log(
        `Параметры соглашения Благорост уже существуют для ${username}: ${existingNumber.value}`
      );
      return;
    }

    // Если параметров нет, генерируем их (это означает путь Генератора)
    await this.generateBlagorostOfferParameters(coopname, username);
  }

  /**
   * Генерирует параметры для GenerationContract, если они отсутствуют
   */
  async generateGenerationContractParametersIfNotExist(coopname: string, username: string): Promise<void> {
    const existingNumber = await this.udataRepository.get(
      coopname,
      username,
      Cooperative.Model.UdataKey.BLAGOROST_CONTRIBUTOR_CONTRACT_NUMBER
    );

    if (existingNumber?.value) {
      this.logger.log(`Параметры GenerationContract уже существуют для ${username}`);
      return;
    }

    await this.generateGenerationContractParameters(coopname, username);
  }

  /**
   * Генерирует параметры для StorageAgreement, если они отсутствуют
   */
  async generateStorageAgreementParametersIfNotExist(coopname: string, username: string): Promise<void> {
    const existingNumber = await this.udataRepository.get(
      coopname,
      username,
      Cooperative.Model.UdataKey.BLAGOROST_STORAGE_AGREEMENT_NUMBER
    );

    if (existingNumber?.value) {
      this.logger.log(`Параметры StorageAgreement уже существуют для ${username}`);
      return;
    }

    await this.generateStorageAgreementParameters(coopname, username);
  }

  /**
   * Генерирует параметры для GeneratorOffer, если они отсутствуют
   */
  async generateGeneratorOfferParametersIfNotExist(coopname: string, username: string): Promise<void> {
    const existingNumber = await this.udataRepository.get(
      coopname,
      username,
      Cooperative.Model.UdataKey.GENERATOR_AGREEMENT_NUMBER
    );

    if (existingNumber?.value) {
      this.logger.log(`Параметры GeneratorOffer уже существуют для ${username}`);
      return;
    }

    await this.generateGeneratorOfferParameters(coopname, username);
  }

  /**
   * Сохраняет параметры договора участника при импорте
   * @param coopname - имя кооператива
   * @param username - имя пользователя
   * @param contractNumber - номер договора
   * @param contractDate - дата договора в формате DD.MM.YYYY
   */
  async saveContributorContractParameters(
    coopname: string,
    username: string,
    contractNumber: string,
    contractDate: string
  ): Promise<void> {
    await Promise.all([
      this.udataRepository.save({
        coopname,
        username,
        key: Cooperative.Model.UdataKey.BLAGOROST_CONTRIBUTOR_CONTRACT_NUMBER,
        value: contractNumber,
      }),
      this.udataRepository.save({
        coopname,
        username,
        key: Cooperative.Model.UdataKey.BLAGOROST_CONTRIBUTOR_CONTRACT_CREATED_AT,
        value: contractDate,
      }),
    ]);

    this.logger.log(
      `Сохранены параметры договора для участника ${username}: ${contractNumber}, ${contractDate}`
    );
  }
}
