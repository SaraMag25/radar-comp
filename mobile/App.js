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

const DATA_URL =
  'https://raw.githubusercontent.com/SaraMag25/radar-comp/main/backend/data/opportunities.json';

const CATEGORIES = [
  { key: 'todos', label: 'Todas' },
  { key: 'bolsas', label: 'Bolsas' },
  { key: 'editais', label: 'Editais' },
  { key: 'congressos', label: 'Congressos' },
  { key: 'hackathons', label: 'Hackathons' },
  { key: 'competicoes', label: 'Competições' },
  { key: 'empresas', label: 'Programas de empresas' },
  { key: 'estagios', label: 'Estágios' },
  { key: 'capacitacoes', label: 'Capacitações' },
  { key: 'pesquisa', label: 'Pesquisa e extensão' },
];

const CATEGORY_META = {
  bolsas: { label: 'BOLSA', color: '#10b981' },
  editais: { label: 'EDITAL', color: '#f59e0b' },
  congressos: { label: 'CONGRESSO', color: '#ec4899' },
  hackathons: { label: 'HACKATHON', color: '#a855f7' },
  competicoes: { label: 'COMPETIÇÃO', color: '#fb7185' },
  empresas: { label: 'EMPRESAS', color: '#f97316' },
  estagios: { label: 'ESTÁGIO', color: '#3b82f6' },
  capacitacoes: { label: 'CAPACITAÇÃO', color: '#06b6d4' },
  pesquisa: { label: 'PESQUISA', color: '#22c55e' },
};

async function translateTextToPt(text) {
  if (!text) return '';
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=pt&dt=t&q=${encodeURIComponent(
    text
  )}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Falha na tradução');
  const data = await res.json();
  return Array.isArray(data?.[0]) ? data[0].map((part) => part[0]).join('') : text;
}

export default function App() {
  const [items, setItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('todos');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const [scopeFilter, setScopeFilter] = useState('todos');
  const [modalityFilter, setModalityFilter] = useState('todos');
  const [onlyFree, setOnlyFree] = useState(false);
  const [onlyPaid, setOnlyPaid] = useState(false);

  const [translations, setTranslations] = useState({});
  const [translatingId, setTranslatingId] = useState(null);

  const fetchOpportunities = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${DATA_URL}?t=${Date.now()}`);
      if (!response.ok) throw new Error('Dados indisponíveis');
      const data = await response.json();
      const list = Array.isArray(data) ? data : data.items;
      setItems(Array.isArray(list) ? list : []);
      setOfflineMode(false);
    } catch {
      setOfflineMode(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOpportunities();
  }, []);

  const handleToggleTranslate = async (item) => {
    const existing = translations[item.id];
    if (existing) {
      setTranslations((prev) => ({
        ...prev,
        [item.id]: { ...existing, active: !existing.active },
      }));
      return;
    }

    setTranslatingId(item.id);
    try {
      const [titlePt, summaryPt] = await Promise.all([
        translateTextToPt(item.title),
        translateTextToPt(item.summary),
      ]);
      setTranslations((prev) => ({
        ...prev,
        [item.id]: { active: true, title: titlePt, summary: summaryPt },
      }));
    } catch {
      // mantém original se falhar
    } finally {
      setTranslatingId(null);
    }
  };

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (selectedCategory !== 'todos' && item.category !== selectedCategory) return false;
      if (scopeFilter !== 'todos' && item.scope !== scopeFilter) return false;
      if (modalityFilter !== 'todos' && item.modality !== modalityFilter) return false;
      if (onlyFree && item.eligibility?.free !== true) return false;
      if (onlyPaid && item.eligibility?.remuneration !== true) return false;

      if (!q) return true;
      return (
        (item.title || '').toLowerCase().includes(q) ||
        (item.summary || '').toLowerCase().includes(q) ||
        (item.organization || '').toLowerCase().includes(q) ||
        (item.location || '').toLowerCase().includes(q)
      );
    });
  }, [items, selectedCategory, search, scopeFilter, modalityFilter, onlyFree, onlyPaid]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.pageWrapper}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Radar Comp</Text>
            <Text style={styles.headerCount}>
              {offlineMode
                ? 'Sem conexão com os dados'
                : `${filteredItems.length} oportunidade${filteredItems.length === 1 ? '' : 's'}`}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.iconBtn, showFilters && styles.iconBtnActive]}
              onPress={() => setShowFilters((v) => !v)}
            >
              <Text style={styles.iconBtnText}>Filtros</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.refreshBtn}
              onPress={fetchOpportunities}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#0f172a" />
              ) : (
                <Text style={styles.refreshBtnText}>Atualizar</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por bolsa, hackathon, empresa, cidade..."
          placeholderTextColor="#64748b"
          value={search}
          onChangeText={setSearch}
        />

        {showFilters ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filtersScroll}
            contentContainerStyle={styles.filtersContent}
          >
            {['todos', 'brasil', 'internacional'].map((val) => (
              <TouchableOpacity
                key={val}
                style={[styles.chip, scopeFilter === val && styles.chipActive]}
                onPress={() => setScopeFilter(val)}
              >
                <Text style={[styles.chipText, scopeFilter === val && styles.chipTextActive]}>
                  {val === 'todos' ? 'Todos os locais' : val === 'brasil' ? 'Brasil' : 'Internacional'}
                </Text>
              </TouchableOpacity>
            ))}
            {['online', 'presencial', 'híbrida'].map((mod) => (
              <TouchableOpacity
                key={mod}
                style={[styles.chip, modalityFilter === mod && styles.chipActive]}
                onPress={() => setModalityFilter(modalityFilter === mod ? 'todos' : mod)}
              >
                <Text style={[styles.chipText, modalityFilter === mod && styles.chipTextActive]}>
                  {mod}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.chip, onlyFree && styles.chipActive]}
              onPress={() => setOnlyFree((v) => !v)}
            >
              <Text style={[styles.chipText, onlyFree && styles.chipTextActive]}>Gratuito</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.chip, onlyPaid && styles.chipActive]}
              onPress={() => setOnlyPaid((v) => !v)}
            >
              <Text style={[styles.chipText, onlyPaid && styles.chipTextActive]}>Com bolsa/prêmio</Text>
            </TouchableOpacity>
          </ScrollView>
        ) : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsScroll}
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
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={fetchOpportunities} tintColor="#38bdf8" />
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {loading
                ? 'Carregando oportunidades...'
                : 'Nenhuma oportunidade encontrada para essa categoria ou filtro.'}
            </Text>
          }
          renderItem={({ item }) => {
            const meta = CATEGORY_META[item.category] || {
              label: (item.category || 'OPORTUNIDADE').toUpperCase(),
              color: '#38bdf8',
            };
            const tr = translations[item.id];
            const isTranslated = Boolean(tr?.active);

            return (
              <View style={styles.card}>
                <View style={styles.cardTopRow}>
                  <View style={[styles.badgePill, { backgroundColor: `${meta.color}22` }]}>
                    <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                  <Text style={styles.orgText} numberOfLines={1}>
                    {item.organization || item.source}
                  </Text>
                </View>

                <Text style={styles.cardTitle} numberOfLines={2}>
                  {isTranslated ? tr.title : item.title}
                </Text>

                <Text style={styles.cardSummary} numberOfLines={2}>
                  {isTranslated ? tr.summary : item.summary}
                </Text>

                <View style={styles.cardBottomRow}>
                  <View style={styles.tagsRow}>
                    <Text style={styles.metaPill}>
                      {item.modality || 'online'} · {item.location || 'Não informado'}
                    </Text>
                    {item.deadline ? (
                      <Text style={styles.deadlinePill}>Prazo: {item.deadline}</Text>
                    ) : null}
                  </View>

                  <View style={styles.actionsRow}>
                    {item.language && item.language !== 'pt' ? (
                      <TouchableOpacity
                        style={styles.translateBtn}
                        onPress={() => handleToggleTranslate(item)}
                        disabled={translatingId === item.id}
                      >
                        <Text style={styles.translateBtnText}>
                          {translatingId === item.id
                            ? '...'
                            : isTranslated
                              ? 'Original'
                              : 'Traduzir'}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity
                      style={styles.ctaBtn}
                      onPress={() => Linking.openURL(item.url)}
                    >
                      <Text style={styles.ctaBtnText}>{item.action_label || 'Ver'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0b1120' },
  pageWrapper: {
    flex: 1,
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: { color: '#f8fafc', fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  headerCount: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  iconBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  iconBtnActive: { borderColor: '#38bdf8' },
  iconBtnText: { color: '#e2e8f0', fontSize: 12, fontWeight: '600' },
  refreshBtn: {
    backgroundColor: '#38bdf8',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    minWidth: 76,
    alignItems: 'center',
  },
  refreshBtnText: { color: '#0f172a', fontWeight: '700', fontSize: 12 },
  searchInput: {
    backgroundColor: '#151f32',
    color: '#f8fafc',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 10,
  },
  filtersScroll: { maxHeight: 36, marginBottom: 10 },
  filtersContent: { gap: 8, alignItems: 'center' },
  chip: {
    backgroundColor: '#151f32',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  chipActive: { backgroundColor: '#0284c7', borderColor: '#38bdf8' },
  chipText: { color: '#94a3b8', fontSize: 12 },
  chipTextActive: { color: '#f8fafc', fontWeight: '600' },
  tabsScroll: { maxHeight: 40, marginBottom: 12 },
  tabsContent: { gap: 8, alignItems: 'center', paddingRight: 16 },
  tab: {
    backgroundColor: '#151f32',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  tabActive: { backgroundColor: '#38bdf8', borderColor: '#38bdf8' },
  tabText: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#0f172a' },
  listContent: { paddingBottom: 24 },
  card: {
    backgroundColor: '#151f32',
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    gap: 10,
  },
  badgePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  orgText: { color: '#94a3b8', fontSize: 12, flexShrink: 1, textAlign: 'right' },
  cardTitle: { color: '#f8fafc', fontSize: 15, fontWeight: '700', lineHeight: 20, marginBottom: 4 },
  cardSummary: { color: '#cbd5e1', fontSize: 13, lineHeight: 18, marginBottom: 10 },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1 },
  metaPill: { color: '#94a3b8', fontSize: 11 },
  deadlinePill: {
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: '600',
  },
  actionsRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  translateBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  translateBtnText: { color: '#38bdf8', fontSize: 11, fontWeight: '600' },
  ctaBtn: {
    backgroundColor: '#38bdf8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  ctaBtnText: { color: '#0f172a', fontSize: 12, fontWeight: '700' },
  emptyText: { color: '#64748b', textAlign: 'center', marginTop: 40, fontSize: 14 },
});
