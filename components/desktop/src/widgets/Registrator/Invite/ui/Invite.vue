<template lang="pug">
AuthSplit.invite(
  :eyebrow='coopTitle',
  title='Приглашение',
  lead='Кооператив выпустил для вас ключ доступа и цифровой подписи.',
  quote='Ключ подписывает документы от вашего имени — храните его в менеджере паролей.',
  step-eyebrow='Приглашение',
  :heading='token ? "Сохраните ключ" : "Ссылка из письма"',
  :text='token ? "Новый приватный ключ сгенерирован прямо в вашем браузере." : "Вы получили приглашение на подключение к кооперативу."'
)
  template(#actions)
    AuthActions

  template(v-if='token')
    p.invite__instruction
      | Подтвердите, что надёжно сохранили ключ. Рекомендуем хранить его в
      | бесплатном менеджере паролей, например
      a.q-ml-xs.invite__link(href='https://bitwarden.com/download', target='_blank') Bitwarden
      | .

    BaseBanner(variant='info')
      | При первом входе по этому ключу мы предложим задать пароль — дальше будете
      | входить им, а ключ останется запасным способом восстановления доступа.

    .invite__key(v-if='account && account.private_key')
      .invite__key-head
        span.invite__key-label Приватный ключ
        BaseButton(variant='ghost', size='sm', aria-label='Скопировать ключ', @click='copyMnemonic')
          template(#icon-left)
            q-icon(name='content_copy')
          | Копировать
      code.invite__key-value {{ account.private_key }}

    BaseCheckbox(v-model='i_save', label='Я сохранил ключ')

    BaseButton(
      variant='primary',
      block,
      :disabled='!i_save',
      :loading='loading',
      @click='finish'
    ) Установить ключ

  template(v-else)
    p.invite__instruction
      | Чтобы продолжить, перейдите по персональной ссылке из письма-приглашения.
      | В ней содержится одноразовый код, по которому для вас будет выпущен ключ
      | доступа.

  template(#foot)
    a.auth-link(href='#', @click.prevent='goToSignin') Перейти ко входу
</template>

<script lang="ts" setup>
import { copyToClipboard } from 'quasar';
import { useCreateUser } from 'src/features/User/CreateUser';
import { useResetKey } from 'src/features/User/ResetKey/model';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { type IGeneratedAccount } from 'src/shared/lib/types/user';
import { AuthSplit } from 'src/shared/ui/layout/AuthSplit';
import { AuthActions } from 'src/widgets/Registrator/AuthActions';
import { BaseBanner } from 'src/shared/ui/base/BaseBanner';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { BaseCheckbox } from 'src/shared/ui/base/BaseCheckbox';
import { useSystemStore } from 'src/entities/System/model';
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();
const systemStore = useSystemStore();
const coopTitle = computed(() => systemStore.cooperativeDisplayName);

const { generateAccount } = useCreateUser();
const account = ref<IGeneratedAccount | undefined>();

const i_save = ref(false);
const token = ref(route.query.token);
const loading = ref(false);

const { resetKey } = useResetKey();

account.value = generateAccount();

const copyMnemonic = () => {
  const toCopy = `${account.value?.private_key}`;

  copyToClipboard(toCopy)
    .then(() => {
      SuccessAlert('Ключ был скопирован в буфер обмена');
    })
    .catch((e) => {
      console.log(e);
    });
};

const goToSignin = () => {
  router.push({ name: 'signin' });
};

const finish = async () => {
  try {
    if (!account.value) {
      FailAlert('Возникла ошибка при генерации приватного ключа');
      return;
    }
    loading.value = true;
    await resetKey({
      token: token.value as string,
      public_key: account.value.public_key,
    });

    SuccessAlert('Ключ доступа успешно установлен');
    loading.value = false;

    router.push({ name: 'signin' });
  } catch (e: any) {
    loading.value = false;
    FailAlert(e);
  }
};
</script>

<style scoped>
.invite__instruction {
  color: var(--p-ink-2);
  font-size: var(--p-fs-body-sm, 13px);
  line-height: var(--p-lh-body, 1.55);
  margin: 0;
}
.invite__link {
  color: var(--p-primary);
  text-decoration: none;
  font-weight: 500;
}
.invite__link:hover {
  text-decoration: underline;
}
/* Ключ — выделенная панель, а не readonly-инпут (у того dashed-рамка
   и обрезка значения). Панель показывает ключ целиком и даёт ему вес. */
.invite__key {
  padding: var(--p-3, 12px) var(--p-4, 16px);
  background: var(--p-surface-2);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md, 12px);
}
.invite__key-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-2, 8px);
  margin-bottom: var(--p-1, 4px);
}
.invite__key-label {
  font-size: var(--p-fs-meta, 12px);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--p-ink-3);
}
.invite__key-value {
  display: block;
  font-family: var(--p-mono);
  font-size: var(--p-fs-mono, 13px);
  line-height: 1.5;
  color: var(--p-ink);
  word-break: break-all;
}
</style>
