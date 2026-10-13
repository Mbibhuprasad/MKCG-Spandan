import { Pressable, StyleSheet, View } from 'react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/theme/ThemeProvider';
import { HIT_SLOP, radius, space } from '@/theme/tokens';
import { formatDate, formatDateTime } from '@/utils/format';
import { FieldError, FieldLabel } from './Fields';
import { Text } from './Text';

// Date (or date and time) chosen with Android's own pickers. `value` is a Date or null.
export function DateField({ label, required, value, onChange, mode = 'date', minimumDate, maximumDate, placeholder, error, clearable = true, style }) {
  const { colors } = useTheme();

  const open = () => {
    const base = value || (minimumDate && minimumDate > new Date() ? minimumDate : new Date());
    DateTimePickerAndroid.open({
      value: base,
      mode: 'date',
      minimumDate,
      maximumDate,
      onChange: (event, picked) => {
        if (event.type !== 'set' || !picked) return;
        if (mode !== 'datetime') {
          onChange(picked);
          return;
        }
        // Second step: the time on the chosen day.
        DateTimePickerAndroid.open({
          value: new Date(picked.getFullYear(), picked.getMonth(), picked.getDate(), base.getHours(), base.getMinutes()),
          mode: 'time',
          is24Hour: false,
          onChange: (timeEvent, time) => {
            if (timeEvent.type !== 'set' || !time) return;
            onChange(new Date(picked.getFullYear(), picked.getMonth(), picked.getDate(), time.getHours(), time.getMinutes()));
          },
        });
      },
    });
  };

  const text = value ? (mode === 'datetime' ? formatDateTime(value) : formatDate(value)) : placeholder || (mode === 'datetime' ? 'Choose date and time' : 'Choose a date');

  return (
    <View style={[styles.field, style]}>
      <FieldLabel label={label} required={required} />
      <Pressable
        onPress={open}
        style={[styles.box, { backgroundColor: colors.surface, borderColor: error ? colors.danger : colors.line }]}
        accessibilityRole="button"
        accessibilityLabel={`${label || 'Date'}: ${value ? text : 'not set'}`}
      >
        <Ionicons name={mode === 'datetime' ? 'time-outline' : 'calendar-outline'} size={18} color={colors.muted} />
        <Text style={styles.flex} tone={value ? 'default' : 'muted'} numberOfLines={1}>
          {text}
        </Text>
        {value && clearable ? (
          <Pressable onPress={() => onChange(null)} hitSlop={HIT_SLOP} accessibilityRole="button" accessibilityLabel={`Clear ${label || 'date'}`}>
            <Ionicons name="close-circle" size={19} color={colors.muted} />
          </Pressable>
        ) : null}
      </Pressable>
      <FieldError message={error} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  field: { marginBottom: space.lg },
  box: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 14, minHeight: 48 },
});
