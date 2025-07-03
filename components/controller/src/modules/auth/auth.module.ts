// src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthStrategy } from './strategies/jwt.strategy';
import { HttpJwtAuthGuard } from './guards/http-jwt-auth.guard';
import { DomainModule } from '~/domain/domain.module';
import { AuthResolver } from './resolvers/auth.resolver';
import { AuthService } from './services/auth.service';
import config from '~/config/config';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: config.jwt.secret,
      signOptions: { expiresIn: config.jwt.accessExpirationMinutes },
    }),
    DomainModule,
  ],
  providers: [JwtAuthStrategy, HttpJwtAuthGuard, AuthResolver, AuthService],
  exports: [PassportModule, JwtModule, HttpJwtAuthGuard],
})
export class AuthModule {}
