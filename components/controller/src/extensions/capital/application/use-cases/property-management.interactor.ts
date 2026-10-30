import { Injectable, Inject } from '@nestjs/common';
import { Registry } from '@coopenomics/docs-templates';
import { CapitalContract } from 'cooptypes';
import { CapitalBlockchainPort, CAPITAL_BLOCKCHAIN_PORT } from '../../domain/interfaces/capital-blockchain.port';
import type { CreateProjectPropertyDomainInput } from '../../domain/actions/create-project-property-domain-input.interface';
import { DomainError, DomainToBlockchainUtils, type PaginationInputDTO, type PaginationResult } from '@coopenomics/extension-kit';
import type { InnerTransactResult, ISignedDocument } from '@coopenomics/innercoop';
import { PROGRAM_PROPERTY_REPOSITORY, type ProgramPropertyRepository } from '../../domain/repositories/program-property.repository';
import type { ProgramPropertyDomainEntity } from '../../domain/entities/program-property.entity';
import { ProgramPropertyStatus } from '../../domain/enums/program-property-status.enum';
import type { CreateProgramPropertyInputDTO } from '../dto/property_management/create-program-property-input.dto';
import type { SignProgramPropertyActInputDTO } from '../dto/property_management/sign-program-property-act-input.dto';
import type { GenerateProgramPropertyActInputDTO } from '../dto/property_management/generate-program-property-act-input.dto';
import type { ProgramPropertyFilterInputDTO } from '../dto/property_management/program-property-filter.input';
import { t } from '../../i18n';

/** Позиция имущества, как её несут заявление 1070, протокол 1071 и акт 1072. */
export interface ProgramPropertyPosition {
  property_hash: string;
  property_name: string;
  property_description: string;
  property_quantity: string;
  property_unit: string;
  property_amount: string;
}

/** Мета документа из цепи приходит объектом, из ввода — объектом, из старых записей — строкой. */
function metaOf(document?: ISignedDocument | null): Record<string, any> {
  const meta = (document as any)?.meta;
  if (!meta) return {};
  if (typeof meta === 'string') return meta ? JSON.parse(meta) : {};
  return meta;
}

/**
 * Описание имущества в цепи — одна строка из позиции заявления: по ней
 * совет и бухгалтер узнают взнос без открытия документа.
 */
export function chainPropertyDescription(position: ProgramPropertyPosition): string {
  return t('capital.programProperty.chainDescription', {
    name: position.property_name,
    description: position.property_description,
    quantity: position.property_quantity,
    unit: position.property_unit,
  });
}

/**
 * Интерактор домена для управления имущественными взносами CAPITAL контракта:
 * паевой взнос имуществом в программу «Благорост» (процесс p.cap.prop) и
 * имущественный взнос в проект.
 */
@Injectable()
export class PropertyManagementInteractor {
  constructor(
    @Inject(CAPITAL_BLOCKCHAIN_PORT)
    private readonly capitalBlockchainPort: CapitalBlockchainPort,
    private readonly domainToBlockchainUtils: DomainToBlockchainUtils,
    @Inject(PROGRAM_PROPERTY_REPOSITORY)
    private readonly programPropertyRepository: ProgramPropertyRepository
  ) {}

  /**
   * Создание проектного имущественного взноса в CAPITAL контракте
   */
  async createProjectProperty(data: CreateProjectPropertyDomainInput): Promise<InnerTransactResult> {
    return await this.capitalBlockchainPort.createProjectProperty(data);
  }

  /**
   * Заявление о паевом взносе имуществом. Позицию и оценку берём из
   * подписанного заявления: оценку называет пайщик, контракт её проверяет,
   * сервер её не считает и не принимает отдельным полем.
   */
  async createProgramProperty(data: CreateProgramPropertyInputDTO): Promise<InnerTransactResult> {
    const meta = data.statement.meta;
    if (Number(meta.registry_id) !== Registry.CapitalizationPropertyInvestStatement.registry_id)
      throw DomainError.badRequest('CAPITAL_PROPERTY_STATEMENT_INVALID');
    if (meta.username !== data.username || meta.coopname !== data.coopname)
      throw DomainError.badRequest('CAPITAL_PROPERTY_STATEMENT_MISMATCH');

    const blockchainData: CapitalContract.Actions.CreateProgramProperty.ICreateProgramProperty = {
      coopname: data.coopname,
      username: data.username,
      property_hash: meta.property_hash.toLowerCase(),
      property_amount: meta.property_amount,
      property_description: chainPropertyDescription(meta),
      statement: this.domainToBlockchainUtils.convertSignedDocumentToBlockchainFormat(data.statement),
    };

    return await this.capitalBlockchainPort.createProgramProperty(blockchainData);
  }

  /**
   * Первая подпись акта пайщиком. Правила контракта (решение совета принято,
   * акт подписывает автор заявления, акт по этому взносу) проверяются до
   * обращения в цепь, чтобы пайщик не узнавал о них из отказа цепи.
   */
  async signProgramPropertyAct(data: SignProgramPropertyActInputDTO): Promise<InnerTransactResult> {
    const property = await this.getPropertyReadyForAct(data.property_hash, data.username);

    const actMeta = metaOf(data.act as unknown as ISignedDocument);
    if (
      Number(actMeta.registry_id) !== Registry.CapitalizationPropertyInvestAct.registry_id ||
      String(actMeta.property_hash ?? '').toLowerCase() !== property.property_hash
    )
      throw DomainError.badRequest('CAPITAL_PROPERTY_ACT_MISMATCH');

    return await this.capitalBlockchainPort.signProgramPropertyAct1({
      coopname: data.coopname,
      username: data.username,
      property_hash: property.property_hash,
      act: this.domainToBlockchainUtils.convertSignedDocumentToBlockchainFormat(data.act),
    });
  }

  /**
   * Данные акта приёма-передачи: позиция — из заявления, номер решения — из
   * протокола совета. Акт собирается только по взносу с решением совета.
   */
  async buildActGenerationData(data: GenerateProgramPropertyActInputDTO) {
    const property = await this.getPropertyReadyForAct(data.property_hash, data.username);

    const decisionId = Number(metaOf(property.authorization).decision_id);
    if (!decisionId) throw DomainError.conflict('CAPITAL_PROPERTY_DECISION_MISSING');

    return {
      coopname: data.coopname,
      username: data.username,
      registry_id: Registry.CapitalizationPropertyInvestAct.registry_id,
      decision_id: decisionId,
      ...this.positionOf(property),
    };
  }

  /** Позиция имущества из заявления пайщика (мета подписанного документа). */
  positionOf(property: ProgramPropertyDomainEntity): ProgramPropertyPosition {
    const meta = metaOf(property.statement);
    return {
      property_hash: property.property_hash,
      property_name: String(meta.property_name ?? ''),
      property_description: String(meta.property_description ?? ''),
      property_quantity: String(meta.property_quantity ?? ''),
      property_unit: String(meta.property_unit ?? ''),
      property_amount: String(meta.property_amount ?? property.property_amount ?? ''),
    };
  }

  async getProgramProperties(
    filter?: ProgramPropertyFilterInputDTO,
    options?: PaginationInputDTO
  ): Promise<PaginationResult<ProgramPropertyDomainEntity>> {
    return await this.programPropertyRepository.findAllPaginated(filter, options);
  }

  async getProgramProperty(propertyHash: string): Promise<ProgramPropertyDomainEntity | null> {
    return await this.programPropertyRepository.findBySyncKey('property_hash', propertyHash.toLowerCase());
  }

  /** Взнос пайщика, по которому совет принял решение, — акт можно собирать и подписывать. */
  private async getPropertyReadyForAct(propertyHash: string, username: string): Promise<ProgramPropertyDomainEntity> {
    const property = await this.getProgramPropertyOrFail(propertyHash);
    if (property.username !== username) throw DomainError.forbidden('CAPITAL_PROPERTY_NOT_OWNER');
    if (property.status !== ProgramPropertyStatus.AUTHORIZED) throw DomainError.conflict('CAPITAL_PROPERTY_NOT_AUTHORIZED');
    return property;
  }

  private async getProgramPropertyOrFail(propertyHash: string): Promise<ProgramPropertyDomainEntity> {
    const property = await this.getProgramProperty(propertyHash);
    if (!property || !property.present) throw DomainError.notFound('CAPITAL_PROPERTY_NOT_FOUND');
    return property;
  }
}
