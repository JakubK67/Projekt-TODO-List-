import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppButton from '../components/AppButton';
import DemoNotice from '../components/DemoNotice';
import { useAuth } from '../auth/AuthContext';
import { displayDate, readTasks } from '../utils/tasks';
import { demoTasks } from '../data/demoTasks';
import { colors, priorityColors, statusColors } from '../theme';
import { STATUSES, type RootStackParamList, type Task } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Tasks'>;
type Filter = 'Wszystkie' | Task['status'];

export default function TasksScreen({ navigation }: Props) {
  const { demo, user, client } = useAuth();
  const [filter, setFilter] = useState<Filter>('Wszystkie');
  const [source, setSource] = useState<Task[]>(demo ? demoTasks : []);
  const [loading, setLoading] = useState(!demo);
  const [error, setError] = useState('');
  const load = useCallback(async (signal: AbortSignal) => {
    if (demo) return;
    setLoading(true); setError('');
    try {
      const data = await client.api('/api/tasks', signal);
      if (!signal.aborted) setSource(readTasks(data));
    } catch (err) {
      if (!signal.aborted) setError(err instanceof Error ? err.message : 'Nie udało się pobrać zadań. Sprawdź połączenie.');
    } finally { if (!signal.aborted) setLoading(false); }
  }, [demo, client]);
  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]));
  const tasks = source.filter(task => filter === 'Wszystkie' || task.status === filter);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <FlatList data={tasks} keyExtractor={task => String(task.id)} contentContainerStyle={styles.content}
        refreshing={loading && source.length > 0} onRefresh={demo ? undefined : () => { void load(new AbortController().signal); }}
        ListHeaderComponent={
          <View style={styles.heading}>
            {demo ? <DemoNotice /> : <Text style={styles.welcome}>Witaj, {user?.username}</Text>}
            {error && <View style={styles.errorBox}><Text accessibilityRole="alert" style={styles.error}>{error}</Text>
              <AppButton label="Spróbuj ponownie" secondary disabled={loading} onPress={() => { void load(new AbortController().signal); }} /></View>}
            <View style={styles.titleRow}>
              <View style={styles.titleCopy}>
                <Text style={styles.title}>Zadania pod kontrolą</Text>
                <Text style={styles.subtitle}>Znajdź chwilę na to, co ważne.</Text>
              </View>
              <View style={styles.count}><Text style={styles.countText}>{loading && source.length === 0 ? '…' : source.length}</Text></View>
            </View>
            <AppButton label="+ Dodaj zadanie" onPress={() => navigation.navigate('TaskForm')} />
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
            {item.project_name && <Text style={styles.label}>{item.project_name}</Text>}
            <Text style={styles.taskName}>{item.name}</Text>
            <Text style={styles.description}>{item.description}</Text>
            <View style={styles.details}>
              <View><Text style={styles.label}>Termin</Text><Text style={styles.value}>{displayDate(item.deadline) || 'Brak terminu'}</Text></View>
              <View><Text style={styles.label}>Priorytet</Text><Text style={[styles.value, { color: priorityColors[item.priority] }]}>{item.priority}</Text></View>
            </View>
            <AppButton label="Edytuj" secondary onPress={() => navigation.navigate('TaskForm', { task: item })} />
          </View>
        )} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 16, maxWidth: 680, width: '100%', alignSelf: 'center' },
  heading: { gap: 20 },
  welcome: { color: colors.forest, fontSize: 16, fontWeight: '600' },
  errorBox: { padding: 16, borderRadius: 12, backgroundColor: colors.surface, gap: 12 },
  error: { color: colors.danger, fontSize: 14, lineHeight: 21 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  titleCopy: { flex: 1 },
  title: { fontSize: 25, fontWeight: '800', color: colors.text },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 22, marginTop: 6 },
  count: { minWidth: 44, minHeight: 44, borderRadius: 14, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center', padding: 10 },
  countText: { color: colors.forest, fontSize: 20, fontWeight: '700' },
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
