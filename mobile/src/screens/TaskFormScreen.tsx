import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppButton from '../components/AppButton';
import DemoNotice from '../components/DemoNotice';
import { createTask, updateTask } from '../data/tasksApi';
import { colors } from '../theme';
import { useAuth } from '../auth/AuthContext';
import { apiDate, displayDate } from '../utils/tasks';
import { readProjects } from '../utils/projects';
import { PRIORITIES, STATUSES, type Project, type RootStackParamList, type Task, type TaskInput } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'TaskForm'>;

export default function TaskFormScreen({ navigation, route }: Props) {
  const { demo, client } = useAuth();
  const task = route.params?.task;
  const [name, setName] = useState(task?.name ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [deadline, setDeadline] = useState(displayDate(task?.deadline ?? ''));
  const [priority, setPriority] = useState<Task['priority']>(task?.priority ?? 'Normalny');
  const [status, setStatus] = useState<Task['status']>(task?.status ?? 'Do zrobienia');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<number | null>(route.params?.projectId ?? task?.project_id ?? null);
  const [projectsLoading, setProjectsLoading] = useState(!demo);
  const [projectsError, setProjectsError] = useState('');

  const loadProjects = useCallback(async (signal: AbortSignal) => {
    if (demo) return;
    setProjectsLoading(true); setProjectsError('');
    try {
      const data = readProjects(await client.api('/api/projects', { signal }));
      if (!signal.aborted) setProjects(data);
    } catch { if (!signal.aborted) setProjectsError('Nie udało się wczytać projektów. Spróbuj ponownie.'); }
    finally { if (!signal.aborted) setProjectsLoading(false); }
  }, [client, demo]);

  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    void loadProjects(controller.signal);
    return () => controller.abort();
  }, [loadProjects]));

  async function saveTask() {
    if (saving || (!demo && (projectsLoading || projectsError))) return;
    if (!name.trim()) {
      setError('Wpisz nazwę zadania.');
      return;
    }

    const taskData: TaskInput = { name: name.trim(), description: description.trim(), deadline: deadline.trim(), priority, status };
    setSaving(true);
    setError('');
    try {
      if (demo) {
        if (task) await updateTask({ ...taskData, id: task.id });
        else await createTask(taskData);
      } else {
        if (projectId !== null && !projects.some(project => project.id === projectId)) {
          setError('Ten projekt już nie istnieje. Wybierz inny projekt lub Brak.');
          return;
        }
        const apiTask = { ...taskData, deadline: apiDate(taskData.deadline), project_id: projectId };
        await client.api(task ? `/api/tasks/${encodeURIComponent(task.id)}` : '/api/tasks', {
          method: task ? 'PUT' : 'POST',
          body: JSON.stringify(apiTask),
        });
      }
      navigation.goBack();
    } catch {
      setError(demo
        ? 'Nie udało się zapisać zadania. Sprawdź połączenie z json-server i spróbuj ponownie.'
        : 'Nie udało się zapisać zadania na koncie. Sprawdź połączenie z backendem i spróbuj ponownie.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={96}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
          {demo ? <DemoNotice form /> : <Text style={styles.hint}>Zadanie zostanie zapisane na Twoim koncie.</Text>}
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
            {!demo ? <View style={styles.field}>
              <Text style={styles.label}>Projekt</Text>
              {projectsLoading ? <Text style={styles.hint}>Wczytywanie projektów...</Text> : null}
              {projectsError ? <View style={styles.field}>
                <Text accessibilityRole="alert" style={styles.error}>{projectsError}</Text>
                <AppButton label="Spróbuj ponownie" secondary disabled={projectsLoading}
                  onPress={() => void loadProjects(new AbortController().signal)} />
              </View> : null}
              <View style={styles.options}>
                {[{ id: null, name: 'Brak' }, ...projects].map(project => <Pressable key={project.id ?? 'none'}
                  accessibilityRole="radio" accessibilityLabel={`Projekt: ${project.name}`}
                  accessibilityState={{ checked: projectId === project.id, disabled: saving || projectsLoading }}
                  disabled={saving || projectsLoading} onPress={() => setProjectId(project.id)}
                  style={[styles.option, projectId === project.id && styles.selected]}>
                  <Text style={[styles.optionText, projectId === project.id && styles.selectedText]}>{project.name}</Text>
                </Pressable>)}
              </View>
            </View> : null}
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
            <AppButton label={saving ? 'Zapisywanie...' : 'Zapisz zadanie'} disabled={saving || (!demo && (projectsLoading || !!projectsError))} onPress={() => void saveTask()} />
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
