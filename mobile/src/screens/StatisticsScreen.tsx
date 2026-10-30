import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppButton from '../components/AppButton';
import { useAuth } from '../auth/AuthContext';
import { colors, priorityColors } from '../theme';
import { RANKS, readStatistics } from '../utils/statistics';

export default function StatisticsScreen() {
  const { client } = useAuth();
  const [stats, setStats] = useState<ReturnType<typeof readStatistics> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rulesOpen, setRulesOpen] = useState(false);

  const load = useCallback(async (signal: AbortSignal) => {
    setLoading(true); setError('');
    try {
      const data = readStatistics(await client.api('/api/statistics', { signal }));
      if (!signal.aborted) setStats(data);
    } catch { if (!signal.aborted) setError('Nie udało się wczytać statystyk. Sprawdź połączenie i spróbuj ponownie.'); }
    finally { if (!signal.aborted) setLoading(false); }
  }, [client]);

  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]));

  return <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={loading && stats !== null} onRefresh={() => void load(new AbortController().signal)} />}>
      <Text style={styles.title}>Twoje statystyki</Text>
      {loading && !stats ? <ActivityIndicator color={colors.forest} /> : null}
      {error ? <View style={styles.card}>
        <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
        <AppButton label="Spróbuj ponownie" secondary disabled={loading} onPress={() => void load(new AbortController().signal)} />
      </View> : null}
      {stats ? <>
        {[{ label: 'Wykonane zadania', value: stats.completed }, { label: 'Zdobyte punkty', value: stats.score }].map(counter =>
          <View key={counter.label} style={styles.card}>
            <Text style={styles.heading}>{counter.label}</Text>
            <Text style={styles.number} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.3}>{counter.value}</Text>
          </View>)}
        <View style={styles.card}>
          <Text style={styles.heading}>Twoja ranga</Text>
          <Text style={[styles.rank, { color: stats.rank.color }]}>{stats.rank.name}</Text>
          <View style={styles.track} accessible accessibilityRole="progressbar" accessibilityLabel="Postęp do kolejnej rangi"
            accessibilityValue={{ min: 0, max: 100, now: stats.progress }}>
            <View style={{ height: '100%', width: `${stats.progress}%`, backgroundColor: stats.rank.color }} />
          </View>
          <Text style={styles.text}>{stats.nextRank
            ? `Do rangi „${stats.nextRank.name}” brakuje ${stats.nextRank.threshold - stats.score} pkt.`
            : 'Osiągnięto najwyższą rangę!'}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.heading}>Wykonane zadania według priorytetu</Text>
          {stats.priorities.map(priority => <View key={priority.name} style={styles.priority}>
            <Text style={[styles.heading, { color: priorityColors[priority.name] }]}>{priority.name}</Text>
            <Text style={styles.text}>Wykonane: {priority.count} · Punkty: {priority.score}</Text>
            <Text style={styles.text}>{priority.points} pkt za zadanie</Text>
          </View>)}
        </View>
        <View style={styles.card}>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: rulesOpen }} onPress={() => setRulesOpen(value => !value)} style={styles.toggle}>
            <Text style={[styles.heading, styles.toggleLabel]}>Jak zdobyć rangę?</Text>
            <View style={[styles.arrow, { transform: [{ rotate: rulesOpen ? '225deg' : '45deg' }] }]} />
          </Pressable>
          {rulesOpen ? <>
            <Text style={styles.text}>Wykonuj zadania, aby zdobywać punkty. Wyższy priorytet oznacza więcej punktów.</Text>
            {RANKS.map(rank => <View key={rank.name} style={styles.rankRow}>
              <Text style={[styles.heading, styles.toggleLabel, { color: rank.color }]}>{rank.name}</Text>
              <Text style={styles.text}>od {rank.threshold} pkt</Text>
            </View>)}
            <Text style={styles.text}>Statystyki obejmują zapisane zadania. Usunięcie zadania, zmiana priorytetu lub statusu przelicza punkty i rangę.</Text>
          </> : null}
        </View>
      </> : null}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 16, maxWidth: 680, width: '100%', alignSelf: 'center' },
  title: { fontSize: 25, fontWeight: '800', color: colors.text },
  card: { padding: 20, gap: 16, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border },
  heading: { fontSize: 16, fontWeight: '700', color: colors.text },
  number: { fontSize: 64, fontWeight: '800', color: colors.forest, textAlign: 'center' },
  rank: { fontSize: 26, fontWeight: '800' },
  track: { height: 12, borderRadius: 6, backgroundColor: colors.soft, overflow: 'hidden' },
  text: { fontSize: 14, lineHeight: 22, color: colors.muted },
  priority: { gap: 4, borderTopWidth: 1, borderColor: colors.border, paddingTop: 12 },
  toggle: { flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: 12 },
  toggleLabel: { flex: 1 },
  arrow: { width: 10, height: 10, borderRightWidth: 2, borderBottomWidth: 2, borderColor: colors.forest, marginRight: 4 },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  error: { color: colors.danger, lineHeight: 21 },
});
