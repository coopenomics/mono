// app.module.ts
import { Module } from '@nestjs/common';
import { AccountDomainModule } from './account/account-domain.module';
import { ExtensionDomainModule } from './extension/extension-domain.module';
import { PaymentMethodDomainModule } from './payment-method/payment-method-domain.module';
import { ProviderDomainModule } from './provider/provider.module';
import { SystemDomainModule } from './system/system-domain.module';
import { BranchDomainModule } from './branch/branch-domain.module';
import { DocumentDomainModule } from './document/document.module';
import { FreeDecisionDomainModule } from './free-decision/free-decision.module';
import { AgreementDomainModule } from './agreement/agreement-domain.module';
import { ParticipantDomainModule } from './participant/participant-domain.module';
import { AuthDomainModule } from './auth/auth.module';
import { AgendaDomainModule } from './agenda/agenda-domain.module';
import { CooplaceDomainModule } from './cooplace/cooplace.module';
import { DesktopDomainModule } from './desktop/desktop-domain.module';
import { MeetDomainModule } from './meet/meet-domain.module';
import { ControllerWsMeetModule } from './meet/controllers-ws-meet.module';
import { UserCertificateDomainModule } from './user-certificate/user-certificate.module';
import { GatewayDomainModule } from './gateway/gateway-domain.module';
import { WalletDomainModule } from './wallet/wallet-domain.module';
import { NotificationDomainModule } from './notification/notification-domain.module';

@Module({
  imports: [
    AuthDomainModule,
    AgendaDomainModule,
    AccountDomainModule,
    AgreementDomainModule,
    DesktopDomainModule,
    ExtensionDomainModule,
    PaymentMethodDomainModule,
    ProviderDomainModule,
    SystemDomainModule,
    BranchDomainModule,
    DocumentDomainModule,
    FreeDecisionDomainModule,
    ParticipantDomainModule,
    CooplaceDomainModule,
    MeetDomainModule,
    ControllerWsMeetModule,
    UserCertificateDomainModule,
    GatewayDomainModule,
    WalletDomainModule,
    NotificationDomainModule,
  ],
  exports: [
    AuthDomainModule,
    AgendaDomainModule,
    AccountDomainModule,
    AgreementDomainModule,
    DesktopDomainModule,
    ExtensionDomainModule,
    PaymentMethodDomainModule,
    ProviderDomainModule,
    SystemDomainModule,
    BranchDomainModule,
    DocumentDomainModule,
    FreeDecisionDomainModule,
    ParticipantDomainModule,
    CooplaceDomainModule,
    MeetDomainModule,
    UserCertificateDomainModule,
    GatewayDomainModule,
    WalletDomainModule,
    NotificationDomainModule,
  ],
})
export class DomainModule {}
