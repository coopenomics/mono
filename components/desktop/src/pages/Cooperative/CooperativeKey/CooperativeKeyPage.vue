<template lang="pug">
.q-pa-md
  .row
    .col-md-8.col-xs-12.q-pa-sm
      q-card.section-card.q-pa-lg(flat)
        .section-header
          .section-icon
            q-icon(name='security', size='24px', color='teal')
          .section-title Приватный ключ кооператива

        .section-content
          .info-description.q-mb-md
            p.text-body1
              | Приватный ключ кооператива используется системой для автоматического подписания транзакций от имени кооператива.
              | Ключ хранится в зашифрованном виде на сервере и используется только для подписания официальных операций.

            q-banner.q-mt-md(icon='warning', color='orange-2')
              | Важно: После обновления ключ будет скрыт в целях безопасности.
              | Убедитесь, что вы сохранили резервную копию ключа в надежном месте.

          .key-input-section.q-mt-lg
            q-input(
              v-model='privateKey',
              label='Приватный ключ',
              type='password',
              :filled='true',
              :loading='loading',
              :disable='loading',
              hint='Введите новый приватный ключ кооператива'
            )
              template(v-slot:prepend)
                q-icon(name='key')

          .actions-section.q-mt-lg
            q-btn(
              :loading='loading',
              :disable='!privateKey || loading',
              @click='updateKey',
              color='primary',
              size='md',
              no-caps
            )
              q-icon.q-mr-sm(name='update')
              | Обновить ключ

    .col-md-4.col-xs-12.q-pa-sm
      q-card.help-card.q-pa-lg(flat)
        .help-header
          .help-icon
            q-icon(name='help_outline', size='24px', color='grey-6')
          .help-title Справка

        .help-content
          .help-item
            .help-label Что такое приватный ключ?
            .help-text
              | Приватный ключ — это секретная строка, которая позволяет системе подписывать транзакции от имени кооператива.

          .help-item.q-mt-md
            .help-label Безопасность
            .help-text
              | Ключ хранится в зашифрованном виде и не передается в браузер после установки.

          .help-item.q-mt-md
            .help-label Формат ключа
            .help-text
              | Ключ должен быть в формате WIF (Wallet Import Format), начинающийся с "5".
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useSetCooperativeKey } from 'src/features/System/SetCooperativeKey';
import {
  SuccessAlert,
  FailAlert,
  extractGraphQLErrorMessages,
} from 'src/shared/api';

const { setCooperativeKey } = useSetCooperativeKey();

const privateKey = ref('');
const loading = ref(false);

// Устанавливаем фиктивный ключ при загрузке
onMounted(() => {
  privateKey.value = '5*****';
});

const updateKey = async () => {
  if (!privateKey.value || privateKey.value === '5*****') {
    FailAlert('Пожалуйста, введите действительный приватный ключ');
    return;
  }

  try {
    loading.value = true;

    await setCooperativeKey(privateKey.value);

    // Заменяем ключ на фиктивный после успешного обновления
    privateKey.value = '5*****';

    SuccessAlert('Ключ кооператива успешно обновлен');
  } catch (error: any) {
    FailAlert(`Ошибка обновления ключа: ${extractGraphQLErrorMessages(error)}`);
  } finally {
    loading.value = false;
  }
};
</script>

<style lang="scss" scoped>
.page-main-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;

  .page-header {
    display: flex;
    align-items: center;
    gap: 16px;

    .page-icon {
      padding: 12px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 12px;
    }

    .page-title {
      .title {
        font-size: 1.8rem;
        font-weight: 600;
        margin: 0;
      }

      .subtitle {
        font-size: 1rem;
        opacity: 0.9;
        margin-top: 4px;
      }
    }
  }
}

.section-card {
  border: 1px solid #e0e0e0;
  border-radius: 12px;

  .section-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;

    .section-icon {
      padding: 8px;
      background: rgba(0, 150, 136, 0.1);
      border-radius: 8px;
    }

    .section-title {
      font-size: 1.2rem;
      font-weight: 600;
      color: #2d3748;
    }
  }

  .section-content {
    .info-description {
      .text-body1 {
        line-height: 1.6;
        color: #4a5568;
      }
    }

    .key-input-section {
      padding-top: 8px;
    }

    .actions-section {
      display: flex;
      justify-content: flex-start;
    }
  }
}

.help-card {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #f8fafc;

  .help-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;

    .help-title {
      font-size: 1.1rem;
      font-weight: 600;
      color: #2d3748;
    }
  }

  .help-content {
    .help-item {
      .help-label {
        font-weight: 600;
        color: #2d3748;
        font-size: 0.9rem;
        margin-bottom: 4px;
      }

      .help-text {
        color: #4a5568;
        font-size: 0.85rem;
        line-height: 1.5;
      }
    }
  }
}
</style>
