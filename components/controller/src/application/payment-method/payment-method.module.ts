import { Module } from '@nestjs/common';
import { PaymentMethodService } from './services/payment-method.service';
import { PaymentMethodResolver } from './resolvers/payment-method.resolver';
import { PaymentMethodInteractor } from './interactors/payment-method.interactor';
import { CoreRightsModule } from '../rights/core-rights.module';

@Module({
  imports: [CoreRightsModule, ],
  controllers: [],
  providers: [PaymentMethodService, PaymentMethodResolver, PaymentMethodInteractor],
  exports: [PaymentMethodInteractor],
})
export class PaymentMethodModule {}
