import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  BookOpen, 
  Grid3X3, 
  ShoppingBag, 
  Flame, 
  Check, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles,
  Calendar,
  Zap,
  ArrowUpDown,
  Store,
  Building2,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Globe,
  Phone,
  ChevronDown,
  X,
  Info,
  QrCode
} from 'lucide-react';
import { PromotionItem, Category, Encarte, SupermarketDetails } from '../types';
import { extractDirectImageUrl, getCategoryFallbackImage } from '../utils/image';
import { QRCodeModal } from './QRCodeModal';

interface DigitalEncarteViewerProps {
  promotions: PromotionItem[];
  encartes: Encarte[];
  supermarkets?: SupermarketDetails[];
  onAddToCart: (item: PromotionItem) => void;
  cartQuantities: Record<string, number>;
  selectedSupermarketId?: string | 'all';
  onSelectSupermarket?: (id: string | 'all') => void;
  isStoreLocked?: boolean;
}

export const DigitalEncarteViewer: React.FC<DigitalEncarteViewerProps> = ({
  promotions,
  encartes,
  supermarkets = [],
  onAddToCart,
  cartQuantities,
  selectedSupermarketId: propSelectedSupermarketId,
  onSelectSupermarket,
  isStoreLocked = false
}) => {
  const [internalSupermarketId, setInternalSupermarketId] = useState<string | 'all'>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const storeParam = params.get('store') || params.get('supermarket') || params.get('tenant') || params.get('id') || params.get('loja') || params.get('teste');
      if (storeParam) return storeParam;
    } catch (e) {}
    return 'all';
  });

  const selectedSupermarketId = propSelectedSupermarketId !== undefined ? propSelectedSupermarketId : internalSupermarketId;
  const setSelectedSupermarketId = (id: string | 'all') => {
    setInternalSupermarketId(id);
    if (onSelectSupermarket) {
      onSelectSupermarket(id);
    }
  };
  const [isSupermarketMenuOpen, setIsSupermarketMenuOpen] = useState(false);
  const [offlineNoticeStore, setOfflineNoticeStore] = useState<{ isOpen: boolean; storeName: string } | null>(null);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState<Category | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'booklet'>('grid');
  const [activePage, setActivePage] = useState(1);
  const [sortBy, setSortBy] = useState<'discount' | 'price-asc' | 'price-desc' | 'name'>('discount');
  const [addedAnimationIds, setAddedAnimationIds] = useState<Record<string, boolean>>({});

  // Filter out inactive accounts
  const filteredSupermarkets = useMemo(() => {
    return (supermarkets || []).filter((m) => {
      return !m.bloqueado && m.statusInquilino !== 'Bloqueado';
    });
  }, [supermarkets]);

  // Selected supermarket object
  const selectedSupermarket = useMemo(() => {
    if (selectedSupermarketId === 'all') return null;
    return (supermarkets || []).find(
      (m) => m.uid === selectedSupermarketId || m.supermercadoId === selectedSupermarketId
    );
  }, [selectedSupermarketId, supermarkets]);

  const categoriesList: { id: Category | 'all'; label: string; icon: string }[] = [
    { id: 'all', label: 'Todas as Ofertas', icon: '🛒' },
    { id: 'hortifruti', label: 'Hortifruti', icon: '🥬' },
    { id: 'acougue', label: 'Açougue & Peixaria', icon: '🥩' },
    { id: 'padaria', label: 'Padaria & Frios', icon: '🍞' },
    { id: 'bebidas', label: 'Bebidas Geladas', icon: '🍺' },
    { id: 'mercearia', label: 'Mercearia', icon: '🫒' },
    { id: 'limpeza', label: 'Limpeza & Casa', icon: '🧹' }
  ];

  const filteredPromotions = useMemo(() => {
    const uniquePromos = Array.from(new Map<string, PromotionItem>(promotions.map((p) => [p.id, p])).values());
    return uniquePromos.filter((promo) => {
      const matchesSupermarket =
        selectedSupermarketId === 'all'
          ? true
          : (promo.supermarketId === selectedSupermarketId ||
             (selectedSupermarket && (
               promo.supermarketId === selectedSupermarket.uid ||
               promo.supermarketId === selectedSupermarket.supermercadoId
             )));
      const matchesCategory = selectedCategory === 'all' || promo.category === selectedCategory;
      const matchesSearch =
        promo.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        promo.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSupermarket && matchesCategory && matchesSearch;
    }).sort((a, b) => {
      if (sortBy === 'discount') {
        const discountA = (a.originalPrice - a.promoPrice) / a.originalPrice;
        const discountB = (b.originalPrice - b.promoPrice) / b.originalPrice;
        return discountB - discountA;
      }
      if (sortBy === 'price-asc') return a.promoPrice - b.promoPrice;
      if (sortBy === 'price-desc') return b.promoPrice - a.promoPrice;
      return a.title.localeCompare(b.title);
    });
  }, [promotions, selectedSupermarketId, selectedSupermarket, selectedCategory, searchQuery, sortBy]);

  // Page split for booklet view
  const pageSize = 4;
  const totalBookletPages = Math.max(1, Math.ceil(filteredPromotions.length / pageSize));
  const currentPageItems = filteredPromotions.slice((activePage - 1) * pageSize, activePage * pageSize);

  const handleAdd = (item: PromotionItem) => {
    // Check if the store accepts online purchases
    const itemStore = filteredSupermarkets.find(
      (m) => m.uid === item.supermarketId || m.supermercadoId === item.supermarketId
    ) || selectedSupermarket;

    if (itemStore && itemStore.aceitaCompraOnline === false) {
      setOfflineNoticeStore({
        isOpen: true,
        storeName: itemStore.nomeFantasia || itemStore.razaoSocial || 'Supermercado'
      });
      return;
    }

    onAddToCart(item);
    setAddedAnimationIds((prev) => ({ ...prev, [item.id]: true }));
    setTimeout(() => {
      setAddedAnimationIds((prev) => ({ ...prev, [item.id]: false }));
    }, 1200);
  };

  const currentEncarte = useMemo(() => {
    if (selectedSupermarketId !== 'all') {
      const found = (encartes || []).find(
        (e) => e.supermarketId === selectedSupermarketId ||
               e.id === `encarte-${selectedSupermarketId}` ||
               (selectedSupermarket && (
                 e.supermarketId === selectedSupermarket.uid ||
                 e.supermarketId === selectedSupermarket.supermercadoId
               ))
      );
      if (found) {
        return {
          ...found,
          items: filteredPromotions,
          pagesCount: Math.ceil(Math.max(1, filteredPromotions.length) / 4)
        };
      }
      if (selectedSupermarket) {
        return {
          id: `encarte-${selectedSupermarket.uid || selectedSupermarket.supermercadoId || selectedSupermarketId}`,
          title: `Encarte de Ofertas • ${selectedSupermarket.nomeFantasia}`,
          subtitle: `Ofertas exclusivas de ${selectedSupermarket.nomeFantasia} • ${selectedSupermarket.cidade || ''}`,
          startDate: new Date().toLocaleDateString('pt-BR'),
          endDate: new Date(Date.now() + 7 * 86400000).toLocaleDateString('pt-BR'),
          coverImage: selectedSupermarket.logoUrl || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80',
          active: true,
          items: filteredPromotions,
          pagesCount: Math.ceil(Math.max(1, filteredPromotions.length) / 4),
          supermarketId: selectedSupermarket.uid || selectedSupermarket.supermercadoId || selectedSupermarketId,
          supermarketName: selectedSupermarket.nomeFantasia
        };
      }
      return undefined;
    }
    return encartes[0];
  }, [selectedSupermarketId, encartes, selectedSupermarket, filteredPromotions]);

  return (
    <div className="space-y-6 my-8">
      
      {/* Supermarket Selection Header Bar (Menu Dropdown Trigger) */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-600 to-blue-500 flex items-center justify-center text-white shadow-lg shadow-sky-500/20 shrink-0">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
              Rede de Supermercados
            </span>
            <div className="flex items-center space-x-2">
              <h3 className="text-base font-black text-white">
                {selectedSupermarket ? selectedSupermarket.nomeFantasia : 'Todas as Lojas & Encartes'}
              </h3>
              {selectedSupermarket && (
                <span className="text-xs text-sky-400 bg-sky-500/10 border border-sky-500/30 px-2 py-0.5 rounded-full font-bold">
                  Ativo
                </span>
              )}
            </div>
          </div>
        </div>

        {isStoreLocked ? (
          <div className="flex items-center space-x-2 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-bold text-xs px-4 py-2.5 rounded-2xl shadow-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Loja Vinculada ao seu Cadastro</span>
          </div>
        ) : (
          <button
            onClick={() => setIsSupermarketMenuOpen(true)}
            className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-extrabold text-xs px-5 py-3 rounded-2xl shadow-lg shadow-sky-500/20 transition-all cursor-pointer active:scale-95"
          >
            <Building2 className="w-4 h-4" />
            <span>{selectedSupermarket ? 'Trocar Supermercado' : 'Selecionar Supermercado'}</span>
            <ChevronDown className="w-4 h-4 ml-1" />
          </button>
        )}
      </div>

      {/* DEDICATED STORE VIEW HEADER (When a specific supermarket is selected) */}
      {selectedSupermarket && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border-2 border-sky-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden space-y-6"
        >
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-sky-500 via-emerald-400 to-blue-600" />

          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            {/* Store Brand & Primary Info */}
            <div className="flex items-start space-x-4">
              {selectedSupermarket.logoUrl ? (
                <img
                  src={selectedSupermarket.logoUrl}
                  alt={selectedSupermarket.nomeFantasia}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-contain bg-slate-900 border-2 border-slate-700 p-2 shadow-xl shrink-0"
                />
              ) : (
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-amber-400 shadow-xl shrink-0">
                  <Building2 className="w-10 h-10" />
                </div>
              )}

              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center space-x-2 flex-wrap gap-1">
                  <span className="bg-sky-500/20 text-sky-300 border border-sky-500/30 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full">
                    Página do Estabelecimento
                  </span>
                  {selectedSupermarket.aceitaCompraOnline ? (
                    <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Aceita Compra Online
                    </span>
                  ) : (
                    <span className="bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center">
                      <AlertCircle className="w-3 h-3 mr-1" /> Não Aceita Compra Online
                    </span>
                  )}
                </div>

                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
                  {selectedSupermarket.nomeFantasia}
                </h2>

                {selectedSupermarket.razaoSocial && (
                  <p className="text-xs text-slate-300 font-medium">
                    Razão Social: <span className="text-white font-bold">{selectedSupermarket.razaoSocial}</span>
                  </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-slate-300 pt-2 border-t border-slate-800/80">
                  {selectedSupermarket.cnpj && (
                    <p className="flex items-center">
                      <span className="font-bold text-slate-400 mr-1.5">CNPJ:</span> {selectedSupermarket.cnpj}
                    </p>
                  )}
                  {selectedSupermarket.inscricaoEstadual && (
                    <p className="flex items-center">
                      <span className="font-bold text-slate-400 mr-1.5">Inscr. Estadual:</span> {selectedSupermarket.inscricaoEstadual}
                    </p>
                  )}
                  {selectedSupermarket.inscricaoMunicipal && (
                    <p className="flex items-center">
                      <span className="font-bold text-slate-400 mr-1.5">Inscr. Municipal:</span> {selectedSupermarket.inscricaoMunicipal}
                    </p>
                  )}
                  {(selectedSupermarket.address || selectedSupermarket.cidade) && (
                    <p className="flex items-center col-span-1 sm:col-span-2">
                      <MapPin className="w-3.5 h-3.5 mr-1.5 text-sky-400 shrink-0" />
                      {[selectedSupermarket.address, selectedSupermarket.bairro, selectedSupermarket.cidade, selectedSupermarket.estado, selectedSupermarket.cep].filter(Boolean).join(' - ')}
                    </p>
                  )}
                  {selectedSupermarket.phone && (
                    <p className="flex items-center">
                      <Phone className="w-3.5 h-3.5 mr-1.5 text-emerald-400 shrink-0" />
                      {selectedSupermarket.phone}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-col sm:flex-row md:flex-col gap-2.5 w-full md:w-auto shrink-0">
              <button
                type="button"
                onClick={() => setIsQrModalOpen(true)}
                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/20 active:scale-95"
                title="Ver link oficial e baixar QR Code deste supermercado"
              >
                <QrCode className="w-4 h-4" />
                <span>QR Code & Link</span>
              </button>
              {!isStoreLocked && (
                <>
                  <button
                    onClick={() => setIsSupermarketMenuOpen(true)}
                    className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all flex items-center justify-center space-x-2"
                  >
                    <Store className="w-4 h-4 text-sky-400" />
                    <span>Trocar de Loja</span>
                  </button>
                  <button
                    onClick={() => {
                      setSelectedSupermarketId('all');
                      setActivePage(1);
                    }}
                    className="bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 hover:text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition-all flex items-center justify-center space-x-2"
                  >
                    <Globe className="w-4 h-4 text-slate-400" />
                    <span>Ver Todas as Lojas</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Encarte Header Banner */}
      {currentEncarte && (
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-900 via-sky-900 to-slate-900 text-white p-6 sm:p-8 border border-sky-800/50 shadow-xl">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center space-x-2 bg-sky-500/20 text-sky-300 border border-sky-500/30 px-3 py-1 rounded-full text-xs font-bold uppercase mb-2">
                <Calendar className="w-3.5 h-3.5" />
                <span>Validade: {currentEncarte.startDate} até {currentEncarte.endDate}</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                {currentEncarte.title}
              </h2>
              <p className="text-sky-200 text-sm mt-1">
                {currentEncarte.subtitle}
              </p>
            </div>

            {/* View Mode & Page Controls */}
            <div className="flex items-center space-x-2 bg-slate-950/70 p-1.5 rounded-2xl border border-slate-700/80 backdrop-blur-md self-start md:self-auto">
              <button
                id="btn-mode-grid"
                onClick={() => setViewMode('grid')}
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  viewMode === 'grid'
                    ? 'bg-sky-500 text-white shadow-md'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Grid3X3 className="w-4 h-4" />
                <span>Grade de Ofertas</span>
              </button>

              <button
                id="btn-mode-booklet"
                onClick={() => setViewMode('booklet')}
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  viewMode === 'booklet'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span>Folhear Encarte</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter Controls Bar */}
      <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-lg space-y-4">
        {/* Search & Sort */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              id="input-search-promotions"
              type="text"
              placeholder="Buscar picanha, cerveja, morango, azeite..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white bg-slate-800 px-2 py-0.5 rounded"
              >
                Limpar
              </button>
            )}
          </div>

          {/* Sort selector */}
          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            <ArrowUpDown className="w-4 h-4 text-slate-400" />
            <select
              id="select-sort-promotions"
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-sky-500 font-semibold cursor-pointer"
            >
              <option value="discount">🔥 Maior Desconto</option>
              <option value="price-asc">💵 Menor Preço</option>
              <option value="price-desc">💎 Maior Preço</option>
              <option value="name">🔤 Nome A-Z</option>
            </select>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
          {categoriesList.map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                setSelectedCategory(cat.id);
                setActivePage(1);
              }}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedCategory === cat.id
                  ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/20 scale-105'
                  : 'bg-slate-950 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800'
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* VIEW MODE 1: DIGITAL BOOKLET / LEAFLET FOLHEAR */}
      {viewMode === 'booklet' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center space-x-2">
              <BookOpen className="w-5 h-5 text-sky-400" />
              <h3 className="text-lg font-bold text-white">
                Página {activePage} de {totalBookletPages} do Encarte Digital
              </h3>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center space-x-2">
              <button
                disabled={activePage === 1}
                onClick={() => setActivePage((p) => Math.max(1, p - 1))}
                className="p-2 rounded-xl bg-slate-800 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
                title="Página Anterior"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-xs font-bold text-slate-300 px-2">
                {activePage} / {totalBookletPages}
              </span>
              <button
                disabled={activePage >= totalBookletPages}
                onClick={() => setActivePage((p) => Math.min(totalBookletPages, p + 1))}
                className="p-2 rounded-xl bg-slate-800 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
                title="Próxima Página"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Booklet Page 2x2 Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-h-[400px]">
            <AnimatePresence mode="wait">
              {currentPageItems.map((promo) => {
                const discountPct = Math.round(
                  ((promo.originalPrice - promo.promoPrice) / promo.originalPrice) * 100
                );
                const countInCart = cartQuantities[promo.id] || 0;

                return (
                  <motion.div
                    key={promo.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-slate-950 border-2 border-slate-800 hover:border-sky-500/50 rounded-2xl p-4 flex gap-4 relative overflow-hidden group shadow-lg"
                  >
                    {/* Discount Badge Ribbon */}
                    <div className="absolute top-2 right-2 bg-red-500 text-white font-black text-[11px] px-2.5 py-1 rounded-lg shadow-md flex items-center">
                      <Zap className="w-3 h-3 mr-0.5 fill-current" />
                      -{discountPct}%
                    </div>

                    {/* Image */}
                    <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-xl overflow-hidden bg-slate-900 border border-slate-800 shrink-0 relative">
                      <img
                        src={extractDirectImageUrl(promo.imageUrl)}
                        alt={promo.title}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.currentTarget.src = getCategoryFallbackImage(promo.category);
                        }}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      {promo.isBanner && (
                        <span className="absolute bottom-1 left-1 bg-amber-400 text-slate-950 text-[9px] font-black px-1.5 py-0.5 rounded shadow">
                          Destaque
                        </span>
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider">
                          {promo.category}
                        </span>
                        <h4 className="text-sm font-bold text-white line-clamp-2 leading-snug">
                          {promo.title}
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                          {promo.description}
                        </p>
                      </div>

                      {/* Prices & Button */}
                      <div className="mt-2 flex items-center justify-between">
                        <div>
                          <span className="text-xs text-slate-400 line-through block">
                            R$ {promo.originalPrice.toFixed(2)}
                          </span>
                          <span className="text-lg font-black text-emerald-400">
                            R$ {promo.promoPrice.toFixed(2)}
                            <span className="text-[10px] text-slate-400 font-normal">/{promo.unit}</span>
                          </span>
                        </div>

                        <button
                          onClick={() => handleAdd(promo)}
                          className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                            addedAnimationIds[promo.id]
                              ? 'bg-emerald-500 text-white'
                              : 'bg-sky-500 hover:bg-sky-400 text-white shadow-md'
                          }`}
                        >
                          {addedAnimationIds[promo.id] ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <>
                              <ShoppingBag className="w-3.5 h-3.5" />
                              <span>{countInCart > 0 ? `+1 (${countInCart})` : 'Adicionar'}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* VIEW MODE 2: INTERACTIVE GRID OF PROMOTIONS */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-5">
          <AnimatePresence>
            {filteredPromotions.map((promo) => {
              const discountPct = Math.round(
                ((promo.originalPrice - promo.promoPrice) / promo.originalPrice) * 100
              );
              const countInCart = cartQuantities[promo.id] || 0;

              return (
                <motion.div
                  key={promo.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.3 }}
                  className="bg-slate-900 border border-slate-800 hover:border-sky-500/50 rounded-2xl overflow-hidden shadow-xl hover:shadow-2xl hover:shadow-sky-500/10 transition-all flex flex-col justify-between group"
                >
                  {/* Card Image Container */}
                  <div className="relative aspect-4/3 bg-slate-950 overflow-hidden">
                    <img
                      src={extractDirectImageUrl(promo.imageUrl)}
                      alt={promo.title}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.src = getCategoryFallbackImage(promo.category);
                      }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />

                    {/* Discount Badge */}
                    <div className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 bg-red-500 text-white text-[10px] sm:text-xs font-black px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg sm:rounded-xl shadow-lg flex items-center">
                      <Flame className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-0.5" />
                      -{discountPct}%
                    </div>

                    {/* Badge Text if any */}
                    {promo.badgeText && (
                      <div className="absolute top-2.5 left-2.5 sm:top-3 sm:left-3 bg-amber-400 text-slate-950 text-[9px] sm:text-[10px] font-black px-1.5 sm:px-2 py-0.5 rounded-lg shadow uppercase">
                        {promo.badgeText}
                      </div>
                    )}

                    {/* Banner Highlight Badge */}
                    {promo.isBanner && (
                      <div className="absolute bottom-2.5 left-2.5 sm:bottom-3 sm:left-3 bg-sky-500/90 text-white backdrop-blur-md text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-lg border border-sky-300/30">
                        ⭐ Destaque
                      </div>
                    )}
                  </div>

                  {/* Card Content */}
                  <div className="p-3 sm:p-4 flex-1 flex flex-col justify-between space-y-2.5 sm:space-y-3">
                    <div>
                      <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                        <span>{promo.category}</span>
                      </div>
                      <h3 className="font-bold text-white text-sm sm:text-base line-clamp-2 group-hover:text-sky-300 transition-colors">
                        {promo.title}
                      </h3>
                      <p className="text-[11px] sm:text-xs text-slate-400 line-clamp-2 mt-0.5 sm:mt-1">
                        {promo.description}
                      </p>
                    </div>

                    {/* Price & Action */}
                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                      <div>
                        <span className="text-[11px] sm:text-xs text-slate-400 line-through block">
                          R$ {promo.originalPrice.toFixed(2)}
                        </span>
                        <div className="flex items-baseline space-x-0.5 sm:space-x-1">
                          <span className="text-base sm:text-xl font-black text-emerald-400">
                            R$ {promo.promoPrice.toFixed(2)}
                          </span>
                          <span className="text-[10px] sm:text-xs text-slate-400">/{promo.unit}</span>
                        </div>
                      </div>

                      <button
                        id={`btn-add-grid-${promo.id}`}
                        onClick={() => handleAdd(promo)}
                        className={`flex items-center space-x-1 sm:space-x-1.5 px-2.5 sm:px-3.5 py-2 sm:py-2.5 rounded-xl font-bold text-xs shadow-lg transition-all active:scale-95 shrink-0 min-h-[38px] ${
                          addedAnimationIds[promo.id]
                            ? 'bg-emerald-500 text-white shadow-emerald-500/20'
                            : countInCart > 0
                            ? 'bg-sky-500 text-white shadow-sky-500/20'
                            : 'bg-slate-800 hover:bg-sky-500 text-slate-200 hover:text-white border border-slate-700'
                        }`}
                      >
                        {addedAnimationIds[promo.id] ? (
                          <>
                            <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-bounce" />
                            <span className="hidden sm:inline">Adicionado</span>
                          </>
                        ) : (
                          <>
                            <ShoppingBag className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            <span>{countInCart > 0 ? `+1 (${countInCart})` : 'Comprar'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {filteredPromotions.length === 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10 text-center text-slate-400 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center mx-auto">
            <Store className="w-7 h-7" />
          </div>
          <div>
            <p className="text-lg font-bold text-white">
              {selectedSupermarket 
                ? `Sem ofertas cadastradas no momento para ${selectedSupermarket.nomeFantasia}`
                : 'Nenhuma promoção encontrada'}
            </p>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              {selectedSupermarket
                ? 'Este supermercado ainda não publicou novas ofertas para esta categoria. Você pode conferir os dados da loja, visitar presencialmente ou compartilhar o encarte!'
                : 'Tente pesquisar por outro termo ou selecionar outra categoria / supermercado.'}
            </p>
          </div>
          {selectedSupermarket && (
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsQrModalOpen(true)}
                className="flex items-center space-x-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-600/20 active:scale-95"
              >
                <QrCode className="w-4 h-4" />
                <span>Ver QR Code da Loja</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('all');
                  setSearchQuery('');
                  setSelectedSupermarketId('all');
                }}
                className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-700 active:scale-95"
              >
                <Globe className="w-4 h-4 text-sky-400" />
                <span>Explorar Todas as Lojas</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* SUPERMARKET SELECTOR MODAL MENU */}
      <AnimatePresence>
        {isSupermarketMenuOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
            >
              {/* Modal Header */}
              <div className="p-5 sm:p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                    <Store className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white">Selecione o Supermercado</h3>
                    <p className="text-xs text-slate-400">
                      Escolha uma loja para visualizar encartes e ofertas exclusivas
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsSupermarketMenuOpen(false)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body: Supermarket Options */}
              <div className="p-5 sm:p-6 overflow-y-auto space-y-3 flex-1">
                {/* Option 1: All Supermarkets */}
                <button
                  onClick={() => {
                    setSelectedSupermarketId('all');
                    setActivePage(1);
                    setIsSupermarketMenuOpen(false);
                  }}
                  className={`w-full p-4 rounded-2xl border text-left transition-all flex items-center justify-between ${
                    selectedSupermarketId === 'all'
                      ? 'border-sky-500 bg-sky-500/10 ring-1 ring-sky-500/40 text-white shadow-lg'
                      : 'border-slate-800 bg-slate-950/80 hover:bg-slate-800/80 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center space-x-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-sky-400 border border-slate-700 shrink-0">
                      <Globe className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="block font-black text-sm text-white">Todas as Lojas & Encartes</span>
                      <span className="block text-xs text-slate-400">Ver todas as ofertas unificadas no aplicativo</span>
                    </div>
                  </div>

                  {selectedSupermarketId === 'all' && (
                    <span className="w-6 h-6 rounded-full bg-sky-500 text-white flex items-center justify-center shrink-0">
                      <Check className="w-4 h-4" />
                    </span>
                  )}
                </button>

                {/* Filtered Valid Registered Supermarkets */}
                {filteredSupermarkets.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-xs">
                    Nenhum outro supermercado cadastrado no momento.
                  </div>
                ) : (
                  filteredSupermarkets.map((m) => {
                    const isSelected = selectedSupermarketId === m.uid || selectedSupermarketId === m.supermercadoId;
                    return (
                      <button
                        key={m.uid || m.supermercadoId}
                        onClick={() => {
                          setSelectedSupermarketId(m.uid || m.supermercadoId || 'all');
                          setActivePage(1);
                          setIsSupermarketMenuOpen(false);
                        }}
                        className={`w-full p-4 rounded-2xl border text-left transition-all flex items-start justify-between ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500/40 text-white shadow-lg'
                            : 'border-slate-800 bg-slate-950/80 hover:bg-slate-800/80 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start space-x-3.5 min-w-0 flex-1">
                          {m.logoUrl ? (
                            <img
                              src={m.logoUrl}
                              alt={m.nomeFantasia}
                              className="w-12 h-12 rounded-2xl object-contain bg-slate-900 border border-slate-700 p-1 shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400 shrink-0">
                              <Building2 className="w-6 h-6" />
                            </div>
                          )}

                          <div className="space-y-1 min-w-0 flex-1">
                            <span className="block font-black text-sm text-white truncate">
                              {m.nomeFantasia || m.razaoSocial}
                            </span>
                            {m.razaoSocial && m.razaoSocial !== m.nomeFantasia && (
                              <span className="block text-xs text-slate-400 truncate">
                                Razão: {m.razaoSocial}
                              </span>
                            )}
                            {(m.address || m.bairro || m.cidade) && (
                              <span className="flex items-center text-xs text-slate-400">
                                <MapPin className="w-3.5 h-3.5 mr-1 text-sky-400 shrink-0" />
                                {[m.bairro, m.cidade, m.estado].filter(Boolean).join(', ')}
                              </span>
                            )}

                            <div className="pt-1">
                              {m.aceitaCompraOnline ? (
                                <span className="inline-flex items-center text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                                  <CheckCircle2 className="w-3 h-3 mr-1" /> Aceita Vendas Online via App
                                </span>
                              ) : (
                                <span className="inline-flex items-center text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/30 px-2 py-0.5 rounded-full">
                                  <AlertCircle className="w-3 h-3 mr-1" /> Apenas Consulta de Ofertas (Loja Física)
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {isSelected && (
                          <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 ml-2 mt-1">
                            <Check className="w-4 h-4" />
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-800 bg-slate-950/80 text-center">
                <button
                  onClick={() => setIsSupermarketMenuOpen(false)}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs py-3 rounded-xl transition-colors"
                >
                  Fechar Menu
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* OFFLINE PURCHASES NOTICE MODAL */}
      <AnimatePresence>
        {offlineNoticeStore?.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-amber-500/30 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 text-center"
            >
              <div className="w-14 h-14 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
                <Info className="w-7 h-7" />
              </div>

              <div>
                <h3 className="text-lg font-black text-white">Vendas Presenciais na Loja</h3>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                  O estabelecimento <strong className="text-amber-300">{offlineNoticeStore.storeName}</strong> optou por utilizar a plataforma exclusivamente para divulgação de encartes e ofertas.
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Os pedidos e compras online estão desativados para esta loja. Visite o supermercado para aproveitar os preços promocionais!
                </p>
              </div>

              <button
                onClick={() => setOfflineNoticeStore(null)}
                className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs py-3 rounded-2xl shadow-lg transition-colors"
              >
                Entendi
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* QR Code & Link Modal for Selected Supermarket */}
      {selectedSupermarket && (
        <QRCodeModal
          isOpen={isQrModalOpen}
          onClose={() => setIsQrModalOpen(false)}
          supermarket={selectedSupermarket}
        />
      )}

    </div>
  );
};
