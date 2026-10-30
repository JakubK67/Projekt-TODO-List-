import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import AppButton from '../components/AppButton';
import { colors } from '../theme';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'ProjectForm'>;

export default function ProjectFormScreen({ navigation, route }: Props) {
  const { client, demo } = useAuth();
  const project = route.params?.project;
  const [name, setName] = useState(project?.name ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    if (saving || demo) return;
    if (!name.trim()) { setError('Wpisz nazwę projektu.'); return; }
    setSaving(true); setError('');
    try {
      await client.api(project ? `/api/projects/${project.id}` : '/api/projects', {
        method: project ? 'PUT' : 'POST', body: JSON.stringify({ name: name.trim(), description: description.trim() }),
      });
      navigation.goBack();
    } catch { setError('Nie udało się zapisać projektu. Sprawdź połączenie i spróbuj ponownie.'); }
    finally { setSaving(false); }
  }

  return <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
    <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={96}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <View style={styles.card}>
          <Text style={styles.title}>{project ? 'Szczegóły projektu' : 'Nowy projekt'}</Text>
          <Text style={styles.label}>Nazwa projektu</Text>
          <TextInput accessibilityLabel="Nazwa projektu" value={name} onChangeText={setName} maxLength={100}
            style={styles.input} placeholder="Nazwa projektu" placeholderTextColor={colors.muted} editable={!saving} />
          <Text style={styles.label}>Opis</Text>
          <TextInput accessibilityLabel="Opis projektu" value={description} onChangeText={setDescription} maxLength={5000}
            style={[styles.input, styles.description]} multiline textAlignVertical="top" editable={!saving}
            placeholder="Dodaj opis projektu" placeholderTextColor={colors.muted} />
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <AppButton label={saving ? 'Zapisywanie...' : 'Zapisz projekt'} disabled={saving || demo} onPress={() => void save()} />
          <AppButton label="Anuluj" secondary disabled={saving} onPress={() => navigation.goBack()} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, maxWidth: 680, width: '100%', alignSelf: 'center' },
  card: { padding: 20, gap: 16, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  label: { fontSize: 15, fontWeight: '600', color: colors.text },
  input: { minHeight: 50, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, color: colors.text, fontSize: 16 },
  description: { minHeight: 130 },
  error: { color: colors.danger, lineHeight: 21 },
});
