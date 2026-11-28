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

/** Роли сети для узла: кто ведущий и назначен ли кооператив узла оператором. */
export interface NetworkRoles {
  lead: string;
  isOperator: boolean;
}

const NO_NETWORK_ROLES: NetworkRoles = { lead: '', isOperator: false };

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

  @Field(() => Boolean, {
    description: 'Узел подключён к провайдеру: доступны каталог приложений, облачный хостинг и подписки',
  })
  public readonly has_provider: boolean;

  // Прежнее имя признака `has_provider`. Оставлено на один выпуск: стол,
  // загруженный до выкатки, запрашивает его; следующим выпуском — удалить.
  @Field(() => Boolean, {
    description: 'Устарело: то же, что has_provider',
    deprecationReason: 'Признак переименован в has_provider; поле будет удалено',
  })
  public readonly is_providered: boolean;

  @Field(() => String, {
    description: 'Ведущий сети — кооператив, который запустил цепь и ведёт сеть: назначает операторов, регистрирует кооперативы',
  })
  public readonly network_lead: string;

  @Field(() => Boolean, {
    description: 'Кооператив узла назначен оператором сети: он подключает другие кооперативы и обслуживает их',
  })
  public readonly is_operator: boolean;

  // Требование членства в союзе снято 20.10.2026: подключение начинается с тарифа,
  // мессенджер не обязателен. Поля оставлены на один выпуск постоянными, чтобы стол,
  // загруженный до выкатки, не падал на запросе системной информации; следующим
  // выпуском — удалить.
  @Field(() => Boolean, {
    description: 'Устарело: всегда false',
    deprecationReason: 'Требование членства в союзе снято; поле будет удалено',
  })
  public readonly is_unioned: boolean = false;

  @Field(() => String, {
    description: 'Устарело: всегда пустая строка',
    deprecationReason: 'Требование членства в союзе снято; поле будет удалено',
  })
  public readonly union_link: string = '';

  @Field(() => [BoardMemberDTO], { description: 'Члены совета кооператива', nullable: true })
  @ValidateNested()
  public readonly board_members?: BoardMemberDTO[];

  @Field(() => SystemFeaturesDTO, { description: 'Доступные функции платформы' })
  @ValidateNested()
  public readonly features!: SystemFeaturesDTO;

  constructor(entity: SystemInfoDomainEntity, hasProvider = false, roles: NetworkRoles = NO_NETWORK_ROLES) {
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
    this.has_provider = hasProvider;
    this.is_providered = hasProvider;
    this.network_lead = roles.lead;
    this.is_operator = roles.isOperator;
    this.board_members = entity.board_members?.map((member) => new BoardMemberDTO(member));
    this.features = entity.features || { search: false };
  }
}
