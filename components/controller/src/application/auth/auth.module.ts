// src/auth/auth.module.ts
import { Module, forwardRef } from '@nestjs/common';
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
import config from '~/config/config';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: config.jwt.secret,
      signOptions: { expiresIn: config.jwt.accessExpirationMinutes },
    }),
    forwardRef(() => AuthDomainModule),
    AccountDomainModule,
    UserDomainModule,
    forwardRef(() => NotificationModule),
    forwardRef(() => TokenApplicationModule),
    BlockchainModule,
  ],
  providers: [JwtAuthStrategy, HttpJwtAuthGuard, AuthInteractor, AuthResolver, AuthService],
  exports: [PassportModule, JwtModule, HttpJwtAuthGuard],
})
export class AuthModule {}
