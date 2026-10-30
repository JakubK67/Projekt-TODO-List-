import { useCallback, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import AppButton from '../components/AppButton';
import { colors } from '../theme';

type Profile = { username: string; email: string; first_name: string; last_name: string };
const fields = [
  { key: 'username', label: 'Nazwa użytkownika', max: 255 },
  { key: 'email', label: 'Email', max: 255 },
  { key: 'first_name', label: 'Imię', max: 100 },
  { key: 'last_name', label: 'Nazwisko', max: 100 },
] as const;

function readProfile(data: unknown): Profile {
  if (!data || typeof data !== 'object' || !('username' in data) || typeof data.username !== 'string') {
    throw new Error('Nieprawidłowe dane konta.');
  }
  const value = data as Record<string, unknown>;
  return Object.fromEntries(fields.map(field => [field.key, typeof value[field.key] === 'string' ? value[field.key] : ''])) as Profile;
}

export default function UserPanelScreen() {
  const { client, user, demo, signedIn } = useAuth();
  const [profile, setProfile] = useState<Profile>({ username: '', email: '', first_name: '', last_name: '' });
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });

  const load = useCallback(async (signal: AbortSignal) => {
    if (demo) { setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const data = readProfile(await client.api('/api/me', { signal }));
      if (!signal.aborted) { setProfile(data); setLoaded(true); }
    } catch { if (!signal.aborted) setError('Nie udało się wczytać danych konta. Spróbuj ponownie.'); }
    finally { if (!signal.aborted) setLoading(false); }
  }, [client, demo]);

  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]));

  async function saveProfile() {
    if (busy || loading || !loaded || demo) return;
    setError(''); setMessage('');
    if (!profile.username.trim() || !profile.email.trim()) { setError('Uzupełnij nazwę użytkownika i email.'); return; }
    setBusy(true);
    try {
      const updated = readProfile(await client.api('/api/me', { method: 'PUT', body: JSON.stringify(profile) }));
      setProfile(updated);
      if (user) signedIn({ ...user, username: updated.username });
      setMessage('Dane profilu zostały zapisane.');
    } catch { setError('Nie udało się zapisać profilu. Sprawdź dane i połączenie z serwerem.'); }
    finally { setBusy(false); }
  }

  async function savePassword() {
    if (busy || demo) return;
    setError(''); setMessage('');
    if (!passwords.current || !passwords.next || !passwords.confirm) { setError('Uzupełnij wszystkie pola hasła.'); return; }
    if (passwords.next !== passwords.confirm) { setError('Nowe hasła nie są zgodne.'); return; }
    setBusy(true);
    try {
      await client.api('/api/me/password', { method: 'PUT', body: JSON.stringify(passwords) });
      setPasswords({ current: '', next: '', confirm: '' });
      setShowPasswords(false); setMessage('Hasło zostało zmienione.');
    } catch { setError('Nie udało się zmienić hasła. Sprawdź obecne hasło, wymagania nowego hasła i połączenie z serwerem.'); }
    finally { setBusy(false); }
  }

  return <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
    <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={96}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <View style={styles.card}>
          <Text style={styles.title}>Dane użytkownika</Text>
          {loading ? <ActivityIndicator color={colors.forest} /> : null}
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          {message ? <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text> : null}
          {!loading && error ? <AppButton label="Wczytaj dane ponownie" secondary disabled={busy}
            onPress={() => void load(new AbortController().signal)} /> : null}
          {fields.map(field => <View key={field.key} style={styles.field}>
            <Text style={styles.label}>{field.label}</Text>
            <TextInput accessibilityLabel={field.label} style={styles.input} value={profile[field.key]} maxLength={field.max}
              editable={loaded && !loading && !busy && !demo} onChangeText={value => setProfile(current => ({ ...current, [field.key]: value }))}
              autoCapitalize={field.key === 'email' || field.key === 'username' ? 'none' : 'words'} autoCorrect={false}
              keyboardType={field.key === 'email' ? 'email-address' : 'default'} />
          </View>)}
          <AppButton label={busy ? 'Zapisywanie...' : 'Zapisz profil'} disabled={!loaded || loading || busy || demo} onPress={() => void saveProfile()} />
          <AppButton label={showPasswords ? 'Anuluj zmianę hasła' : 'Zmień hasło'} secondary disabled={busy || demo || loading}
            onPress={() => { setShowPasswords(value => !value); setPasswords({ current: '', next: '', confirm: '' }); }} />
          {showPasswords ? <View style={styles.passwords}>
            {(['current', 'next', 'confirm'] as const).map(key => {
              const label = key === 'current' ? 'Obecne hasło' : key === 'next' ? 'Nowe hasło' : 'Powtórz nowe hasło';
              return <View key={key} style={styles.field}>
                <Text style={styles.label}>{label}</Text>
                <TextInput accessibilityLabel={label} style={styles.input} value={passwords[key]} secureTextEntry autoCapitalize="none"
                  autoCorrect={false} editable={!busy} autoComplete={key === 'current' ? 'current-password' : 'new-password'}
                  onChangeText={value => setPasswords(current => ({ ...current, [key]: value }))} />
              </View>;
            })}
            <AppButton label="Zapisz nowe hasło" disabled={busy} onPress={() => void savePassword()} />
          </View> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, maxWidth: 680, width: '100%', alignSelf: 'center' },
  card: { padding: 20, gap: 20, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border },
  title: { color: colors.text, fontSize: 22, fontWeight: '700' },
  field: { gap: 8 },
  label: { color: colors.text, fontSize: 15, fontWeight: '600' },
  input: { minHeight: 50, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.white, borderRadius: 10, color: colors.text, fontSize: 16 },
  error: { color: colors.danger, lineHeight: 21 },
  message: { color: colors.forest, lineHeight: 21 },
  passwords: { gap: 20 },
});
