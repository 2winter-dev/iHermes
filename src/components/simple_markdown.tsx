import { Linking, Image, ScrollView, StyleSheet, Text, View } from 'react-native';

type MarkdownBlock =
  | { type: 'heading'; level: number; text: string }
  | { type: 'image'; alt: string; src: string }
  | { type: 'table'; rows: string[][] }
  | { type: 'paragraph'; text: string };

type InlineToken =
  | { type: 'text'; text: string }
  | { type: 'link'; text: string; href: string }
  | { type: 'bold'; text: string };

export function SimpleMarkdown({
  content,
  inkColor,
  softInkColor,
}: {
  content: string;
  inkColor: string;
  softInkColor: string;
}) {
  const blocks = parseBlocks(content);

  return (
    <View style={styles.wrap}>
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}`;
        if (block.type === 'heading') {
          return (
            <Text
              key={key}
              style={[
                styles.heading,
                block.level === 1 ? styles.h1 : block.level === 2 ? styles.h2 : styles.h3,
                { color: inkColor },
              ]}
            >
              {block.text}
            </Text>
          );
        }
        if (block.type === 'image') {
          return (
            <View key={key} style={styles.imageWrap}>
              <Image source={{ uri: block.src }} style={styles.image} resizeMode="contain" />
              {block.alt ? <Text style={[styles.imageAlt, { color: softInkColor }]}>{block.alt}</Text> : null}
            </View>
          );
        }
        if (block.type === 'table') {
          const header = block.rows[0] ?? [];
          const body = block.rows.slice(1);
          return (
            <View key={key} style={styles.tableWrap}>
              <ScrollView horizontal showsHorizontalScrollIndicator style={styles.tableScroll}>
                <View style={styles.table}>
                  <View style={styles.tableRow}>
                    {header.map((cell, cellIdx) => (
                      <Text
                        key={`h-${cellIdx}`}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                        style={[styles.tableHeaderCell, { color: inkColor }]}
                      >
                        {cell}
                      </Text>
                    ))}
                  </View>
                  {body.map((row, rowIdx) => (
                    <View key={`r-${rowIdx}`} style={styles.tableRow}>
                      {row.map((cell, cellIdx) => (
                        <Text key={`c-${rowIdx}-${cellIdx}`} style={[styles.tableCell, { color: inkColor }]}>
                          {parseInline(cell).map((token, tokenIdx) => {
                            if (token.type === 'link') {
                              return (
                                <Text
                                  key={`l-${rowIdx}-${cellIdx}-${tokenIdx}`}
                                  style={[styles.link, { color: softInkColor }]}
                                  onPress={() => void Linking.openURL(token.href)}
                                >
                                  {token.text}
                                </Text>
                              );
                            }
                            if (token.type === 'bold') {
                              return (
                                <Text key={`b-${rowIdx}-${cellIdx}-${tokenIdx}`} style={styles.bold}>
                                  {token.text}
                                </Text>
                              );
                            }
                            return <Text key={`t-${rowIdx}-${cellIdx}-${tokenIdx}`}>{token.text}</Text>;
                          })}
                        </Text>
                      ))}
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
          );
        }
        return (
          <Text key={key} style={[styles.paragraph, { color: inkColor }]}>
            {parseInline(block.text).map((token, tokenIdx) => {
              if (token.type === 'link') {
                return (
                  <Text
                    key={`l-${tokenIdx}`}
                    style={[styles.link, { color: softInkColor }]}
                    onPress={() => void Linking.openURL(token.href)}
                  >
                    {token.text}
                  </Text>
                );
              }
              if (token.type === 'bold') {
                return (
                  <Text key={`b-${tokenIdx}`} style={styles.bold}>
                    {token.text}
                  </Text>
                );
              }
              return <Text key={`t-${tokenIdx}`}>{token.text}</Text>;
            })}
          </Text>
        );
      })}
    </View>
  );
}

function parseBlocks(markdown: string): MarkdownBlock[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: MarkdownBlock[] = [];
  let idx = 0;

  while (idx < lines.length) {
    const line = lines[idx].trim();
    if (!line) {
      idx += 1;
      continue;
    }

    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(line);
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        text: headingMatch[2].trim(),
      });
      idx += 1;
      continue;
    }

    const imageMatch = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(line);
    if (imageMatch) {
      blocks.push({ type: 'image', alt: imageMatch[1], src: imageMatch[2] });
      idx += 1;
      continue;
    }

    if (isTableStart(lines, idx)) {
      const rows: string[][] = [];
      while (idx < lines.length && lines[idx].includes('|')) {
        if (/^\|?[\s:-]+\|[\s|:-]*$/.test(lines[idx].trim())) {
          idx += 1;
          continue;
        }
        const row = parseTableRow(lines[idx]);
        if (row.length > 0) {
          rows.push(row);
        }
        idx += 1;
      }
      if (rows.length > 0) {
        blocks.push({ type: 'table', rows });
      }
      continue;
    }

    const paragraph: string[] = [line];
    idx += 1;
    while (idx < lines.length) {
      const next = lines[idx].trim();
      if (!next || /^(#{1,6})\s+/.test(next) || /^!\[([^\]]*)\]\(([^)\s]+)\)$/.test(next) || isTableStart(lines, idx)) {
        break;
      }
      paragraph.push(next);
      idx += 1;
    }
    blocks.push({ type: 'paragraph', text: paragraph.join('\n') });
  }

  return blocks;
}

function isTableStart(lines: string[], start: number): boolean {
  if (start + 1 >= lines.length) return false;
  const header = lines[start];
  const separator = lines[start + 1].trim();
  return header.includes('|') && /^\|?[\s:-]+\|[\s|:-]*$/.test(separator);
}

function parseTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  const regex = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  for (const match of text.matchAll(regex)) {
    const tokenText = match[0] ?? '';
    const idx = match.index ?? 0;
    if (idx > lastIndex) {
      tokens.push({ type: 'text', text: text.slice(lastIndex, idx) });
    }
    const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tokenText);
    if (linkMatch) {
      tokens.push({ type: 'link', text: linkMatch[1], href: linkMatch[2] });
    } else {
      const boldMatch = /^\*\*([^*]+)\*\*$/.exec(tokenText);
      if (boldMatch) {
        tokens.push({ type: 'bold', text: boldMatch[1] });
      } else {
        tokens.push({ type: 'text', text: tokenText });
      }
    }
    lastIndex = idx + tokenText.length;
  }

  if (lastIndex < text.length) {
    tokens.push({ type: 'text', text: text.slice(lastIndex) });
  }
  return tokens;
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  heading: { fontWeight: '800' },
  h1: { fontSize: 22, lineHeight: 28 },
  h2: { fontSize: 19, lineHeight: 25 },
  h3: { fontSize: 17, lineHeight: 22 },
  paragraph: { fontSize: 14, lineHeight: 20 },
  bold: { fontWeight: '800' },
  link: { textDecorationLine: 'underline' },
  imageWrap: { gap: 4 },
  image: { width: '100%', minHeight: 120, maxHeight: 260, borderRadius: 8, backgroundColor: '#00000008' },
  imageAlt: { fontSize: 12, lineHeight: 16 },
  tableWrap: {
    width: '100%',
    maxWidth: '100%',
  },
  tableScroll: {
    maxWidth: '100%',
  },
  table: {
    minWidth: '100%',
    borderWidth: 1,
    borderColor: '#00000022',
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableRow: {
    width: '100%',
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#00000018',
  },
  tableHeaderCell: {
    flex: 1,
    minWidth: 72,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#00000008',
    flexWrap: 'nowrap',
  },
  tableCell: {
    flex: 1,
    minWidth: 72,
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
});
