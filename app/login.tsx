import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StatusBar } from 'expo-status-bar';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { colors, fontFamilies, spacing, typography } from '@/theme/tokens';
import { mapAuthError, validateLoginForm } from '@/features/auth';
import { useAuthStore } from '@/store/auth-store';

const VALIDATION_KEYS = {
  REQUIRED: 'auth.errors.passwordRequired',
  INVALID_FORMAT: 'auth.errors.emailInvalid',
  TOO_SHORT: 'auth.errors.passwordTooShort',
} as const;

export default function LoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const signIn = useAuthStore((state) => state.signIn);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit() {
    if (isLoading) {
      return;
    }

    const validation = validateLoginForm({ email, password });
    if (!validation.ok) {
      setErrorMessage(
        validation.errors.email
          ? t(
              validation.errors.email === 'REQUIRED'
                ? 'auth.errors.emailRequired'
                : 'auth.errors.emailInvalid',
            )
          : t(VALIDATION_KEYS[validation.errors.password ?? 'REQUIRED']),
      );
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);
    try {
      const result = await signIn(validation.data);
      if (result.error) {
        setErrorMessage(t(mapAuthError(result.error)));
        return;
      }

      router.replace('/');
    } catch (error) {
      setErrorMessage(t(mapAuthError(error)));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Screen>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.form}>
            <View style={styles.heading}>
              <Text style={styles.title}>{t('auth.login.title')}</Text>
              <Text style={styles.subtitle}>{t('auth.login.subtitle')}</Text>
            </View>

            <TextField
              label={t('auth.login.email')}
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder={t('auth.login.emailPlaceholder')}
              returnKeyType="next"
              textContentType="emailAddress"
              value={email}
            />
            <TextField
              label={t('auth.login.password')}
              autoCapitalize="none"
              autoComplete="password"
              onChangeText={setPassword}
              placeholder={t('auth.login.password')}
              returnKeyType="done"
              secureTextEntry
              textContentType="password"
              value={password}
              onSubmitEditing={handleSubmit}
            />

            {errorMessage ? (
              <Text accessibilityLiveRegion="polite" style={styles.error}>
                {errorMessage}
              </Text>
            ) : null}

            <Button
              label={t('auth.login.submit')}
              loading={isLoading}
              loadingLabel={t('auth.login.loading')}
              onPress={handleSubmit}
            />

            <View style={styles.linkRow}>
              <Text style={styles.linkPrompt}>{t('auth.login.registerPrompt')}</Text>
              <Link href="/register" asChild>
                <Pressable accessibilityRole="link" style={styles.linkTarget}>
                  <Text style={styles.link}>{t('auth.login.registerLink')}</Text>
                </Pressable>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  form: {
    gap: spacing[4],
  },
  heading: {
    gap: spacing[2],
    marginBottom: spacing[4],
  },
  title: {
    color: colors.text,
    fontFamily: fontFamilies.bold,
    fontSize: typography.title,
    lineHeight: 36,
  },
  subtitle: {
    color: colors.muted,
    fontFamily: fontFamilies.regular,
    fontSize: typography.body,
    lineHeight: 24,
  },
  error: {
    color: colors.error,
    fontFamily: fontFamilies.regular,
    fontSize: typography.caption,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: spacing[1],
    marginTop: spacing[2],
  },
  linkPrompt: {
    color: colors.muted,
    fontFamily: fontFamilies.regular,
    fontSize: typography.caption,
    textAlign: 'center',
  },
  linkTarget: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing[1],
  },
  link: {
    color: colors.text,
    fontFamily: fontFamilies.medium,
    fontSize: typography.caption,
    textDecorationLine: 'underline',
  },
});
