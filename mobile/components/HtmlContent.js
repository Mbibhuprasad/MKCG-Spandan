import { useMemo } from 'react';
import { Text as Span, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { openLink } from '@/utils/phone';

// Renders a blog body. The API turns the author's Markdown into HTML and passes
// it through an allow-list (backend/src/services/markdown.service.js), so only
// these tags can arrive: h2 h3 h4 p br hr blockquote ul ol li strong em s code
// pre table thead tbody tr th td a. Each one is mapped to a native Text/View
// here — no web view, and nothing in the content is ever executed. Tags outside
// the list are ignored and their text is shown as plain text.

const VOID = new Set(['br', 'hr']);
const BLOCKS = new Set(['p', 'h2', 'h3', 'h4', 'blockquote', 'ul', 'ol', 'li', 'pre', 'hr', 'table', 'thead', 'tbody', 'tr']);
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };

const decode = (text) =>
  text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, code) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : '';
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });

function parse(html) {
  const root = { tag: 'root', children: [] };
  const stack = [root];
  const re = /<(\/?)([a-z][a-z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|([^<]+)|</gi;
  let m;
  while ((m = re.exec(html))) {
    const top = stack[stack.length - 1];
    if (m[4] !== undefined) {
      top.children.push({ text: decode(m[4]) });
    } else if (m[2]) {
      const tag = m[2].toLowerCase();
      if (m[1]) {
        const at = stack.map((n) => n.tag).lastIndexOf(tag);
        if (at > 0) stack.length = at;
      } else {
        const node = { tag, children: [] };
        if (tag === 'a') {
          const href = /href\s*=\s*("([^"]*)"|'([^']*)')/i.exec(m[3] || '');
          node.href = href ? decode(href[2] ?? href[3] ?? '') : '';
        }
        top.children.push(node);
        if (!VOID.has(tag)) stack.push(node);
      }
    } else {
      top.children.push({ text: '<' });
    }
  }
  return root;
}

const textOf = (node) => (node.text !== undefined ? node.text : node.children.map(textOf).join(''));
const hasBlockChild = (node) => node.children.some((c) => c.tag && BLOCKS.has(c.tag));

export function HtmlContent({ html }) {
  const { colors } = useTheme();
  const tree = useMemo(() => parse(String(html || '')), [html]);

  const inline = (node, key, pre = false) => {
    if (node.text !== undefined) return pre ? node.text : node.text.replace(/\s+/g, ' ');
    const kids = node.children.map((child, i) => inline(child, i, pre));
    switch (node.tag) {
      case 'br':
        return '\n';
      case 'strong':
      case 'b':
      case 'th':
        return (
          <Span key={key} style={styles.bold}>
            {kids}
          </Span>
        );
      case 'em':
      case 'i':
        return (
          <Span key={key} style={styles.italic}>
            {kids}
          </Span>
        );
      case 's':
        return (
          <Span key={key} style={styles.strike}>
            {kids}
          </Span>
        );
      case 'code':
        return (
          <Text key={key} style={[styles.code, { backgroundColor: colors.surface2, color: colors.fg }]}>
            {kids}
          </Text>
        );
      case 'a': {
        const href = node.href || '';
        const safe = /^https?:\/\//i.test(href);
        return (
          <Text key={key} tone="brand" style={styles.link} onPress={safe ? () => openLink(href) : undefined} accessibilityRole={safe ? 'link' : undefined}>
            {kids}
          </Text>
        );
      }
      default:
        return <Span key={key}>{kids}</Span>;
    }
  };

  const block = (node, key, context = {}) => {
    if (node.text !== undefined) {
      const text = node.text.replace(/\s+/g, ' ').trim();
      return text ? (
        <Text key={key} tone="soft" style={styles.paragraph}>
          {text}
        </Text>
      ) : null;
    }
    switch (node.tag) {
      case 'h2':
      case 'h3':
      case 'h4':
        return (
          <Text key={key} variant={node.tag === 'h2' ? 'h1' : node.tag === 'h3' ? 'h2' : 'h3'} style={styles.heading} accessibilityRole="header">
            {node.children.map((c, i) => inline(c, i))}
          </Text>
        );
      case 'p':
        return (
          <Text key={key} tone="soft" style={styles.paragraph}>
            {node.children.map((c, i) => inline(c, i))}
          </Text>
        );
      case 'hr':
        return <View key={key} style={[styles.rule, { backgroundColor: colors.line }]} />;
      case 'blockquote':
        return (
          <View key={key} style={[styles.quote, { borderLeftColor: colors.leaf, backgroundColor: colors.bgSoft }]}>
            {node.children.map((c, i) => block(c, i))}
          </View>
        );
      case 'pre':
        return (
          <View key={key} style={[styles.pre, { backgroundColor: colors.surface2 }]}>
            <Text style={styles.mono}>{textOf(node).replace(/\n$/, '')}</Text>
          </View>
        );
      case 'ul':
      case 'ol': {
        let n = 0;
        return (
          <View key={key} style={styles.list}>
            {node.children.map((c, i) => {
              if (c.tag !== 'li') return null;
              n += 1;
              return block(c, i, { marker: node.tag === 'ol' ? `${n}.` : '•' });
            })}
          </View>
        );
      }
      case 'li':
        return (
          <View key={key} style={styles.item}>
            <Text tone="leaf" style={styles.marker}>
              {context.marker || '•'}
            </Text>
            <View style={styles.flex}>
              {hasBlockChild(node) ? (
                node.children.map((c, i) => block(c, i))
              ) : (
                <Text tone="soft" style={styles.listText}>
                  {node.children.map((c, i) => inline(c, i))}
                </Text>
              )}
            </View>
          </View>
        );
      case 'table':
      case 'thead':
      case 'tbody':
        return (
          <View key={key} style={node.tag === 'table' ? [styles.table, { borderColor: colors.line }] : null}>
            {node.children.map((c, i) => block(c, i))}
          </View>
        );
      case 'tr':
        return (
          <View key={key} style={[styles.row, { borderBottomColor: colors.line }]}>
            {node.children
              .filter((c) => c.tag === 'td' || c.tag === 'th')
              .map((c, i) => (
                <Text key={i} variant="small" tone="soft" style={[styles.cell, c.tag === 'th' && styles.bold]}>
                  {c.children.map((g, j) => inline(g, j))}
                </Text>
              ))}
          </View>
        );
      default:
        // An inline element (or an unknown one) directly at block level.
        return (
          <Text key={key} tone="soft" style={styles.paragraph}>
            {inline(node, 0)}
          </Text>
        );
    }
  };

  return <View>{tree.children.map((node, i) => block(node, i))}</View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  paragraph: { fontSize: 16, lineHeight: 26, marginBottom: 14 },
  heading: { marginTop: 10, marginBottom: 8 },
  bold: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
  strike: { textDecorationLine: 'line-through' },
  link: { textDecorationLine: 'underline' },
  code: { fontFamily: 'monospace', fontSize: 14 },
  mono: { fontFamily: 'monospace', fontSize: 13.5, lineHeight: 20 },
  pre: { borderRadius: 12, padding: 12, marginBottom: 14 },
  rule: { height: 1, marginVertical: 14 },
  quote: { borderLeftWidth: 3, borderRadius: 8, paddingLeft: 14, paddingRight: 10, paddingTop: 12, marginBottom: 14 },
  list: { marginBottom: 14, gap: 6 },
  item: { flexDirection: 'row', gap: 10 },
  marker: { fontSize: 16, lineHeight: 26, fontWeight: '700', minWidth: 16 },
  listText: { fontSize: 16, lineHeight: 26 },
  table: { borderWidth: StyleSheet.hairlineWidth * 2, borderRadius: 10, marginBottom: 14, overflow: 'hidden' },
  row: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  cell: { flex: 1, padding: 8 },
});
