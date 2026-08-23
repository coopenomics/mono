// src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthStrategy } from './strategies/jwt.strategy';
import { HttpJwtAuthGuard } from '@coopenomics/extension-kit';
import { AuthResolver } from './resolvers/auth.resolver';
import { AuthService } from './services/auth.service';
import { AuthInteractor } from './interactors/auth.interactor';
import { AuthDomainModule } from '~/domain/auth/auth.module';
import { AccountDomainModule } from '~/domain/account/account-domain.module';
import { UserDomainModule } from '~/domain/user/user-domain.module';
import { NotificationModule } from '~/application/notification/notification.module';
import { TokenApplicationModule } from '~/application/token/token-application.module';
import { BlockchainModule } from '~/infrastructure/blockchain/blockchain.module';
import { AuthV2Module } from '~/application/auth-v2/auth-v2.module';
import config from '~/config/config';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: config.jwt.secret,
      signOptions: { expiresIn: config.jwt.accessExpirationMinutes },
    }),
    AuthDomainModule,
    AccountDomainModule,
    UserDomainModule,
    NotificationModule,
    TokenApplicationModule,
    BlockchainModule,
    // 2FA-гейт легаси-входа по подписи: LoginTwoFactorService (auth-v2).
    AuthV2Module,
  ],
  providers: [JwtAuthStrategy, HttpJwtAuthGuard, AuthInteractor, AuthResolver, AuthService],
  exports: [PassportModule, JwtModule, HttpJwtAuthGuard],
})
export class AuthModule {}
