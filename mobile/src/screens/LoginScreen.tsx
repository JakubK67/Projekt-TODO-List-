import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppButton from '../components/AppButton';
import { colors } from '../theme';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.brand}><Text style={styles.brandText}>TODO</Text></View>
        <Text style={styles.eyebrow}>TWÓJ DZIEŃ, TWÓJ PLAN</Text>
        <Text style={styles.title}>Mniej chaosu.{ '\n' }Więcej zrobione.</Text>
        <Text style={styles.subtitle}>Twoje zadania zawsze pod ręką. Planuj, ustalaj priorytety i działaj we własnym rytmie.</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Witaj w TODO Mobile</Text>
          <Text style={styles.copy}>Zobacz zadania wczytane z lokalnego mock API.</Text>
          <AppButton label="Zobacz podgląd aplikacji" onPress={() => navigation.navigate('Tasks')} />
          <AppButton label="Zaloguj się" disabled secondary />
          <Text style={styles.note}>Logowanie do konta nie jest jeszcze dostępne w tej wersji.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 18, maxWidth: 560, width: '100%', alignSelf: 'center' },
  brand: { width: 72, height: 72, borderRadius: 22, backgroundColor: colors.forest, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  brandText: { color: colors.white, fontWeight: '800', fontSize: 20, letterSpacing: 1 },
  eyebrow: { color: colors.muted, fontSize: 12, letterSpacing: 2, fontWeight: '700' },
  title: { color: colors.text, fontSize: 36, lineHeight: 43, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 16, lineHeight: 25 },
  card: { padding: 22, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 16, marginTop: 8 },
  cardTitle: { color: colors.text, fontWeight: '700', fontSize: 21 },
  copy: { color: colors.muted, fontSize: 15, lineHeight: 23 },
  note: { color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: 'center' },
});
