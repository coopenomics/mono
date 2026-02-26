import { Order } from '../src/models';
import { TypeOrmPaymentRepository } from '../src/infrastructure/database/typeorm/repositories/typeorm-payment.repository';
import { PaymentEntity } from '../src/infrastructure/database/typeorm/entities/payment.entity';
import { DataSource } from 'typeorm';
import config from '../src/config/config';
import { PaymentStatusEnum } from '../src/domain/gateway/enums/payment-status.enum';
import { PaymentTypeEnum, PaymentDirectionEnum, getPaymentDirection } from '../src/domain/gateway/enums/payment-type.enum';
import type { PaymentDomainInterface } from '../src/domain/gateway/interfaces/payment-domain.interface';
import { sha256 } from '../src/utils/sha256';
import { generator } from '../src/services/document.service';

export default {
  name: 'Миграция платежей из MongoDB в PostgreSQL (унифицированная модель)',
  validUntil: new Date('2025-07-03'), // Действует до

  async up(): Promise<boolean> {
    console.log('Выполнение миграции: Перенос платежей из MongoDB в PostgreSQL (унифицированная модель)');

    try {
      await generator.connect(config.mongoose.url);

      // Инициализируем подключение к PostgreSQL
      const dataSource = new DataSource({
        type: 'postgres',
        host: config.postgres.host,
        port: Number(config.postgres.port),
        username: config.postgres.username,
        password: config.postgres.password,
        database: config.postgres.database,
        entities: [PaymentEntity],
        synchronize: true, // Создаем таблицу если она не существует
      });

      await dataSource.initialize();
      console.log('Подключение к PostgreSQL установлено');

      // Создаем репозиторий для работы с платежами
      const paymentRepository = new TypeOrmPaymentRepository(dataSource.getRepository(PaymentEntity));

      // Получаем все заказы из MongoDB
      const orders = await Order.find();
      console.log(`Найдено ${orders.length} заказов в MongoDB`);

      let migratedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;

      for (const order of orders) {
        try {
          // Генерируем hash из order_num для поиска существующих платежей
          const hash = sha256(String(order.order_num));

          // Проверяем, существует ли уже платеж с таким hash
          const existingPayment = await paymentRepository.findByHash(hash);

          if (existingPayment) {
            console.log(`Платеж с hash ${hash} (order_num: ${order.order_num}) уже существует, пропускаем`);
            skippedCount++;
            continue;
          }

          // Мапим старые статусы на новые
          const statusMapping: Record<string, PaymentStatusEnum> = {
            pending: PaymentStatusEnum.PENDING,
            paid: PaymentStatusEnum.PAID,
            completed: PaymentStatusEnum.COMPLETED,
            failed: PaymentStatusEnum.FAILED,
            expired: PaymentStatusEnum.EXPIRED,
            refunded: PaymentStatusEnum.REFUNDED,
          };

          // Мапим старые типы на новые
          const typeMapping: Record<string, PaymentTypeEnum> = {
            registration: PaymentTypeEnum.REGISTRATION,
            deposit: PaymentTypeEnum.DEPOSIT,
          };

          const paymentType = typeMapping[order.type] || PaymentTypeEnum.REGISTRATION;
          const paymentDirection = getPaymentDirection(paymentType);
          const paymentStatus = statusMapping[order.status] || PaymentStatusEnum.PENDING;

          // Проверяем, что все мигрируемые платежи действительно входящие
          if (paymentDirection !== PaymentDirectionEnum.INCOMING) {
            console.warn(`⚠️ Платеж ${order.order_num} имеет неожиданное направление ${paymentDirection}, пропускаем`);
            skippedCount++;
            continue;
          }

          // Создаем объект платежа согласно доменному интерфейсу
          const paymentData: PaymentDomainInterface = {
            hash, // используем сгенерированный hash вместо blockchain_num
            coopname: order.creator,
            username: order.username,
            quantity: parseFloat(order.quantity),
            symbol: order.symbol,
            type: paymentType,
            direction: paymentDirection,
            status: paymentStatus,
            provider: order.provider,
            secret: order.secret,
            message: order.message,
            expired_at: order.expired_at,
            created_at: (order as any).createdAt || new Date(), // Mongoose timestamps
            updated_at: (order as any).updatedAt || new Date(),
            payment_details: order.details
              ? {
                  data: order.details.data,
                  amount_plus_fee: order.details.amount_plus_fee,
                  amount_without_fee: order.details.amount_without_fee,
                  fee_amount: order.details.fee_amount,
                  fee_percent: order.details.fee_percent,
                  fact_fee_percent: order.details.fact_fee_percent,
                  tolerance_percent: order.details.tolerance_percent,
                }
              : undefined,
          };

          // Создаем платеж через репозиторий
          await paymentRepository.create(paymentData);

          migratedCount++;
          console.log(
            `✅ Мигрирован платеж ${order.order_num} -> hash: ${hash} (${paymentType}/${paymentDirection}, ${paymentStatus})`
          );
        } catch (error) {
          errorCount++;
          console.error(`❌ Ошибка при миграции платежа ${order.order_num}:`, error);
        }
      }

      console.log('\n=== Результаты миграции ===');
      console.log(`Мигрировано: ${migratedCount}`);
      console.log(`Пропущено: ${skippedCount}`);
      console.log(`Ошибок: ${errorCount}`);
      console.log(`Всего обработано: ${orders.length}`);

      // Проверяем, что все мигрированные платежи действительно входящие
      console.log('\n=== Проверка миграции ===');
      const allPayments = await paymentRepository.getAllPayments({}, { page: 1, limit: 1000, sortOrder: 'ASC' });
      const incomingCount = allPayments.items.filter(
        (p: PaymentDomainInterface) => p.direction === PaymentDirectionEnum.INCOMING
      ).length;
      const outgoingCount = allPayments.items.filter(
        (p: PaymentDomainInterface) => p.direction === PaymentDirectionEnum.OUTGOING
      ).length;

      console.log(`Входящих платежей: ${incomingCount}`);
      console.log(`Исходящих платежей: ${outgoingCount}`);

      if (outgoingCount > 0) {
        console.warn(`⚠️ Обнаружены исходящие платежи после миграции! Это может указывать на проблему.`);
      }

      // Дополнительная валидация данных
      console.log('\n=== Валидация данных ===');
      const registrationPayments = allPayments.items.filter(
        (p: PaymentDomainInterface) => p.type === PaymentTypeEnum.REGISTRATION
      ).length;
      const depositPayments = allPayments.items.filter(
        (p: PaymentDomainInterface) => p.type === PaymentTypeEnum.DEPOSIT
      ).length;

      console.log(`Регистрационных платежей: ${registrationPayments}`);
      console.log(`Депозитных платежей: ${depositPayments}`);

      // Проверяем обязательные поля
      const paymentsWithMissingData = allPayments.items.filter(
        (p: PaymentDomainInterface) => !p.coopname || !p.username || !p.quantity || !p.symbol || !p.provider || !p.secret
      );

      if (paymentsWithMissingData.length > 0) {
        console.warn(`⚠️ Найдено ${paymentsWithMissingData.length} платежей с отсутствующими обязательными данными`);
        paymentsWithMissingData.forEach((p: PaymentDomainInterface) => {
          console.warn(`   Платеж ${p.hash}: отсутствуют поля`, {
            coopname: !p.coopname,
            username: !p.username,
            quantity: !p.quantity,
            symbol: !p.symbol,
            provider: !p.provider,
            secret: !p.secret,
          });
        });
      } else {
        console.log('✅ Все платежи имеют обязательные поля');
      }

      // Проверяем корректность типов и направлений
      const invalidDirections = allPayments.items.filter((p: PaymentDomainInterface) => {
        const expectedDirection = getPaymentDirection(p.type);
        return p.direction !== expectedDirection;
      });

      if (invalidDirections.length > 0) {
        console.warn(`⚠️ Найдено ${invalidDirections.length} платежей с некорректным направлением`);
      } else {
        console.log('✅ Все платежи имеют корректные направления');
      }

      // Создаем базовые индексы для оптимизации запросов
      console.log('\n=== Создание индексов ===');

      try {
        await dataSource.query(`
          CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
        `);

        await dataSource.query(`
          CREATE INDEX IF NOT EXISTS idx_payments_type ON payments(type);
        `);

        await dataSource.query(`
          CREATE INDEX IF NOT EXISTS idx_payments_direction ON payments(direction);
        `);

        await dataSource.query(`
          CREATE INDEX IF NOT EXISTS idx_payments_username ON payments(username);
        `);

        await dataSource.query(`
          CREATE INDEX IF NOT EXISTS idx_payments_coopname ON payments(coopname);
        `);

        await dataSource.query(`
          CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);
        `);

        await dataSource.query(`
          CREATE INDEX IF NOT EXISTS idx_payments_secret ON payments(secret);
        `);

        await dataSource.query(`
          CREATE INDEX IF NOT EXISTS idx_payments_hash ON payments(hash);
        `);

        await dataSource.query(`
          CREATE INDEX IF NOT EXISTS idx_payments_quantity ON payments(quantity);
        `);
        await dataSource.query(`
          CREATE INDEX IF NOT EXISTS idx_payments_symbol ON payments(symbol);
        `);
        await dataSource.query(`
          CREATE INDEX IF NOT EXISTS idx_payments_expired_at ON payments(expired_at);
        `);

        await dataSource.query(`
          CREATE INDEX IF NOT EXISTS idx_payments_composite ON payments(coopname, username, status, type);
        `);

        console.log('Базовые индексы созданы');
      } catch (indexError) {
        console.warn('Ошибка при создании индексов:', indexError);
      }

      // Закрываем подключение к PostgreSQL
      await dataSource.destroy();
      console.log('Подключение к PostgreSQL закрыто');

      console.log('Миграция завершена: Перенос платежей в унифицированную модель выполнен успешно');
      return true;
    } catch (error) {
      console.error('Ошибка при выполнении миграции платежей:', error);
      return false;
    }
  },
};
