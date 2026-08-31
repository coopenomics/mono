import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';
import { CardcoopAttestationState } from '../../infrastructure/entities/cardcoop-attestation.typeorm-entity';

registerEnumType(CardcoopAttestationState, {
  name: 'CardcoopAttestationState',
  description: 'Состояние свидетельства о членстве, выданного кооперативом в сеть «Карта пайщика»',
});

/**
 * Что кооператив знает о карте своего пайщика (story 7.4, FR-E4).
 *
 * Намеренно немного: карта живёт в сети, а не здесь. Кооператив видит номер, состояние
 * выданного им свидетельства и дату вступления, о которой сам же и свидетельствовал.
 * Ни имени держателя, ни его членств в других кооперативах тут нет и быть не может —
 * это чужие сведения, и card.coop их кооперативу не отдаёт.
 */
@ObjectType('CardcoopMyCard')
export class CardcoopMyCardDTO {
  @Field(() => Boolean, {
    description: 'Выпущена ли карта: пайщик дошёл до сети и связал её со своей учётной записью',
  })
  issued!: boolean;

  @Field(() => String, {
    nullable: true,
    description: 'Номер карты — то, что человек называет вслух; null, пока карта не выпущена',
  })
  cardNumber!: string | null;

  @Field(() => CardcoopAttestationState, {
    nullable: true,
    description: 'Состояние свидетельства о членстве; null, пока карта не выпущена',
  })
  state!: CardcoopAttestationState | null;

  @Field(() => String, {
    nullable: true,
    description: 'Дата вступления в кооператив, о которой свидетельствует документ (YYYY-MM-DD)',
  })
  memberSince!: string | null;

  @Field(() => String, {
    description:
      'Адрес выпуска карты в сети: сюда уходит пайщик, у которого карты ещё нет. '
      + 'Строится из адреса сети и имени кооператива, руками нигде не вписывается',
  })
  enterUrl!: string;
}
