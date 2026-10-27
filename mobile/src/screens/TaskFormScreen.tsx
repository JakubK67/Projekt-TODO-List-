import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppButton from '../components/AppButton';
import DemoNotice from '../components/DemoNotice';
import { createTask, updateTask } from '../data/tasksApi';
import { colors } from '../theme';
import { displayDate } from '../utils/tasks';
import { PRIORITIES, STATUSES, type RootStackParamList, type Task, type TaskInput } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'TaskForm'>;

export default function TaskFormScreen({ navigation, route }: Props) {
  const task = route.params?.task;
  const [name, setName] = useState(task?.name ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [deadline, setDeadline] = useState(displayDate(task?.deadline ?? ''));
  const [priority, setPriority] = useState<Task['priority']>(task?.priority ?? 'Normalny');
  const [status, setStatus] = useState<Task['status']>(task?.status ?? 'Do zrobienia');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function saveTask() {
    if (saving) return;
    if (!name.trim()) {
      setError('Wpisz nazwę zadania.');
      return;
    }

    const taskData: TaskInput = { name: name.trim(), description: description.trim(), deadline: deadline.trim(), priority, status };
    setSaving(true);
    setError('');
    try {
      if (task) await updateTask({ ...taskData, id: task.id });
      else await createTask(taskData);
      navigation.goBack();
    } catch {
      setError('Nie udało się zapisać zadania. Sprawdź połączenie z json-server i spróbuj ponownie.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={96}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
          <DemoNotice form />
          <View style={styles.card}>
            <Text style={styles.title}>{task ? 'Szczegóły zadania' : 'Co chcesz zrobić?'}</Text>
            <View style={styles.field}>
              <Text nativeID="task-name-label" style={styles.label}>Nazwa zadania</Text>
              <TextInput accessibilityLabel="Nazwa zadania" accessibilityLabelledBy="task-name-label" style={styles.input}
                value={name} onChangeText={setName} placeholder="Np. przygotować plan tygodnia" placeholderTextColor={colors.muted} maxLength={100} />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Opis</Text>
              <TextInput accessibilityLabel="Opis zadania" style={[styles.input, styles.description]} value={description}
                onChangeText={setDescription} placeholder="Dodaj szczegóły zadania" placeholderTextColor={colors.muted} multiline maxLength={5000} textAlignVertical="top" />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Termin</Text>
              <TextInput accessibilityLabel="Termin zadania w formacie dzień-miesiąc-rok" style={styles.input}
                value={deadline} onChangeText={setDeadline} placeholder="dd-MM-rrrr" placeholderTextColor={colors.muted} maxLength={10} />
              <Text style={styles.hint}>Opcjonalnie, np. 27-10-2026.</Text>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Priorytet</Text>
              <View style={styles.options}>
                {PRIORITIES.map(value => <Pressable key={value} accessibilityRole="radio" accessibilityLabel={`Priorytet: ${value}`}
                  accessibilityState={{ checked: priority === value }} onPress={() => setPriority(value)}
                  style={[styles.option, priority === value && styles.selected]}>
                  <Text style={[styles.optionText, priority === value && styles.selectedText]}>{value}</Text>
                </Pressable>)}
              </View>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Status</Text>
              <View style={styles.options}>
                {STATUSES.map(value => <Pressable key={value} accessibilityRole="radio" accessibilityLabel={`Status: ${value}`}
                  accessibilityState={{ checked: status === value }} onPress={() => setStatus(value)}
                  style={[styles.option, status === value && styles.selected]}>
                  <Text style={[styles.optionText, status === value && styles.selectedText]}>{value}</Text>
                </Pressable>)}
              </View>
            </View>
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
            <AppButton label={saving ? 'Zapisywanie...' : 'Zapisz zadanie'} disabled={saving} onPress={() => void saveTask()} />
            <AppButton label="Anuluj" secondary onPress={() => navigation.goBack()} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  keyboard: { flex: 1 },
  content: { padding: 20, gap: 20, maxWidth: 680, width: '100%', alignSelf: 'center' },
  card: { padding: 20, gap: 20, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border },
  title: { color: colors.text, fontSize: 22, fontWeight: '700' },
  field: { gap: 8 },
  label: { color: colors.text, fontSize: 15, fontWeight: '600' },
  input: { minHeight: 50, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.white, borderRadius: 10, color: colors.text, fontSize: 16 },
  description: { minHeight: 110 },
  hint: { fontSize: 12, color: colors.muted },
  error: { color: '#a42b2b', fontSize: 14, lineHeight: 21 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, justifyContent: 'center' },
  selected: { backgroundColor: colors.forest, borderColor: colors.forest },
  optionText: { color: colors.forest, fontSize: 14, fontWeight: '600' },
  selectedText: { color: colors.white },
});
