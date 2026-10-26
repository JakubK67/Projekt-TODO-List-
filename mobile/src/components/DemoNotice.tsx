import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

export default function DemoNotice({ form = false }: { form?: boolean }) {
  return (
    <View style={styles.notice}>
      <Text style={styles.title}>Tryb podglądu</Text>
      <Text style={styles.text}>{form
        ? 'Możesz wypróbować formularz. Zmiany nie są zapisywane.'
        : 'Dane przykładowe. Zadania z Twojego konta nie są jeszcze wczytywane.'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { backgroundColor: colors.soft, borderRadius: 12, padding: 16, gap: 6 },
  title: { color: colors.forest, fontWeight: '700', fontSize: 14 },
  text: { color: colors.muted, fontSize: 14, lineHeight: 21 },
});
