import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

// Altere para o IP da sua máquina na rede local ao testar no celular físico (ex: http://192.168.1.10:8000)
const API_URL = 'http://localhost:8000';

const CATEGORIES = [
  { key: 'todos', label: 'Todos' },
  { key: 'edital', label: 'Editais' },
  { key: 'bolsa', label: 'Bolsas' },
  { key: 'hackathon', label: 'Hackathons' },
  { key: 'vaga', label: 'Vagas' },
  { key: 'artigo', label: 'Artigos' },
];

const CATEGORY_COLORS = {
  edital: '#f59e0b',
  bolsa: '#10b981',
  hackathon: '#a855f7',
  vaga: '#3b82f6',
  artigo: '#38bdf8',
};

const SAMPLE_DATA = [
  {
    id: '1',
    category: 'edital',
    source: 'Faculdade',
    title: 'Edital PIBIC — Iniciação Científica em IA e Sistemas Embarcados',
    summary: 'Inscrições abertas para bolsas de pesquisa em computação, IA e hardware.',
    url: 'https://exemplo.edu.br/edital',
  },
  {
    id: '2',
    category: 'hackathon',
    source: 'Devpost',
    title: 'Global AI & Software Hackathon 2026',
    summary: 'Construa projetos com LLMs, Python ou React e concorra a prêmios.',
    url: 'https://devpost.com',
  },
  {
    id: '3',
    category: 'vaga',
    source: 'Tech Jobs',
    title: 'Estágio em Desenvolvimento Full Stack & IA (Remoto)',
    summary: 'Oportunidade para estudantes de computação com interesse em Python e React.',
    url: 'https://remoteok.com',
  },
  {
    id: '4',
    category: 'artigo',
    source: 'arXiv CS.AI',
    title: 'Efficient On-Device Inference for Large Language Models',
    summary: 'Técnicas de quantização e otimização para rodar modelos de IA localmente.',
    url: 'https://arxiv.org',
  },
];

export default function App() {
  const [items, setItems] = useState(SAMPLE_DATA);
  const [selectedCategory, setSelectedCategory] = useState('todos');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [offlineMode, setOfflineMode] = useState(true);

  const fetchOpportunities = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/opportunities`);
      if (!response.ok) throw new Error('API indisponível');
      const data = await response.json();
      if (Array.isArray(data.items) && data.items.length > 0) {
        setItems(data.items);
      }
      setOfflineMode(false);
    } catch {
      setOfflineMode(true);
    } finally {
      setLoading(false);
    }
  };

  const triggerCollect = async () => {
    setLoading(true);
    try {
      await fetch(`${API_URL}/collect`, { method: 'POST' });
      await fetchOpportunities();
    } catch {
      setOfflineMode(true);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOpportunities();
  }, []);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesCategory =
        selectedCategory === 'todos' || item.category === selectedCategory;
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        item.title.toLowerCase().includes(q) ||
        (item.summary && item.summary.toLowerCase().includes(q)) ||
        item.source.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [items, selectedCategory, search]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.header}>Radar Comp</Text>
          <Text style={styles.subtitle}>
            {offlineMode ? 'Modo demonstração (API offline)' : `${items.length} oportunidades`}
          </Text>
        </View>
        <TouchableOpacity style={styles.collectBtn} onPress={triggerCollect} disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color="#0f172a" />
          ) : (
            <Text style={styles.collectBtnText}>Coletar</Text>
          )}
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.searchInput}
        placeholder="Buscar por IA, Python, bolsa, estágio..."
        placeholderTextColor="#64748b"
        value={search}
        onChangeText={setSearch}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsContainer}
        contentContainerStyle={styles.tabsContent}
      >
        {CATEGORIES.map((cat) => {
          const active = selectedCategory === cat.key;
          return (
            <TouchableOpacity
              key={cat.key}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setSelectedCategory(cat.key)}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{cat.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchOpportunities} tintColor="#38bdf8" />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>Nenhuma oportunidade encontrada para esse filtro.</Text>
        }
        renderItem={({ item }) => {
          const badgeColor = CATEGORY_COLORS[item.category] || '#38bdf8';
          return (
            <TouchableOpacity style={styles.card} onPress={() => Linking.openURL(item.url)}>
              <View style={styles.badgeRow}>
                <Text style={[styles.badge, { color: badgeColor }]}>
                  {item.category.toUpperCase()}
                </Text>
                <Text style={styles.source}>{item.source}</Text>
              </View>
              <Text style={styles.title}>{item.title}</Text>
              {item.summary ? <Text style={styles.summary}>{item.summary}</Text> : null}
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', paddingHorizontal: 16, paddingTop: 12 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 4,
  },
  header: { color: '#f8fafc', fontSize: 24, fontWeight: 'bold' },
  subtitle: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  collectBtn: {
    backgroundColor: '#38bdf8',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 74,
    alignItems: 'center',
  },
  collectBtnText: { color: '#0f172a', fontWeight: 'bold', fontSize: 13 },
  searchInput: {
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    fontSize: 14,
    marginBottom: 12,
  },
  tabsContainer: { maxHeight: 42, marginBottom: 12 },
  tabsContent: { gap: 8, alignItems: 'center' },
  tab: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  tabActive: { backgroundColor: '#38bdf8' },
  tabText: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#0f172a' },
  card: { backgroundColor: '#1e293b', padding: 14, borderRadius: 12, marginBottom: 12 },
  badgeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  badge: { fontSize: 11, fontWeight: 'bold' },
  source: { color: '#94a3b8', fontSize: 12 },
  title: { color: '#f1f5f9', fontSize: 15, fontWeight: '600', marginBottom: 4 },
  summary: { color: '#cbd5e1', fontSize: 13, lineHeight: 18 },
  emptyText: { color: '#64748b', textAlign: 'center', marginTop: 40, fontSize: 14 },
});
