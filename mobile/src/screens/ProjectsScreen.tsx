import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import AppButton from '../components/AppButton';
import ListHeading from '../components/ListHeading';
import { colors } from '../theme';
import { readProjects } from '../utils/projects';
import { readTasks } from '../utils/tasks';
import type { Project, RootStackParamList, Task } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Projects'>;

export default function ProjectsScreen({ navigation }: Props) {
  const { client, demo } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<number | null>(null);
  const [assigning, setAssigning] = useState<number | null>(null);

  const load = useCallback(async (signal: AbortSignal) => {
    if (demo) { setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const [projectData, taskData] = await Promise.all([
        client.api('/api/projects', { signal }), client.api('/api/tasks', { signal }),
      ]);
      const nextProjects = readProjects(projectData);
      const nextTasks = readTasks(taskData);
      if (!signal.aborted) { setProjects(nextProjects); setTasks(nextTasks); }
    } catch { if (!signal.aborted) setError('Nie udało się wczytać projektów. Sprawdź połączenie i spróbuj ponownie.'); }
    finally { if (!signal.aborted) setLoading(false); }
  }, [client, demo]);

  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]));

  async function remove(project: Project) {
    setDeleting(project.id); setError('');
    try {
      await client.api(`/api/projects/${project.id}`, { method: 'DELETE' });
      setProjects(current => current.filter(item => item.id !== project.id));
      setTasks(current => current.filter(task => task.project_id !== project.id));
      setAssigning(null);
    } catch { setError('Nie udało się usunąć projektu. Spróbuj ponownie.'); }
    finally { setDeleting(null); }
  }

  function confirmDelete(project: Project) {
    const message = `Czy usunąć projekt „${project.name}” i wszystkie zadania w nim? Tej operacji nie można cofnąć.`;
    if (Platform.OS === 'web') {
      if (window.confirm(message)) void remove(project);
    } else {
      Alert.alert('Usuń projekt', message, [
        { text: 'Anuluj', style: 'cancel' },
        { text: 'Usuń projekt i zadania', style: 'destructive', onPress: () => void remove(project) },
      ]);
    }
  }

  return <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
    <FlatList data={projects} keyExtractor={project => String(project.id)} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}
      refreshing={loading && projects.length > 0} onRefresh={() => void load(new AbortController().signal)}
      ListHeaderComponent={<View style={styles.heading}>
        <ListHeading title="Lista projektów" count={projects.length} loading={loading} active="Projects"
          onSelect={section => navigation.replace(section)} addLabel="+ Dodaj projekt" addDisabled={demo || deleting !== null}
          onAdd={() => navigation.navigate('ProjectForm')} />
        {error ? <View style={styles.section}><Text accessibilityRole="alert" style={styles.error}>{error}</Text>
          <AppButton label="Spróbuj ponownie" secondary disabled={loading} onPress={() => void load(new AbortController().signal)} /></View> : null}
      </View>}
      ListEmptyComponent={loading ? <ActivityIndicator color={colors.forest} /> : !error ?
        <Text style={styles.muted}>{demo ? 'Zaloguj się, aby zarządzać projektami na swoim koncie.' : 'Nie masz jeszcze projektów.'}</Text> : undefined}
      renderItem={({ item }) => {
        const assigned = tasks.filter(task => task.project_id === item.id);
        return <View style={styles.card}>
          <Text style={styles.title}>{item.name}</Text>
          {item.description ? <Text style={styles.muted}>{item.description}</Text> : null}
          <Text style={styles.label}>Zadania: {assigned.length}</Text>
          {assigned.map(task => <Pressable key={task.id} accessibilityRole="button"
            accessibilityLabel={`Edytuj zadanie: ${task.name}`} style={styles.task}
            onPress={() => navigation.navigate('TaskForm', { task })}>
            <Text style={styles.label}>{task.name}</Text><Text style={styles.muted}>{task.status}</Text>
          </Pressable>)}
          <AppButton label="+ Dodaj zadanie w projekcie" disabled={deleting !== null}
            onPress={() => navigation.navigate('TaskForm', { projectId: item.id })} />
          <AppButton label={assigning === item.id ? 'Ukryj wybór zadania' : 'Przypisz istniejące zadanie'} secondary
            disabled={deleting !== null} onPress={() => setAssigning(assigning === item.id ? null : item.id)} />
          {assigning === item.id ? <View style={styles.section}>
            <Text style={styles.muted}>Wybierz zadanie i zapisz formularz, aby przypisać je do tego projektu.</Text>
            {tasks.filter(task => task.project_id !== item.id).map(task => <AppButton key={task.id} label={task.name} secondary
              onPress={() => navigation.navigate('TaskForm', { task, projectId: item.id })} />)}
            {!tasks.some(task => task.project_id !== item.id) ? <Text style={styles.muted}>Brak innych zadań do przypisania.</Text> : null}
          </View> : null}
          <View style={styles.section}>
            <AppButton label="Edytuj projekt" secondary disabled={deleting !== null}
              onPress={() => navigation.navigate('ProjectForm', { project: item })} />
            <AppButton label={deleting === item.id ? 'Usuwanie...' : 'Usuń projekt'} secondary
              disabled={deleting !== null} onPress={() => confirmDelete(item)} />
          </View>
        </View>;
      }} />
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 16, maxWidth: 680, width: '100%', alignSelf: 'center' },
  section: { gap: 12 },
  heading: { gap: 20 },
  card: { padding: 20, gap: 16, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  label: { fontSize: 15, fontWeight: '600', color: colors.text },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 22 },
  error: { color: colors.danger, lineHeight: 21 },
  task: { minHeight: 50, padding: 12, gap: 4, borderRadius: 10, backgroundColor: colors.soft },
});
