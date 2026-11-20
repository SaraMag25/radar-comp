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
  { key: 'todos', label: 'Todos' },
  { key: 'bolsas', label: 'Bolsas e Acadêmico' },
  { key: 'congressos', label: 'Congressos e Eventos' },
  { key: 'hackathons', label: 'Hackathons e Competições' },
  { key: 'empresas', label: 'Empresas e Inovação' },
  { key: 'cursos', label: 'Cursos e Capacitações' },
  { key: 'estagios', label: 'Estágios e Carreira' },
];

const CATEGORY_COLORS = {
  bolsas: '#10b981',
  congressos: '#ec4899',
  hackathons: '#a855f7',
  empresas: '#f59e0b',
  cursos: '#06b6d4',
  estagios: '#3b82f6',
};

const SAMPLE_DATA = [
  {
    id: 'sample-1',
    title: 'Edital de Iniciação Científica e Tecnológica (PIBIC/PIBITI)',
    organization: 'Universidades Públicas / CNPq',
    category: 'bolsas',
    summary: 'Bolsas de pesquisa para estudantes de graduação desenvolverem projetos com orientação.',
    url: 'https://www.gov.br/cnpq',
    action_label: 'Ver oportunidade',
    eligibility: {
      summary: 'Estudantes de graduação regularmente matriculados (verifique edital da instituição).',
      any_university: false,
      free: true,
      remuneration: true,
      benefits: 'Bolsa mensal + certificado',
    },
    modality: 'híbrida',
    location: 'Brasil',
    scope: 'brasil',
    area: 'Pesquisa e Tecnologia',
    deadline: null,
    status: 'aberta',
    language: 'pt',
    last_verified_at: null,
  },
];

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
  const [items, setItems] = useState(SAMPLE_DATA);
  const [selectedCategory, setSelectedCategory] = useState('todos');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [offlineMode, setOfflineMode] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  // Filtros avançados
  const [scopeFilter, setScopeFilter] = useState('todos');
  const [modalityFilter, setModalityFilter] = useState('todos');
  const [onlyFree, setOnlyFree] = useState(false);
  const [onlyPaid, setOnlyPaid] = useState(false);
  const [onlyAnyUni, setOnlyAnyUni] = useState(false);
  const [onlyOpen, setOnlyOpen] = useState(false);

  // Traduções sob demanda por ID
  const [translations, setTranslations] = useState({});
  const [translatingId, setTranslatingId] = useState(null);

  const fetchOpportunities = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${DATA_URL}?t=${Date.now()}`);
      if (!response.ok) throw new Error('Dados indisponíveis');
      const data = await response.json();
      const list = Array.isArray(data) ? data : data.items;
      if (Array.isArray(list) && list.length > 0) {
        setItems(list);
      }
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
      const [titlePt, summaryPt, eligPt, benefitsPt] = await Promise.all([
        translateTextToPt(item.title),
        translateTextToPt(item.summary),
        translateTextToPt(item.eligibility?.summary || ''),
        translateTextToPt(item.eligibility?.benefits || ''),
      ]);
      setTranslations((prev) => ({
        ...prev,
        [item.id]: {
          active: true,
          title: titlePt,
          summary: summaryPt,
          eligibility: eligPt,
          benefits: benefitsPt,
        },
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
      if (onlyAnyUni && item.eligibility?.any_university !== true) return false;
      if (onlyOpen && item.status !== 'aberta') return false;

      if (!q) return true;
      return (
        (item.title || '').toLowerCase().includes(q) ||
        (item.summary || '').toLowerCase().includes(q) ||
        (item.organization || '').toLowerCase().includes(q) ||
        (item.location || '').toLowerCase().includes(q) ||
        (item.area || '').toLowerCase().includes(q)
      );
    });
  }, [
    items,
    selectedCategory,
    search,
    scopeFilter,
    modalityFilter,
    onlyFree,
    onlyPaid,
    onlyAnyUni,
    onlyOpen,
  ]);

  const formatDate = (iso) => {
    if (!iso) return 'Não informada';
    try {
      return new Date(iso).toLocaleDateString('pt-BR');
    } catch {
      return iso;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.header}>Radar Comp</Text>
          <Text style={styles.subtitle}>
            {offlineMode
              ? 'Modo demonstração (dados indisponíveis)'
              : `${filteredItems.length} de ${items.length} oportunidades`}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.filterToggleBtn, showFilters && styles.filterToggleBtnActive]}
            onPress={() => setShowFilters((v) => !v)}
          >
            <Text style={styles.filterToggleText}>Filtros</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.collectBtn} onPress={fetchOpportunities} disabled={loading}>
            {loading ? (
              <ActivityIndicator size="small" color="#0f172a" />
            ) : (
              <Text style={styles.collectBtnText}>Atualizar</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <TextInput
        style={styles.searchInput}
        placeholder="Buscar por hackathon, bolsa, empresa, cidade..."
        placeholderTextColor="#64748b"
        value={search}
        onChangeText={setSearch}
      />

      {showFilters ? (
        <View style={styles.filtersBox}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {['todos', 'brasil', 'internacional'].map((val) => (
              <TouchableOpacity
                key={val}
                style={[styles.chip, scopeFilter === val && styles.chipActive]}
                onPress={() => setScopeFilter(val)}
              >
                <Text style={[styles.chipText, scopeFilter === val && styles.chipTextActive]}>
                  {val === 'todos' ? 'Escopo: Todos' : val === 'brasil' ? 'Brasil' : 'Internacional'}
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
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
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
            <TouchableOpacity
              style={[styles.chip, onlyAnyUni && styles.chipActive]}
              onPress={() => setOnlyAnyUni((v) => !v)}
            >
              <Text style={[styles.chipText, onlyAnyUni && styles.chipTextActive]}>
                Qualquer universidade
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.chip, onlyOpen && styles.chipActive]}
              onPress={() => setOnlyOpen((v) => !v)}
            >
              <Text style={[styles.chipText, onlyOpen && styles.chipTextActive]}>Inscrições abertas</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      ) : null}

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
          const tr = translations[item.id];
          const isTranslated = Boolean(tr?.active);
          const displayTitle = isTranslated ? tr.title : item.title;
          const displaySummary = isTranslated ? tr.summary : item.summary;
          const displayElig = isTranslated
            ? tr.eligibility
            : item.eligibility?.summary || 'Elegibilidade não informada — verifique no site oficial.';
          const displayBenefits = isTranslated
            ? tr.benefits
            : item.eligibility?.benefits || 'Não informado';

          return (
            <View style={styles.card}>
              <View style={styles.badgeRow}>
                <Text style={[styles.badge, { color: badgeColor }]}>
                  {(item.category || '').toUpperCase()}
                </Text>
                <Text style={styles.source}>{item.organization || item.source}</Text>
              </View>

              <Text style={styles.title}>{displayTitle}</Text>
              {displaySummary ? <Text style={styles.summary}>{displaySummary}</Text> : null}

              <View style={styles.metaBox}>
                <Text style={styles.metaLine}>
                  <Text style={styles.metaLabel}>Quem pode: </Text>
                  {displayElig}
                </Text>
                <Text style={styles.metaLine}>
                  <Text style={styles.metaLabel}>Benefícios: </Text>
                  {displayBenefits}
                </Text>
                <Text style={styles.metaLine}>
                  <Text style={styles.metaLabel}>Modalidade / Local: </Text>
                  {item.modality || 'não informada'} · {item.location || 'Não informado'}
                </Text>
                {item.deadline ? (
                  <Text style={styles.metaLine}>
                    <Text style={styles.metaLabel}>Prazo: </Text>
                    {item.deadline}
                  </Text>
                ) : null}
                <Text style={styles.verifiedText}>
                  Última verificação: {formatDate(item.last_verified_at || item.collected_at)}
                </Text>
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
                          ? 'Ver original'
                          : 'Traduzir para português'}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View />
                )}

                <TouchableOpacity
                  style={styles.ctaBtn}
                  onPress={() => Linking.openURL(item.url)}
                >
                  <Text style={styles.ctaBtnText}>{item.action_label || 'Ver oportunidade'}</Text>
                </TouchableOpacity>
              </View>
            </View>
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
  headerActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  filterToggleBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  filterToggleBtnActive: { borderColor: '#38bdf8' },
  filterToggleText: { color: '#e2e8f0', fontSize: 13, fontWeight: '600' },
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
    marginBottom: 10,
  },
  filtersBox: { marginBottom: 10, gap: 6 },
  filterRow: { gap: 6, paddingVertical: 2 },
  chip: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  chipActive: { backgroundColor: '#0284c7', borderColor: '#38bdf8' },
  chipText: { color: '#94a3b8', fontSize: 12 },
  chipTextActive: { color: '#f8fafc', fontWeight: '600' },
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
  badgeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6, gap: 8 },
  badge: { fontSize: 11, fontWeight: 'bold' },
  source: { color: '#94a3b8', fontSize: 12, flexShrink: 1, textAlign: 'right' },
  title: { color: '#f1f5f9', fontSize: 15, fontWeight: '700', marginBottom: 4 },
  summary: { color: '#cbd5e1', fontSize: 13, lineHeight: 18, marginBottom: 8 },
  metaBox: {
    backgroundColor: '#0f172a',
    padding: 10,
    borderRadius: 8,
    gap: 3,
    marginBottom: 10,
  },
  metaLine: { color: '#cbd5e1', fontSize: 12, lineHeight: 16 },
  metaLabel: { color: '#94a3b8', fontWeight: '600' },
  verifiedText: { color: '#64748b', fontSize: 11, marginTop: 2 },
  cardActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  translateBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  translateBtnText: { color: '#38bdf8', fontSize: 12, fontWeight: '600' },
  ctaBtn: {
    backgroundColor: '#38bdf8',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  ctaBtnText: { color: '#0f172a', fontSize: 12, fontWeight: 'bold' },
  emptyText: { color: '#64748b', textAlign: 'center', marginTop: 40, fontSize: 14 },
});
