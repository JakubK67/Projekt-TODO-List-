import { Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '../theme';

type Props = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  secondary?: boolean;
};

export default function AppButton({ label, onPress, disabled = false, secondary = false }: Props) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled}
      onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.secondary,
        pressed && !disabled && styles.pressed, disabled && styles.disabled]}>
      <Text style={[styles.label, secondary && styles.secondaryLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 50, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 12,
    backgroundColor: colors.forest, alignItems: 'center', justifyContent: 'center' },
  label: { color: colors.white, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  secondary: { backgroundColor: colors.soft },
  secondaryLabel: { color: colors.forest },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.45 },
});
