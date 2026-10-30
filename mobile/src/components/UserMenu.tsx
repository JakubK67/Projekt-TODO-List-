import { useRef, useState } from 'react';
import { Animated, Modal, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { colors } from '../theme';
import type { RootStackParamList } from '../types';

export default function UserMenu() {
  const { demo, logout } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [visible, setVisible] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const width = Math.min(250, useWindowDimensions().width * 0.68);
  const closing = useRef(false);

  function open() {
    closing.current = false;
    progress.setValue(0);
    setVisible(true);
  }

  function close(action?: () => void) {
    if (closing.current) return;
    closing.current = true;
    Animated.timing(progress, { toValue: 0, duration: 180, useNativeDriver: Platform.OS !== 'web' }).start(({ finished }) => {
      if (finished) { setVisible(false); closing.current = false; action?.(); }
    });
  }

  return <>
    <Pressable accessibilityRole="button" accessibilityLabel="Otwórz menu użytkownika" accessibilityState={{ expanded: visible }}
      onPress={open} style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}>
      <View style={styles.icon}>{[0, 1, 2].map(line => <View key={line} style={styles.line} />)}</View>
    </Pressable>
    <Modal visible={visible} transparent animationType="none" onRequestClose={() => close()}
      onShow={() => Animated.timing(progress, { toValue: 1, duration: 220, useNativeDriver: Platform.OS !== 'web' }).start()}>
      <View style={styles.overlay} accessibilityViewIsModal>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0, 0.35] }) }]} />
        <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Zamknij menu" onPress={() => close()} />
        <Animated.View style={[styles.panel, { width, transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [width, 0] }) }] }]}>
          <SafeAreaView style={styles.content}>
            <View style={styles.heading}>
              <Text style={styles.title}>Menu</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Zamknij menu" onPress={() => close()} style={styles.close}>
                <Text style={styles.closeText}>×</Text>
              </Pressable>
            </View>
            {!demo ? <Pressable accessibilityRole="button" style={({ pressed }) => [styles.item, pressed && styles.pressed]}
              onPress={() => close(() => navigation.navigate('UserPanel'))}>
              <Text style={styles.itemText}>Panel użytkownika</Text>
            </Pressable> : null}
            {!demo ? <Pressable accessibilityRole="button" style={({ pressed }) => [styles.item, pressed && styles.pressed]}
              onPress={() => close(() => navigation.navigate('Statistics'))}>
              <Text style={styles.itemText}>Statystyki</Text>
            </Pressable> : null}
            <Pressable accessibilityRole="button" style={({ pressed }) => [styles.item, pressed && styles.pressed]}
              onPress={() => close(() => { void logout(); })}>
              <Text style={[styles.itemText, styles.logout]}>{demo ? 'Wyjdź' : 'Wyloguj'}</Text>
            </Pressable>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  trigger: { paddingVertical: 12, paddingHorizontal: 16, marginRight: 12, minHeight: 48, justifyContent: 'center' },
  icon: { width: 24, gap: 5 },
  line: { height: 2, width: '100%', backgroundColor: colors.white, borderRadius: 2 },
  pressed: { opacity: 0.65 },
  overlay: { flex: 1, alignItems: 'flex-end' },
  panel: { height: '100%', backgroundColor: colors.surface },
  content: { flex: 1, padding: 20, gap: 16 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 20, fontWeight: '700', color: colors.text },
  close: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 32, color: colors.text },
  item: { padding: 16, minHeight: 52, borderRadius: 12, backgroundColor: colors.soft },
  itemText: { fontSize: 16, fontWeight: '600', color: colors.text },
  logout: { color: colors.danger },
});
