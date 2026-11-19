import React, { useState } from 'react';
import { SafeAreaView, FlatList, Text, TouchableOpacity, Linking, StyleSheet, View } from 'react-native';

const SAMPLE_DATA = [
  {
    id: '1',
    category: 'edital',
    source: 'Faculdade',
    title: 'Edital PIBIC — Iniciação Científica em Sistemas Embarcados',
    url: 'https://exemplo.edu.br/edital',
  },
  {
    id: '2',
    category: 'hackathon',
    source: 'Devpost',
    title: 'Global AI & Hardware Hackathon 2026',
    url: 'https://devpost.com',
  },
];

export default function App() {
  const [items] = useState(SAMPLE_DATA);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Radar Comp</Text>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => Linking.openURL(item.url)}>
            <View style={styles.badgeRow}>
              <Text style={styles.badge}>{item.category.toUpperCase()}</Text>
              <Text style={styles.source}>{item.source}</Text>
            </View>
            <Text style={styles.title}>{item.title}</Text>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 16 },
  header: { color: '#f8fafc', fontSize: 24, fontWeight: 'bold', marginBottom: 16, marginTop: 8 },
  card: { backgroundColor: '#1e293b', padding: 14, borderRadius: 10, marginBottom: 12 },
  badgeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  badge: { color: '#38bdf8', fontSize: 12, fontWeight: 'bold' },
  source: { color: '#94a3b8', fontSize: 12 },
  title: { color: '#f1f5f9', fontSize: 16, fontWeight: '500' },
});
