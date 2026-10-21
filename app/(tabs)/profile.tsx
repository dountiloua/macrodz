import { useTranslation } from 'react-i18next';

import { ScreenPlaceholder } from '@/components/screen-placeholder';

export default function ProfileScreen() {
  const { t } = useTranslation();

  return (
    <ScreenPlaceholder
      title={t('tabs.profile')}
      description={t('screens.placeholderDescription')}
    />
  );
}
