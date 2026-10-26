import { useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppButton from '../components/AppButton';
import DemoNotice from '../components/DemoNotice';
import { demoTasks } from '../data/demoTasks';
import { colors, priorityColors, statusColors } from '../theme';
import { STATUSES, type RootStackParamList, type Task } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Tasks'>;
type Filter = 'Wszystkie' | Task['status'];

export default function TasksScreen({ navigation }: Props) {
  const [filter, setFilter] = useState<Filter>('Wszystkie');
  const tasks = demoTasks.filter(task => filter === 'Wszystkie' || task.status === filter);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <FlatList data={tasks} keyExtractor={task => String(task.id)} contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.heading}>
            <DemoNotice />
            <View style={styles.titleRow}>
              <View style={styles.titleCopy}>
                <Text style={styles.title}>Zadania pod kontrolą</Text>
                <Text style={styles.subtitle}>Znajdź chwilę na to, co ważne.</Text>
              </View>
              <View style={styles.count}><Text style={styles.countText}>{demoTasks.length}</Text></View>
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
        ListEmptyComponent={<Text style={styles.subtitle}>Brak zadań o tym statusie.</Text>}
        renderItem={({ item }) => (
          <View style={[styles.card, { borderLeftColor: statusColors[item.status] }]}>
            <Text style={[styles.status, { color: statusColors[item.status] }]}>{item.status}</Text>
            <Text style={styles.taskName}>{item.name}</Text>
            <Text style={styles.description}>{item.description}</Text>
            <View style={styles.details}>
              <View><Text style={styles.label}>Termin</Text><Text style={styles.value}>{item.deadline || 'Brak terminu'}</Text></View>
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
