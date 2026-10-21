import { useTranslation } from 'react-i18next';

import { ScreenPlaceholder } from '@/components/screen-placeholder';

export default function WorkoutsScreen() {
  const { t } = useTranslation();

  return (
    <ScreenPlaceholder
      title={t('tabs.workouts')}
      description={t('screens.placeholderDescription')}
    />
  );
}
