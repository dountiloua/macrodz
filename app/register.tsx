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
import { mapAuthError, validateSignUpForm } from '@/features/auth';
import { useAuthStore } from '@/store/auth-store';

export default function RegisterScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const signUp = useAuthStore((state) => state.signUp);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showCheckEmail, setShowCheckEmail] = useState(false);

  async function handleSubmit() {
    if (isLoading) {
      return;
    }

    const validation = validateSignUpForm({ email, password, passwordConfirmation });
    if (!validation.ok) {
      const { errors } = validation;
      setErrorMessage(
        errors.email
          ? t(
              errors.email === 'REQUIRED'
                ? 'auth.errors.emailRequired'
                : 'auth.errors.emailInvalid',
            )
          : errors.password
            ? t(
                errors.password === 'REQUIRED'
                  ? 'auth.errors.passwordRequired'
                  : 'auth.errors.passwordTooShort',
              )
            : t(
                errors.passwordConfirmation === 'REQUIRED'
                  ? 'auth.errors.confirmationRequired'
                  : 'auth.errors.passwordsDoNotMatch',
              ),
      );
      setShowCheckEmail(false);
      return;
    }

    setErrorMessage(null);
    setShowCheckEmail(false);
    setIsLoading(true);
    try {
      const result = await signUp(validation.data);
      if (result.error) {
        setErrorMessage(t(mapAuthError(result.error)));
        return;
      }

      if (result.session) {
        router.replace('/');
      } else {
        setShowCheckEmail(true);
      }
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
              <Text style={styles.title}>{t('auth.register.title')}</Text>
              <Text style={styles.subtitle}>{t('auth.register.subtitle')}</Text>
            </View>

            <TextField
              label={t('auth.register.email')}
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder={t('auth.register.emailPlaceholder')}
              returnKeyType="next"
              textContentType="emailAddress"
              value={email}
            />
            <TextField
              label={t('auth.register.password')}
              autoCapitalize="none"
              autoComplete="new-password"
              onChangeText={setPassword}
              placeholder={t('auth.register.password')}
              returnKeyType="next"
              secureTextEntry
              textContentType="newPassword"
              value={password}
            />
            <TextField
              label={t('auth.register.confirmPassword')}
              autoCapitalize="none"
              autoComplete="new-password"
              onChangeText={setPasswordConfirmation}
              placeholder={t('auth.register.confirmPassword')}
              returnKeyType="done"
              secureTextEntry
              textContentType="newPassword"
              value={passwordConfirmation}
              onSubmitEditing={handleSubmit}
            />

            {errorMessage ? (
              <Text accessibilityLiveRegion="polite" style={styles.error}>
                {errorMessage}
              </Text>
            ) : null}
            {showCheckEmail ? (
              <Text accessibilityLiveRegion="polite" style={styles.success}>
                {t('auth.register.checkEmail')}
              </Text>
            ) : null}

            <Button
              label={t('auth.register.submit')}
              loading={isLoading}
              loadingLabel={t('auth.register.loading')}
              onPress={handleSubmit}
            />

            <View style={styles.linkRow}>
              <Text style={styles.linkPrompt}>{t('auth.register.loginPrompt')}</Text>
              <Link href="/login" asChild>
                <Pressable accessibilityRole="link" style={styles.linkTarget}>
                  <Text style={styles.link}>{t('auth.register.loginLink')}</Text>
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
    marginBottom: spacing[2],
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
  success: {
    color: colors.success,
    fontFamily: fontFamilies.regular,
    fontSize: typography.caption,
    lineHeight: 19,
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
