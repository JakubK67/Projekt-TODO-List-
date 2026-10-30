import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppButton from '../components/AppButton';
import ListHeading from '../components/ListHeading';
import DemoNotice from '../components/DemoNotice';
import { useAuth } from '../auth/AuthContext';
import { displayDate, readTasks } from '../utils/tasks';
import { deleteTask, getTasks } from '../data/tasksApi';
import { colors, priorityColors, statusColors } from '../theme';
import { STATUSES, type RootStackParamList, type Task } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Tasks'>;
type Filter = 'Wszystkie' | Task['status'];

export default function TasksScreen({ navigation }: Props) {
  const { demo, client } = useAuth();
  const [filter, setFilter] = useState<Filter>('Wszystkie');
  const [source, setSource] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<Task['id'] | null>(null);
  const load = useCallback(async (signal: AbortSignal) => {
    setLoading(true); setError('');
    try {
      const data = demo ? await getTasks() : await client.api('/api/tasks', { signal });
      if (!signal.aborted) setSource(readTasks(data));
    } catch {
      if (!signal.aborted) setError(demo
        ? 'Nie udało się pobrać zadań z json-server. Sprawdź, czy serwer działa.'
        : 'Nie udało się pobrać zadań z konta. Sprawdź połączenie z backendem.');
    } finally { if (!signal.aborted) setLoading(false); }
  }, [demo, client]);
  const removeTask = useCallback(async (id: Task['id']) => {
    setDeletingId(id);
    setError('');
    try {
      if (demo) await deleteTask(id);
      else await client.api(`/api/tasks/${encodeURIComponent(id)}`, { method: 'DELETE' });
      setSource(current => current.filter(task => String(task.id) !== String(id)));
    } catch {
      setError(demo
        ? 'Nie udało się usunąć zadania z json-server. Sprawdź, czy serwer działa.'
        : 'Nie udało się usunąć zadania z konta. Sprawdź połączenie z backendem.');
    } finally {
      setDeletingId(null);
    }
  }, [demo, client]);

  function confirmDelete(task: Task) {
    const message = `Czy na pewno usunąć zadanie „${task.name}”?`;
    if (Platform.OS === 'web') {
      if (window.confirm(message)) void removeTask(task.id);
      return;
    }

    Alert.alert('Usuń zadanie', message, [
      { text: 'Anuluj', style: 'cancel' },
      { text: 'Usuń', style: 'destructive', onPress: () => { void removeTask(task.id); } },
    ]);
  }
  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]));
  const tasks = source.filter(task => filter === 'Wszystkie' || task.status === filter);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <FlatList data={tasks} keyExtractor={task => String(task.id)} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}
        refreshing={loading && source.length > 0} onRefresh={() => { void load(new AbortController().signal); }}
        ListHeaderComponent={
          <View style={styles.heading}>
            {demo ? <DemoNotice /> : null}
            <ListHeading title="Lista zadań" count={source.length} loading={loading} active="Tasks" showTabs={!demo}
              onSelect={section => navigation.replace(section)} addLabel="+ Dodaj zadanie"
              onAdd={() => navigation.navigate('TaskForm')} />
            {error ? <View style={styles.errorBox}><Text accessibilityRole="alert" style={styles.error}>{error}</Text>
              <AppButton label="Spróbuj ponownie" secondary disabled={loading} onPress={() => { void load(new AbortController().signal); }} /></View> : null}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
              {(['Wszystkie', ...STATUSES] as Filter[]).map(value => (
                <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: filter === value }}
                  onPress={() => setFilter(value)} style={[styles.filter, filter === value && styles.selectedFilter]}>
                  <Text style={[styles.filterText, filter === value && styles.selectedFilterText]}>{value}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={loading ? <ActivityIndicator color={colors.forest} accessibilityLabel="Wczytywanie zadań" /> : !error ? <Text style={styles.subtitle}>Brak zadań o tym statusie.</Text> : undefined}
        renderItem={({ item }) => (
          <View style={[styles.card, { borderLeftColor: statusColors[item.status] }]}>
            <Text style={[styles.status, { color: statusColors[item.status] }]}>{item.status}</Text>
            {item.project_name ? <Text style={styles.label}>{item.project_name}</Text> : null}
            <Text style={styles.taskName}>{item.name}</Text>
            <Text style={styles.description}>{item.description}</Text>
            <View style={styles.details}>
              <View><Text style={styles.label}>Termin</Text><Text style={styles.value}>{displayDate(item.deadline) || 'Brak terminu'}</Text></View>
              <View><Text style={styles.label}>Priorytet</Text><Text style={[styles.value, { color: priorityColors[item.priority] }]}>{item.priority}</Text></View>
            </View>
            <AppButton label="Edytuj" secondary onPress={() => navigation.navigate('TaskForm', { task: item })} />
            <AppButton label={String(deletingId) === String(item.id) ? 'Usuwanie...' : 'Usuń zadanie'}
              secondary disabled={deletingId !== null} onPress={() => confirmDelete(item)} />
          </View>
        )} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 16, maxWidth: 680, width: '100%', alignSelf: 'center' },
  heading: { gap: 20 },
  errorBox: { padding: 16, borderRadius: 12, backgroundColor: colors.surface, gap: 12 },
  error: { color: colors.danger, fontSize: 14, lineHeight: 21 },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 22, marginTop: 6 },
  filters: { gap: 8, paddingBottom: 4 },
  filter: { minHeight: 44, borderRadius: 22, paddingHorizontal: 16, justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  selectedFilter: { backgroundColor: colors.forest, borderColor: colors.forest },
  filterText: { color: colors.forest, fontSize: 14, fontWeight: '600' },
  selectedFilterText: { color: colors.white },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 4, borderRadius: 16, padding: 20, gap: 12 },
  status: { fontSize: 13, fontWeight: '700' },
  taskName: { fontSize: 19, fontWeight: '700', color: colors.text, lineHeight: 26 },
  description: { fontSize: 14, color: colors.muted, lineHeight: 22 },
  details: { flexDirection: 'row', flexWrap: 'wrap', gap: 28, paddingVertical: 6 },
  label: { color: colors.muted, fontSize: 12, marginBottom: 5 },
  value: { color: colors.text, fontSize: 14, fontWeight: '600' },
});
