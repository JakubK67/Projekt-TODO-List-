import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppButton from '../components/AppButton';
import { useAuth } from '../auth/AuthContext';
import { configReady } from '../config';
import type { DeviceLogin } from '../services/session';
import { colors } from '../theme';
export default function LoginScreen() {
  const { client, signedIn, startDemo, error: restoreError } = useAuth();
  const [busy, setBusy] = useState(false);
  const [device, setDevice] = useState<DeviceLogin | null>(null);
  const [error, setError] = useState('');
  const attempt = useRef<AbortController | null>(null);
  useEffect(() => () => attempt.current?.abort(), []);

  async function openLogin(url: string) {
    try { await WebBrowser.openBrowserAsync(url); } catch {
      if (!attempt.current?.signal.aborted) setError('Nie udało się otworzyć przeglądarki. Spróbuj ponownie.');
    }
  }

  async function login() {
    if (attempt.current) return;
    const controller = new AbortController();
    attempt.current = controller;
    setBusy(true); setError(''); setDevice(null);
    try {
      const authorization = await client.beginLogin(controller.signal);
      if (controller.signal.aborted) return;
      setDevice(authorization);
      void openLogin(authorization.verificationUrl);
      const user = await client.finishLogin(authorization, controller.signal);
      if (!controller.signal.aborted) {
        try { WebBrowser.dismissBrowser(); } catch {}
        signedIn(user);
      }
    } catch (err) {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Nie udało się zalogować.');
    } finally {
      if (attempt.current === controller) {
        attempt.current = null;
        if (!controller.signal.aborted) { setBusy(false); setDevice(null); }
      }
    }
  }

  function cancel() {
    attempt.current?.abort(); attempt.current = null;
    setBusy(false); setDevice(null); setError('');
  }
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.brand}><Text style={styles.brandText}>TODO</Text></View>
        <Text style={styles.eyebrow}>TWÓJ DZIEŃ, TWÓJ PLAN</Text>
        <Text style={styles.title}>Mniej chaosu.{ '\n' }Więcej zrobione.</Text>
        <Text style={styles.subtitle}>Twoje zadania zawsze pod ręką. Planuj, ustalaj priorytety i działaj we własnym rytmie.</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Witaj w TODO Mobile</Text>
          <Text style={styles.copy}>Zaloguj się, aby wejść do aplikacji. Zadania mobilne są testowe i pochodzą z lokalnego json-server.</Text>
          {!configReady && <Text style={styles.error}>Ustaw adres API i Keycloak w konfiguracji aplikacji.</Text>}
          {(error || restoreError) ? <Text accessibilityRole="alert" style={styles.error}>{error || restoreError}</Text> : null}
          {busy && <ActivityIndicator color={colors.forest} accessibilityLabel="Trwa logowanie" />}
          {device && <View style={styles.device}>
            <Text style={styles.copy}>Potwierdź w przeglądarce ten kod urządzenia:</Text>
            <Text selectable style={styles.code}>{device.userCode}</Text>
            <Text style={styles.note}>Po zalogowaniu i zatwierdzeniu dostępu wróć do aplikacji. Nie udostępniaj kodu innym osobom.</Text>
            <AppButton label="Otwórz stronę logowania" secondary onPress={() => { void openLogin(device.verificationUrl); }} />
          </View>}
          {busy ? <AppButton label="Anuluj logowanie" secondary onPress={cancel} />
            : <AppButton label="Zaloguj się" disabled={!configReady} onPress={() => { void login(); }} />}
          <AppButton label="Zobacz podgląd aplikacji" onPress={startDemo} disabled={busy} secondary />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 18, maxWidth: 560, width: '100%', alignSelf: 'center' },
  brand: { width: 72, height: 72, borderRadius: 22, backgroundColor: colors.forest, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  brandText: { color: colors.white, fontWeight: '800', fontSize: 20, letterSpacing: 1 },
  eyebrow: { color: colors.muted, fontSize: 12, letterSpacing: 2, fontWeight: '700' },
  title: { color: colors.text, fontSize: 36, lineHeight: 43, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 16, lineHeight: 25 },
  card: { padding: 22, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 16, marginTop: 8 },
  cardTitle: { color: colors.text, fontWeight: '700', fontSize: 21 },
  copy: { color: colors.muted, fontSize: 15, lineHeight: 23 },
  note: { color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  error: { color: colors.danger, fontSize: 14, lineHeight: 21 },
  device: { gap: 14, padding: 16, backgroundColor: colors.soft, borderRadius: 12 },
  code: { fontSize: 28, fontWeight: '800', letterSpacing: 3, color: colors.forest, textAlign: 'center' },
});
