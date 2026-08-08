import { Field, InputType } from '@nestjs/graphql';

/**
 * Параметры подписки на персональный канал событий пайщика.
 *
 * `coopname` принимается для симметрии с query/mutation и сверяется сервером
 * с собственным кооперативом. Адресация канала строится из имени аккаунта
 * JWT, НЕ из этого поля — подменить чужой поток через аргумент нельзя.
 */
@InputType('MarketplaceEventsInput')
export class MarketplaceEventsInputDTO {
  @Field(() => String, { description: 'Кооперативное имя.' })
  coopname!: string;
}
