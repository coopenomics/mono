import { DynamicModule, Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ExtensionJwtStrategy } from './extension-jwt.strategy';
import { ExtensionJwtAuthGuard } from './extension-jwt.guard';

export interface ExtensionAuthOptions {
  secret: string;
}

/**
 * Auth-модуль расширения. Подключается в корневой AppModule:
 *
 *   imports: [ExtensionAuthModule.forRoot({ secret: env.JWT_SECRET })]
 *
 * Регистрирует passport-jwt стратегию + guard. Импортируйте `ExtensionJwtAuthGuard`
 * в resolver'ах через `@UseGuards`.
 */
@Module({})
export class ExtensionAuthModule {
  static forRoot(options: ExtensionAuthOptions): DynamicModule {
    return {
      module: ExtensionAuthModule,
      imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
      providers: [
        {
          provide: ExtensionJwtStrategy,
          useFactory: () => new ExtensionJwtStrategy({ secret: options.secret }),
        },
        ExtensionJwtAuthGuard,
      ],
      exports: [PassportModule, ExtensionJwtStrategy, ExtensionJwtAuthGuard],
    };
  }
}
