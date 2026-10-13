import { computed, onMounted, ref } from 'vue';
import { useFirstLoad } from 'src/shared/lib/composables';
import { FailAlert } from 'src/shared/api';
import { asText } from 'src/shared/lib/utils';
import { useLiveReload } from 'src/shared/lib/realtime';
import { fetchMyContributions, fetchMyLessons, type IContribution, type ILesson } from '../../entities/Teacher';
import { isReportable } from '../../entities/Lesson';
import { EduLive } from '../../shared/lib/live';

/**
 * Занятия и взносы преподавателя для его стола: загрузка, живое обновление и
 * занятия, по которым отчёт открыт сейчас. Одни данные у календаря и у
 * страницы отчётов.
 */
export function useTeacherLessons() {
  const lessons = ref<ILesson[]>([]);
  const contributions = ref<IContribution[]>([]);
  // Признак включён с самого начала: до конца первой загрузки на экране каркас, а не «пусто».
  const loading = ref(true);
  const firstLoad = useFirstLoad(loading);
  /** Идёт отчёт: пока он создаётся и материалы передаются, данные не перечитываются. */
  const reporting = ref(false);

  async function load(): Promise<void> {
    loading.value = true;
    try {
      const [l, c] = await Promise.all([fetchMyLessons(), fetchMyContributions()]);
      lessons.value = l;
      contributions.value = c;
    } catch (e) {
      FailAlert(e);
    } finally {
      loading.value = false;
    }
  }

  /** Занятия, по которым отчёт открыт сейчас — по порядку дат. */
  const awaitingReport = computed(() => lessons.value.filter((l) => isReportable(l)).sort((a, b) => String(a.held_at).localeCompare(String(b.held_at))));
  /** Взнос занятия: отчёт заводит его сам, связь — по идентификатору взноса. */
  const contributionOf = (lesson: ILesson) => contributions.value.find((c) => asText(c.id) === asText(lesson.contribution_id)) ?? null;

  function replaceContribution(c: IContribution): void {
    const i = contributions.value.findIndex((x) => x.id === c.id);
    if (i >= 0) contributions.value[i] = c;
    else contributions.value.unshift(c);
  }

  // Живое обновление: данные меняются в цепи и на столах других участников.
  // Занятие после отчёта появляется один раз, уже в готовом виде.
  useLiveReload([EduLive.lessons, EduLive.assignments, EduLive.contributions], () => (reporting.value ? undefined : load()));

  onMounted(() => {
    void load();
  });

  return { lessons, contributions, firstLoad, reporting, load, awaitingReport, contributionOf, replaceContribution };
}
