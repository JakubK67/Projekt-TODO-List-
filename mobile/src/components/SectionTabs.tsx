import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

const tabs = [
  { name: 'Tasks', label: 'Zadania' },
  { name: 'Projects', label: 'Projekty' },
] as const;

type Section = typeof tabs[number]['name'];
type Props = { active: Section; onSelect: (section: Section) => void };

export default function SectionTabs({ active, onSelect }: Props) {
  return <View style={styles.tabs}>
    {tabs.map(tab => <Pressable key={tab.name} accessibilityRole="tab"
      accessibilityState={{ selected: active === tab.name }} onPress={() => { if (active !== tab.name) onSelect(tab.name); }}
      style={({ pressed }) => [styles.tab, active === tab.name && styles.selected, pressed && styles.pressed]}>
      <Text style={[styles.label, active === tab.name && styles.selectedLabel]}>{tab.label}</Text>
    </Pressable>)}
  </View>;
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', width: '100%', gap: 12 },
  tab: { flex: 1, minWidth: 0, minHeight: 50, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.soft },
  selected: { backgroundColor: colors.forest },
  label: { color: colors.forest, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  selectedLabel: { color: colors.white },
  pressed: { opacity: 0.8 },
});
