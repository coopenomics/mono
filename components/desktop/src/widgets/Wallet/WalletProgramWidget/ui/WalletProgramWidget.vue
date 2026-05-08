<template lang="pug">
.programs-container

  .programs-list(v-if='allPrograms.length > 0')
    ColorCard(
      v-for='(program, index) in allPrograms',
      :key='program.id',
      :color='getProgramColor(index)',
      class='program-card'
    )
      .program-content
        .program-header
          .program-icon-wrapper
            q-icon(:name='getProgramIcon(program)', size='24px', :color='getProgramColor(index)')
          .program-title {{ program?.program_details?.title }}

        .program-balances
          .balance-available
            .balance-label Доступно
            .balance-value {{ getFormattedAvailable(program) }}
          .balance-blocked(v-if='hasBlocked(program)')
            .balance-label Заблокировано
            .balance-value {{ getFormattedBlocked(program) }}

  .empty-programs(v-else)
    .empty-icon
      q-icon(name='inbox', size='48px', color='grey-5')
    .empty-text У вас пока нет кошельков целевых потребительских программ.
</template>

<script lang="ts" setup>
import { useWalletStore } from 'src/entities/Wallet';
import { useSystemStore } from 'src/entities/System/model';
import { ColorCard } from 'src/shared/ui';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { computed } from 'vue';

const walletStore = useWalletStore();
const { info } = useSystemStore();

// Все программы включая цифровой кошелек
const allPrograms = computed(() => {
  return walletStore.program_wallets;
});

// Цвета для программ - совместимые с ColorCard
const programColors: ('green' | 'blue' | 'purple' | 'orange' | 'red' | 'teal' | 'indigo' | 'cyan' | 'pink' | 'grey')[] = [
  'green', 'blue', 'purple', 'orange', 'red', 'teal', 'indigo', 'cyan', 'pink', 'grey'
];

// Получить цвет для программы по индексу
const getProgramColor = (index: number): 'green' | 'blue' | 'purple' | 'orange' | 'red' | 'teal' | 'indigo' | 'cyan' | 'pink' | 'grey' => {
  return programColors[index % programColors.length];
};

// Получить иконку для программы по типу программы
const getProgramIcon = (program: any): string => {
  const programType = program?.program_details?.program_type;
  const programId = program?.program_details?.id;

  // Сначала проверяем по типу программы
  const typeIconMap: Record<string, string> = {
    'wallet': 'account_balance_wallet',    // Цифровой кошелек
    'marketplace': 'shopping_bag',         // Маркетплейс
    'generator': 'settings',               // Генерация (краудсорсинг/краудфандинг) - шестеренка
    'blagorost': 'nature',                 // Благорост (росток)
  };

  // Если тип найден, возвращаем его иконку
  if (programType && typeIconMap[programType]) {
    return typeIconMap[programType];
  }

  // Иначе проверяем по ID программы (резервный вариант)
  const idIconMap: Record<number, string> = {
    1: 'account_balance_wallet', // Цифровой кошелек
    2: 'shopping_bag',          // Маркетплейс
    3: 'settings',               // Генерация
    4: 'nature',                 // Благорост
  };

  return idIconMap[programId] || 'account_balance_wallet';
};

// Форматированная сумма доступных средств для программы
const getFormattedAvailable = (program: any) => {
  const available = program?.available || '0';
  return formatAsset2Digits(`${available} ${info.symbols.root_govern_symbol}`);
};


// Форматированная сумма заблокированных средств для программы.
// Видимость блока — через hasBlocked(); сюда попадаем только если blocked > 0.
const getFormattedBlocked = (program: any) => {
  return formatAsset2Digits(`${program?.blocked || '0'} ${info.symbols.root_govern_symbol}`);
};

// Показать блок «Заблокировано» только если сумма реально > 0.
// minimum_amount пайщика — отдельная сущность (минимальный паевой), к blocked не примешиваем.
const hasBlocked = (program: any): boolean => {
  return parseFloat(program?.blocked || '0') > 0;
};

</script>

<style lang="scss" scoped>
.programs-container {
  .programs-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 16px;

    .program-card {
      // Переопределяем ColorCard
      :deep(.color-card) {
        margin-bottom: 0;
        border-radius: 12px;
        border: none;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

        &:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);

          .body--dark & {
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          }
        }

        &::before {
          border-radius: 12px 12px 0 0;
        }
      }

      .program-content {
        padding: 10px;

        .program-header {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 20px;

          .program-icon-wrapper {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 40px;
            height: 40px;
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.8);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            transition: all 0.2s ease;

            .body--dark & {
              background: rgba(255, 255, 255, 0.05);
              border: 1px solid rgba(255, 255, 255, 0.1);
            }
          }

          .program-title {
            font-size: 16px;
            font-weight: 500;
            letter-spacing: -0.2px;
            color: inherit;
            margin: 0;
          }
        }

        .program-balances {
          .balance-available,
          .balance-blocked {
            margin-bottom: 16px;

            &:last-child {
              margin-bottom: 0;
            }

            .balance-label {
              font-size: 11px;
              font-weight: 500;
              letter-spacing: 0.8px;
              text-transform: uppercase;
              color: rgba(0, 0, 0, 0.5);
              margin-bottom: 4px;

              .body--dark & {
                color: rgba(255, 255, 255, 0.6);
              }
            }

            .balance-value {
              font-size: 20px;
              font-weight: 400;
              letter-spacing: -0.3px;
              color: rgba(0, 0, 0, 0.9);

              .body--dark & {
                color: rgba(255, 255, 255, 0.9);
              }
            }
          }

          .balance-blocked {
            .balance-label {
              color: rgba(0, 0, 0, 0.4);

              .body--dark & {
                color: rgba(255, 255, 255, 0.5);
              }
            }

            .balance-value {
              font-size: 18px;
              color: rgba(0, 0, 0, 0.7);

              .body--dark & {
                color: rgba(255, 255, 255, 0.7);
              }
            }
          }
        }
      }
    }
  }

  .empty-programs {
    text-align: center;
    padding: 48px 20px;

    .empty-icon {
      margin-bottom: 16px;
      opacity: 0.4;
    }

    .empty-text {
      font-size: 16px;
      font-weight: 400;
      letter-spacing: -0.2px;
      color: rgba(0, 0, 0, 0.6);
      line-height: 1.4;

      .body--dark & {
        color: rgba(255, 255, 255, 0.6);
      }
    }
  }
}

// Адаптивность
@media (max-width: 768px) {
  .programs-container {
    .programs-list {
      grid-template-columns: 1fr;
      gap: 12px;

      .program-card {

        .program-content {
          padding: 8px;

          .program-header {
            margin-bottom: 12px;

            .program-icon-wrapper {
              width: 36px;
              height: 36px;
            }

            .program-title {
              font-size: 15px;
            }
          }

          .program-balances {
            .balance-available,
            .balance-blocked {
              .balance-value {
                font-size: 18px;
              }
            }

            .balance-blocked {
              .balance-value {
                font-size: 16px;
              }
            }
          }
        }
      }
    }

    .empty-programs {
      padding: 32px 16px;

      .empty-text {
        font-size: 15px;
      }
    }
  }
}
</style>
