import { Field, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';
import { IsBoolean, IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Тип комнаты в реестре ChatCoop. Редактировать (удалять) можно только `SECRETARY`;
 * системные (`MEMBERS`/`COUNCIL`) и проектные (`CAPITAL_PROJECT`) защищены.
 */
export enum ManagedRoomKindGql {
  MEMBERS = 'MEMBERS',
  COUNCIL = 'COUNCIL',
  CAPITAL_PROJECT = 'CAPITAL_PROJECT',
  SECRETARY = 'SECRETARY',
}

registerEnumType(ManagedRoomKindGql, {
  name: 'ManagedRoomKind',
  description: 'Тип комнаты: пайщики, совет, проект Capital, комната секретаря',
});

@ObjectType('ChatcoopSecretaryRoom')
export class ChatcoopSecretaryRoomDTO {
  @Field({ description: 'Внутренний идентификатор комнаты в реестре (для операций; это НЕ Matrix room id)' })
  id!: string;

  @Field({ description: 'Название комнаты' })
  displayLabel!: string;

  @Field(() => ManagedRoomKindGql, { description: 'Тип комнаты' })
  kind!: ManagedRoomKindGql;

  @Field({ description: 'Комната зашифрована (E2EE) — секретарь не транскрибирует такие комнаты' })
  encrypted!: boolean;

  @Field({ description: 'Секретарь присутствует в комнате' })
  secretaryInRoom!: boolean;

  @Field({ description: 'Можно ли удалить комнату из интерфейса (только комнаты секретаря)' })
  editable!: boolean;
}

@InputType('CreateSecretaryRoomInput')
export class CreateSecretaryRoomInputDTO {
  @Field({ description: 'Название комнаты' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(240)
  displayName!: string;

  @Field({ description: 'Публичная комната (любой может войти) либо приватная (вход по приглашению создателя)' })
  @IsBoolean()
  isPublic!: boolean;
}

@InputType('RemoveSecretaryRoomInput')
export class RemoveSecretaryRoomInputDTO {
  @Field({ description: 'Идентификатор комнаты в реестре, которую нужно удалить' })
  @IsString()
  @IsNotEmpty()
  id!: string;
}
