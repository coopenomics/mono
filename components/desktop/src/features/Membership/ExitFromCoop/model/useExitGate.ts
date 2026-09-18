import { computed, ref } from 'vue';
import { client } from 'src/shared/api/client';
import { Mutations, Queries, Zeus } from '@coopenomics/sdk';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';

export type IMembershipExit =
  Queries.MembershipExit.GetMembershipExit.IOutput[typeof Queries.MembershipExit.GetMembershipExit.name];

// Module-level singleton — состояние gate'а общее для overlay, процесса и страницы.
const exitStatus = ref<IMembershipExit | null>(null);
const previewTotal = ref<string | null>(null);
const loaded = ref(false);

/**
 * Глобальный gate выхода: пока у пайщика есть активный процесс выхода, кабинет
 * блокируется и показывается только статус заявления и сумма возврата.
 */
export function useExitGate() {
  const { info } = useSystemStore();
  const session = useSessionStore();

  /**
   * Имя кооператива обязательно во всех трёх обращениях ниже. При серверной
   * отрисовке сведения о системе приходят позже сессии, и без этой проверки
   * запрос уходил без обязательной переменной: сервер отвергал его на разборе,
   * а кабинет молча оставался без статуса выхода.
   */
  const coopnameReady = (): boolean => Boolean(info.coopname);

  // Активный выход → блокируем кабинет.
  const isExitActive = computed(() => !!exitStatus.value);

  // Off-chain фаза: заявление подписано, ждём перехода по ссылке из письма.
  const isAwaitingConfirmation = computed(
    () => exitStatus.value?.status === Zeus.MembershipExitStatus.AWAITING_CONFIRMATION,
  );

  // Статус исходящего платежа возврата (после одобрения советом) — null, пока
  // платёж не заведён в реестр кассира.
  const paymentStatus = computed(() => exitStatus.value?.payment_status ?? null);

  /**
   * Отмена заявления на выход до подтверждения по email (кнопка на экране ожидания).
   * После отмены кабинет разблокируется.
   */
  async function cancelExit(): Promise<void> {
    if (!session.username || !coopnameReady()) return;
    await client.Mutation(Mutations.MembershipExit.CancelMembershipExit.mutation, {
      variables: {
        coopname: info.coopname,
        username: session.username,
      },
    });
    await loadExitStatus();
  }

  /**
   * Загружает текущий статус выхода пайщика (и предрасчёт суммы — для отображения
   * планируемого платежа, пока совет не зафиксировал итог).
   */
  async function loadExitStatus(): Promise<void> {
    // При серверной отрисовке сессия поднимается из cookie, поэтому пайщик
    // считается авторизованным, а токена доступа у запроса нет — он живёт в
    // браузере. Такой запрос сервер отвергал, и статус всё равно приходилось
    // перечитывать после гидрации.
    if (typeof window === 'undefined') {
      loaded.value = true;
      return;
    }

    if (!session.isAuth || !session.username || !coopnameReady()) {
      exitStatus.value = null;
      previewTotal.value = null;
      loaded.value = true;
      return;
    }

    try {
      const {
        [Queries.MembershipExit.GetMembershipExit.name]: result,
      } = await client.Query(Queries.MembershipExit.GetMembershipExit.query, {
        variables: {
          coopname: info.coopname,
          username: session.username,
        },
      });

      exitStatus.value = result ?? null;

      // Пока совет не зафиксировал сумму (status pending → quantity = 0),
      // показываем предрасчёт возврата как планируемый платёж.
      if (exitStatus.value && !hasFixedAmount(exitStatus.value.quantity)) {
        await loadPreview();
      } else {
        previewTotal.value = null;
      }
    } catch (error) {
      console.error('Ошибка загрузки статуса выхода:', error);
    } finally {
      loaded.value = true;
    }
  }

  async function loadPreview(): Promise<void> {
    if (!coopnameReady()) return;

    try {
      const {
        [Queries.MembershipExit.MembershipExitReturnPreview.name]: preview,
      } = await client.Query(
        Queries.MembershipExit.MembershipExitReturnPreview.query,
        {
          variables: {
            coopname: info.coopname,
            username: session.username,
          },
        },
      );
      previewTotal.value = preview.total;
    } catch (error) {
      console.error('Ошибка предрасчёта суммы возврата:', error);
    }
  }

  function hasFixedAmount(quantity?: string): boolean {
    if (!quantity) return false;
    const amount = Number(quantity.split(' ')[0]);
    return Number.isFinite(amount) && amount > 0;
  }

  // Планируемая сумма платежа: зафиксированная советом либо предрасчёт.
  const plannedAmount = computed<string | null>(() => {
    if (exitStatus.value && hasFixedAmount(exitStatus.value.quantity)) {
      return exitStatus.value.quantity;
    }
    return previewTotal.value;
  });

  return {
    exitStatus,
    isExitActive,
    isAwaitingConfirmation,
    paymentStatus,
    plannedAmount,
    loaded,
    loadExitStatus,
    cancelExit,
  };
}
