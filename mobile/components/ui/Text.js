import { Text as RNText } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { type } from '@/theme/tokens';

const TONES = {
  default: 'fg',
  soft: 'fgSoft',
  muted: 'muted',
  brand: 'brandInk',
  leaf: 'leaf',
  danger: 'danger',
  warn: 'warn',
  inverse: 'brandFg',
};

// The only text component: a variant from the type scale and a tone from the
// palette. Text is always rendered as text — nothing here interprets markup.
export function Text({ variant = 'body', tone = 'default', color, center, style, ...rest }) {
  const { colors } = useTheme();
  return (
    <RNText
      {...rest}
      style={[type[variant] || type.body, { color: color || colors[TONES[tone] || 'fg'] }, center && { textAlign: 'center' }, style]}
    />
  );
}
