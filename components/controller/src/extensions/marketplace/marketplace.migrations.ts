/**
 * Миграции схемы конфига расширения «Стол заказов»: явный, упорядоченный список.
 *
 * Порядок здесь — порядок применения. Раньше он задавался двумя десятками
 * строк в модуле ядра, то есть ядро знало про версии чужих конфигов; теперь
 * DDL расширения едет вместе с самим расширением, как и его таблицы.
 */
import type { IExtensionSchemaMigration } from '@coopenomics/extension-kit';

import { marketplaceBootstrapV1Migration } from './migrations/marketplace-bootstrap-v1.migration';
import { marketplaceBootstrapV2Migration } from './migrations/marketplace-bootstrap-v2.migration';
import { marketplaceBootstrapV3Migration } from './migrations/marketplace-bootstrap-v3.migration';
import { marketplaceBootstrapV4Migration } from './migrations/marketplace-bootstrap-v4.migration';
import { marketplaceBootstrapV5Migration } from './migrations/marketplace-bootstrap-v5.migration';
import { marketplaceBootstrapV6Migration } from './migrations/marketplace-bootstrap-v6.migration';
import { marketplaceBootstrapV7Migration } from './migrations/marketplace-bootstrap-v7.migration';
import { marketplaceBootstrapV8Migration } from './migrations/marketplace-bootstrap-v8.migration';
import { marketplaceBootstrapV9Migration } from './migrations/marketplace-bootstrap-v9.migration';
import { marketplaceBootstrapV10Migration } from './migrations/marketplace-bootstrap-v10.migration';
import { marketplaceBootstrapV11Migration } from './migrations/marketplace-bootstrap-v11.migration';
import { marketplaceBootstrapV12Migration } from './migrations/marketplace-bootstrap-v12.migration';
import { marketplaceBootstrapV13Migration } from './migrations/marketplace-bootstrap-v13.migration';
import { marketplaceBootstrapV14Migration } from './migrations/marketplace-bootstrap-v14.migration';
import { marketplaceBootstrapV15Migration } from './migrations/marketplace-bootstrap-v15.migration';
import { marketplaceBootstrapV16Migration } from './migrations/marketplace-bootstrap-v16.migration';
import { marketplaceBootstrapV17Migration } from './migrations/marketplace-bootstrap-v17.migration';
import { marketplaceBootstrapV18Migration } from './migrations/marketplace-bootstrap-v18.migration';

export const marketplaceMigrations: IExtensionSchemaMigration[] = [
  marketplaceBootstrapV1Migration,
  marketplaceBootstrapV2Migration,
  marketplaceBootstrapV3Migration,
  marketplaceBootstrapV4Migration,
  marketplaceBootstrapV5Migration,
  marketplaceBootstrapV6Migration,
  marketplaceBootstrapV7Migration,
  marketplaceBootstrapV8Migration,
  marketplaceBootstrapV9Migration,
  marketplaceBootstrapV10Migration,
  marketplaceBootstrapV11Migration,
  marketplaceBootstrapV12Migration,
  marketplaceBootstrapV13Migration,
  marketplaceBootstrapV14Migration,
  marketplaceBootstrapV15Migration,
  marketplaceBootstrapV16Migration,
  marketplaceBootstrapV17Migration,
  marketplaceBootstrapV18Migration,
];
