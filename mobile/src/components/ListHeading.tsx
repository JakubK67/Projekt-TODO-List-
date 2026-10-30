import { StyleSheet, Text, View } from 'react-native';
import AppButton from './AppButton';
import SectionTabs from './SectionTabs';
import { colors } from '../theme';
import type { ComponentProps } from 'react';

type Props = {
  title: string;
  count: number;
  loading: boolean;
  active: ComponentProps<typeof SectionTabs>['active'];
  onSelect: ComponentProps<typeof SectionTabs>['onSelect'];
  showTabs?: boolean;
  addLabel: string;
  onAdd: () => void;
  addDisabled?: boolean;
};

export default function ListHeading({ title, count, loading, active, onSelect, showTabs = true, addLabel, onAdd, addDisabled }: Props) {
  return <View style={styles.heading}>
    <View style={styles.titleRow}>
      <View style={styles.titleCopy}><Text style={styles.title}>{title}</Text></View>
      <View style={styles.count}><Text style={styles.countText}>{loading && count === 0 ? '…' : count}</Text></View>
    </View>
    {showTabs ? <SectionTabs active={active} onSelect={onSelect} /> : null}
    <AppButton label={addLabel} onPress={onAdd} disabled={addDisabled} />
  </View>;
}

const styles = StyleSheet.create({
  heading: { gap: 20 },
  titleRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 12 },
  titleCopy: { flex: 1 },
  title: { fontSize: 25, fontWeight: '800', color: colors.text },
  count: { minWidth: 44, minHeight: 44, borderRadius: 14, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center', padding: 10 },
  countText: { color: colors.forest, fontSize: 20, fontWeight: '700' },
});
