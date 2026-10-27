import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

export default function DemoNotice({ form = false }: { form?: boolean }) {
  return (
    <View style={styles.notice}>
      <Text style={styles.title}>Mock API</Text>
      <Text style={styles.text}>{form
        ? 'Zmiany są zapisywane przez lokalny json-server.'
        : 'Zadania są wczytywane z lokalnego json-server.'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { backgroundColor: colors.soft, borderRadius: 12, padding: 16, gap: 6 },
  title: { color: colors.forest, fontWeight: '700', fontSize: 14 },
  text: { color: colors.muted, fontSize: 14, lineHeight: 21 },
});
