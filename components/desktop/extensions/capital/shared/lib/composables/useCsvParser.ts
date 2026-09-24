import { ref } from 'vue';
import { t } from '../../../i18n';

export interface ICsvContributor {
  username: string;
  contribution_amount: string;
  contributor_contract_number: string;
  contributor_contract_created_at: string;
  blagorost_agreement_number: string;
  blagorost_agreement_created_at: string;
  memo?: string;
  status?: 'pending' | 'success' | 'error';
  error?: string;
  id?: string;
}

export function useCsvParser() {
  const parsedData = ref<ICsvContributor[]>([]);
  const isParsing = ref(false);

  const parseCsv = async (file: File): Promise<ICsvContributor[]> => {
    isParsing.value = true;

    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const csv = e.target?.result as string;
          const lines = csv.split('\n').filter((line) => line.trim());
          const headers = lines[0]
            .split(',')
            .map((h) => h.trim().replace(/"/g, ''));

          // Проверяем обязательные заголовки
          const requiredHeaders = [
            'username',
            'contribution_amount',
            'contributor_contract_number',
            'contributor_contract_created_at',
            'blagorost_agreement_number',
            'blagorost_agreement_created_at',
          ];
          const missingHeaders = requiredHeaders.filter(
            (h) => !headers.includes(h),
          );

          if (missingHeaders.length > 0) {
            throw new Error(
              t('capital.error.csvMissingColumns', { columns: missingHeaders.join(', ') }),
            );
          }

          const data: ICsvContributor[] = [];

          for (let i = 1; i < lines.length; i++) {
            const values = lines[i]
              .split(',')
              .map((v) => v.trim().replace(/"/g, ''));

            if (values.length !== headers.length) {
              continue; // Пропускаем некорректные строки
            }

            const row: ICsvContributor = {
              username: '',
              contribution_amount: '',
              contributor_contract_number: '',
              contributor_contract_created_at: '',
              blagorost_agreement_number: '',
              blagorost_agreement_created_at: '',
              status: 'pending',
              id: `row_${i}`,
            };

            headers.forEach((header, index) => {
              const value = values[index];
              if (header === 'username') row.username = value;
              else if (header === 'contribution_amount')
                row.contribution_amount = value;
              else if (header === 'contributor_contract_number')
                row.contributor_contract_number = value;
              else if (header === 'contributor_contract_created_at')
                row.contributor_contract_created_at = value;
              else if (header === 'blagorost_agreement_number')
                row.blagorost_agreement_number = value;
              else if (header === 'blagorost_agreement_created_at')
                row.blagorost_agreement_created_at = value;
              else if (header === 'memo') row.memo = value;
            });

            // Проверяем обязательные поля
            if (
              !row.username ||
              !row.contribution_amount ||
              !row.contributor_contract_number ||
              !row.contributor_contract_created_at ||
              !row.blagorost_agreement_number ||
              !row.blagorost_agreement_created_at
            ) {
              continue; // Пропускаем строки с пустыми обязательными полями
            }

            data.push(row);
          }

          parsedData.value = data;
          resolve(data);
        } catch (error) {
          reject(error);
        } finally {
          isParsing.value = false;
        }
      };

      reader.onerror = () => {
        reject(new Error(t('capital.error.csvReadError')));
        isParsing.value = false;
      };

      reader.readAsText(file, 'utf-8');
    });
  };

  const clearData = () => {
    parsedData.value = [];
  };

  return {
    parsedData,
    isParsing,
    parseCsv,
    clearData,
  };
}
