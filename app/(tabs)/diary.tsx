import { useTranslation } from 'react-i18next';

import { ScreenPlaceholder } from '@/components/screen-placeholder';

export default function DiaryScreen() {
  const { t } = useTranslation();

  return (
    <ScreenPlaceholder title={t('tabs.diary')} description={t('screens.placeholderDescription')} />
  );
}
