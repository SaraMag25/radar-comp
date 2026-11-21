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
  useWindowDimensions,
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
  { key: 'pesquisa', label: 'Pesquisa' },
  { key: 'estagios', label: 'Estágios' },
  { key: 'capacitacoes', label: 'Capacitações' },
];

const CATEGORY_META = {
  bolsas: { label: 'Bolsas', color: '#047857', bg: '#ecfdf5' },
  editais: { label: 'Editais', color: '#b45309', bg: '#fffbeb' },
  congressos: { label: 'Congressos', color: '#be185d', bg: '#fdf2f8' },
  hackathons: { label: 'Hackathons', color: '#6d28d9', bg: '#f5f3ff' },
  competicoes: { label: 'Competições', color: '#be123c', bg: '#fff1f2' },
  empresas: { label: 'Empresas', color: '#c2410c', bg: '#fff7ed' },
  pesquisa: { label: 'Pesquisa', color: '#15803d', bg: '#f0fdf4' },
  estagios: { label: 'Estágios', color: '#1d4ed8', bg: '#eff6ff' },
  capacitacoes: { label: 'Capacitações', color: '#0e7490', bg: '#ecfeff' },
};

const STATUS_META = {
  OPEN: { label: 'Inscrições abertas', color: '#15803d', bg: '#dcfce7' },
  UPCOMING: { label: 'Em breve', color: '#1d4ed8', bg: '#dbeafe' },
  CLOSED: { label: 'Encerrada', color: '#64748b', bg: '#f1f5f9' },
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
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

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
        (item.area || '').toLowerCase().includes(q) ||
        (item.location || '').toLowerCase().includes(q)
      );
    });
  }, [items, selectedCategory, search, scopeFilter, modalityFilter, onlyFree, onlyPaid]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerBar}>
        <View style={[styles.headerInner, isWide && styles.containerWide]}>
          <View style={styles.brandRow}>
            <View style={styles.logoDot} />
            <View>
              <Text style={styles.brandTitle}>Radar Comp</Text>
              <Text style={styles.brandSubtitle}>
                {offlineMode
                  ? 'Sem conexão com os dados'
                  : `${filteredItems.length} oportunidade${filteredItems.length === 1 ? '' : 's'} disponíve${filteredItems.length === 1 ? 'l' : 'is'}`}
              </Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.secondaryBtn, showFilters && styles.secondaryBtnActive]}
              onPress={() => setShowFilters((v) => !v)}
            >
              <Text style={[styles.secondaryBtnText, showFilters && styles.secondaryBtnTextActive]}>
                Filtros
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={fetchOpportunities}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.primaryBtnText}>Atualizar</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={[styles.mainContainer, isWide && styles.containerWide]}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por oportunidade, empresa, universidade, área ou cidade..."
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={setSearch}
        />

        {showFilters ? (
          <View style={styles.filtersPanel}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
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
                    {mod.charAt(0).toUpperCase() + mod.slice(1)}
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
          </View>
        ) : null}

        {isWide ? (
          <View style={styles.tabsWrap}>
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
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tabsScroll}
            contentContainerStyle={styles.tabsScrollContent}
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
        )}

        <FlatList
          key={isWide ? 'grid-2' : 'list-1'}
          data={filteredItems}
          numColumns={isWide ? 2 : 1}
          columnWrapperStyle={isWide ? styles.gridRow : undefined}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={fetchOpportunities} tintColor="#2563eb" />
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>Nenhuma oportunidade encontrada</Text>
              <Text style={styles.emptySubtitle}>
                {loading
                  ? 'Buscando oportunidades...'
                  : 'Tente alterar a categoria, os filtros ou o termo de busca.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const catMeta = CATEGORY_META[item.category] || {
              label: item.category || 'Oportunidade',
              color: '#1d4ed8',
              bg: '#eff6ff',
            };
            const stMeta = STATUS_META[item.status] || STATUS_META.OPEN;
            const tr = translations[item.id];
            const isTranslated = Boolean(tr?.active);
            const displayTitle = isTranslated ? tr.title : item.title;
            const displaySummary = isTranslated ? tr.summary : item.summary;

            return (
              <View style={[styles.card, isWide && styles.cardGrid]}>
                <View style={styles.cardHeader}>
                  <View style={[styles.catBadge, { backgroundColor: catMeta.bg }]}>
                    <Text style={[styles.catBadgeText, { color: catMeta.color }]}>
                      {catMeta.label}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: stMeta.bg }]}>
                    <Text style={[styles.statusBadgeText, { color: stMeta.color }]}>
                      {stMeta.label}
                    </Text>
                  </View>
                </View>

                <Text style={styles.orgText} numberOfLines={1}>
                  {item.organization || item.source}
                </Text>

                <Text style={styles.cardTitle} numberOfLines={2}>
                  {displayTitle}
                </Text>

                {displaySummary ? (
                  <Text style={styles.cardSummary} numberOfLines={3}>
                    {displaySummary}
                  </Text>
                ) : null}

                <View style={styles.cardFooter}>
                  <View style={styles.metaGroup}>
                    <Text style={styles.metaText}>
                      {item.modality && item.modality !== 'não informada'
                        ? `${item.modality} · `
                        : ''}
                      {item.location || 'Local não informado'}
                    </Text>
                    {item.deadline ? (
                      <Text style={styles.deadlineText}>Prazo: {item.deadline}</Text>
                    ) : null}
                  </View>

                  <View style={styles.cardActions}>
                    {item.language && item.language !== 'pt' ? (
                      <TouchableOpacity
                        style={styles.translateBtn}
                        onPress={() => handleToggleTranslate(item)}
                        disabled={translatingId === item.id}
                      >
                        <Text style={styles.translateBtnText}>
                          {translatingId === item.id
                            ? 'Traduzindo...'
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
                      <Text style={styles.ctaBtnText}>
                        {item.action_label || 'Ver oportunidade'}
                      </Text>
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
  safeArea: { flex: 1, backgroundColor: '#f8fafc' },
  headerBar: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  headerInner: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    alignSelf: 'center',
  },
  containerWide: { maxWidth: 1120 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2563eb',
  },
  brandTitle: { color: '#0f172a', fontSize: 20, fontWeight: '700' },
  brandSubtitle: { color: '#64748b', fontSize: 12, marginTop: 1 },
  headerActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  secondaryBtn: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  secondaryBtnActive: { backgroundColor: '#dbeafe' },
  secondaryBtnText: { color: '#334155', fontSize: 13, fontWeight: '600' },
  secondaryBtnTextActive: { color: '#1d4ed8' },
  primaryBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 84,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '600' },
  mainContainer: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  searchInput: {
    backgroundColor: '#ffffff',
    color: '#0f172a',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  filtersPanel: { marginBottom: 12 },
  filtersRow: { gap: 8, paddingVertical: 2 },
  chip: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chipActive: { backgroundColor: '#eff6ff', borderColor: '#2563eb' },
  chipText: { color: '#475569', fontSize: 12, fontWeight: '500' },
  chipTextActive: { color: '#1d4ed8', fontWeight: '600' },
  tabsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  tabsScroll: { maxHeight: 42, marginBottom: 14 },
  tabsScrollContent: { gap: 8, alignItems: 'center', paddingRight: 16 },
  tab: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tabActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  tabText: { color: '#475569', fontSize: 13, fontWeight: '500' },
  tabTextActive: { color: '#ffffff', fontWeight: '600' },
  listContent: { paddingBottom: 32 },
  gridRow: { gap: 14 },
  card: {
    backgroundColor: '#ffffff',
    padding: 18,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardGrid: { flex: 1 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  catBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  catBadgeText: { fontSize: 11, fontWeight: '700' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusBadgeText: { fontSize: 11, fontWeight: '600' },
  orgText: { color: '#64748b', fontSize: 12, fontWeight: '500', marginBottom: 4 },
  cardTitle: { color: '#0f172a', fontSize: 16, fontWeight: '700', lineHeight: 22, marginBottom: 6 },
  cardSummary: { color: '#475569', fontSize: 13, lineHeight: 19, marginBottom: 14 },
  cardFooter: {
    marginTop: 'auto',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  metaGroup: { flex: 1, gap: 2 },
  metaText: { color: '#64748b', fontSize: 12 },
  deadlineText: { color: '#b45309', fontSize: 12, fontWeight: '600' },
  cardActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  translateBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  translateBtnText: { color: '#334155', fontSize: 12, fontWeight: '600' },
  ctaBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  ctaBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '600' },
  emptyBox: { alignItems: 'center', marginTop: 48, paddingHorizontal: 16 },
  emptyTitle: { color: '#0f172a', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  emptySubtitle: { color: '#64748b', fontSize: 13, textAlign: 'center' },
});
