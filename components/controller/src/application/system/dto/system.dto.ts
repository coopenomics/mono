import { ObjectType, Field } from '@nestjs/graphql';
import type { SystemInfoDomainEntity } from '~/domain/system/entities/systeminfo-domain.entity';
import { IsOptional, IsString, ValidateNested } from 'class-validator';
import { BlockchainInfoDTO } from './blockchain-info.dto';
import { CooperativeOperatorAccountDTO } from '../../common/dto/cooperator-account.dto';
import { SystemStatus } from './system-status.dto';
import type { SystemStatusDomainType } from '~/domain/system/interfaces/system-status-domain.types';
import { BlockchainAccountDTO } from '../../account/dto/blockchain-account.dto';
import { Type } from 'class-transformer';
import { ContactsDTO } from './contacts.dto';
import { VarsDTO } from './vars.dto';
import { SymbolsDTO } from './symbols.dto';
import { SettingsDTO } from './settings.dto';
import { BoardMemberDTO } from './board-member.dto';
import { SystemFeaturesDTO } from './system-features.dto';
import { isRegistrationOpen } from '~/domain/system/utils/is-registration-open.util';

@ObjectType('SystemInfo')
export class SystemInfoDTO {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsString()
  public readonly coopname: string;

  @Field(() => ContactsDTO, { description: 'Контакты кооператива', nullable: true })
  @ValidateNested()
  @IsOptional()
  public readonly contacts?: ContactsDTO;

  @Field(() => VarsDTO, { description: 'Переменные кооператива', nullable: true })
  @ValidateNested()
  public readonly vars?: VarsDTO | null;

  @Field(() => BlockchainInfoDTO, { description: 'Набор данных с информацией о состоянии блокчейна' })
  @ValidateNested()
  public readonly blockchain_info: BlockchainInfoDTO;

  @Field(() => CooperativeOperatorAccountDTO, { description: 'Объект аккаунта кооператива у оператора' })
  @ValidateNested()
  public readonly cooperator_account: CooperativeOperatorAccountDTO;

  @Field(() => BlockchainAccountDTO, { description: 'Объект системного аккаунта кооператива в блокчейне' })
  @ValidateNested()
  @Type(() => BlockchainAccountDTO)
  public readonly blockchain_account: BlockchainAccountDTO;

  @Field(() => SystemStatus, { description: 'Статус контроллера кооператива' })
  public readonly system_status: SystemStatusDomainType;

  @Field(() => SymbolsDTO, { description: 'Символы и их точности блокчейна' })
  @ValidateNested()
  public readonly symbols: SymbolsDTO;

  @Field(() => SettingsDTO, { description: 'Настройки системы' })
  @ValidateNested()
  public readonly settings: SettingsDTO;

  @Field(() => Boolean, { description: 'Доступен ли функционал провайдера для подписок и запуска ПО' })
  public readonly is_providered: boolean;

  @Field(() => Boolean, {
    description: 'Требуется ли членство в союзе кооперативов для подключения к кооперативной экономике',
  })
  public readonly is_unioned!: boolean;

  @Field(() => String, { description: 'Ссылка на анкету для получения членства в союзе кооперативов' })
  public readonly union_link!: string;

  @Field(() => [BoardMemberDTO], { description: 'Члены совета кооператива', nullable: true })
  @ValidateNested()
  public readonly board_members?: BoardMemberDTO[];

  @Field(() => SystemFeaturesDTO, { description: 'Доступные функции платформы' })
  @ValidateNested()
  public readonly features!: SystemFeaturesDTO;

  constructor(entity: SystemInfoDomainEntity, isProvidered = false) {
    this.coopname = entity.coopname;
    this.contacts = entity.contacts;
    this.vars = entity.vars;
    this.blockchain_info = new BlockchainInfoDTO(entity.blockchain_info);
    this.system_status = entity.system_status || 'install';
    this.symbols = entity.symbols;
    this.settings = new SettingsDTO(entity.settings, isRegistrationOpen(entity.vars));
    this.blockchain_account = entity.blockchain_account;
    this.cooperator_account = new CooperativeOperatorAccountDTO({
      ...entity.cooperator_account,
      ...entity.user_account,
      active_participants_count: Number(entity.cooperator_account.active_participants_count),
    });
    this.is_providered = isProvidered;
    this.is_unioned = entity.is_unioned;
    this.union_link = entity.union_link;
    this.board_members = entity.board_members?.map((member) => new BoardMemberDTO(member));
    this.features = entity.features || { search: false };
  }
}
