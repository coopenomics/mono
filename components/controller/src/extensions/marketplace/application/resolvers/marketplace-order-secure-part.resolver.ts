import { Injectable } from '@nestjs/common';
import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { MarketplaceOrderDTO } from '../dto/marketplace-order.dto';
import { MarketplaceSecurePartDTO } from '../dto/marketplace-secure-part.dto';
import { MarketplaceSecureDueService } from '../services/marketplace-secure-due.service';

/**
 * Обеспечительная часть в карточке заказа (99D-18): сколько, в каком
 * состоянии и когда станет членским взносом. Поле запрашивает только запрос
 * одного заказа: в лентах и реестрах оно не нужно, и каждая строка стоила бы
 * отдельного чтения учёта.
 */
@Resolver(() => MarketplaceOrderDTO)
@Injectable()
export class MarketplaceOrderSecurePartResolver {
  constructor(private readonly secureDue: MarketplaceSecureDueService) {}

  @ResolveField('secure_part', () => MarketplaceSecurePartDTO, {
    nullable: true,
    description:
      'Обеспечительная часть паевого взноса по заказу: сумма, состояние и дата списания в членский взнос. Пусто у заказов прежней модели.',
  })
  securePart(@Parent() order: MarketplaceOrderDTO): Promise<MarketplaceSecurePartDTO | null> {
    return this.secureDue.securePartOf(order);
  }
}
