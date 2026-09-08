import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Flame, 
  ChevronLeft, 
  ChevronRight, 
  ShoppingBag, 
  Clock, 
  Sparkles, 
  Tag, 
  TrendingDown, 
  Check,
  Store,
  Building2,
  ArrowRight,
  Sparkle,
  SlidersHorizontal
} from 'lucide-react';
import { PromotionItem, SupermarketDetails } from '../types';
import { extractDirectImageUrl, getCategoryFallbackImage } from '../utils/image';

interface BannerCarouselProps {
  banners: PromotionItem[];
  supermarkets?: SupermarketDetails[];
  selectedSupermarketId?: string | 'all';
  onSelectSupermarket?: (id: string | 'all') => void;
  onAddToCart: (item: PromotionItem) => void;
}

export const BannerCarousel: React.FC<BannerCarouselProps> = ({ 
  banners, 
  supermarkets = [],
  selectedSupermarketId = 'all',
  onSelectSupermarket,
  onAddToCart 
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [addedItemIds, setAddedItemIds] = useState<Record<string, boolean>>({});
  const [activeTabStoreId, setActiveTabStoreId] = useState<string>('');

  // Filter valid active supermarkets
  const validSupermarkets = useMemo(() => {
    return supermarkets.filter((m) => {
      return !m.bloqueado && m.statusInquilino !== 'Bloqueado';
    });
  }, [supermarkets]);

  // Deduplicate incoming banners
  const uniqueBanners = useMemo(() => {
    return Array.from(new Map<string, PromotionItem>(banners.map((b) => [b.id, b])).values());
  }, [banners]);

  // Group banners strictly by supermarketId
  const bannersByStore = useMemo(() => {
    const map = new Map<string, PromotionItem[]>();
    uniqueBanners.forEach((b) => {
      const storeId = b.supermarketId || 'unknown';
      if (!map.has(storeId)) {
        map.set(storeId, []);
      }
      map.get(storeId)!.push(b);
    });
    return map;
  }, [uniqueBanners]);

  // Supermarkets that currently have banner promotions
  const storesWithBanners = useMemo(() => {
    const ids = Array.from(bannersByStore.keys());
    return ids
      .map((id) => {
        const store = validSupermarkets.find((s) => s.uid === id || s.supermercadoId === id);
        const storeBanners = bannersByStore.get(id) || [];
        const fallbackName = storeBanners[0]?.supermarketName || 'Supermercado';
        return {
          id,
          name: store?.nomeFantasia || store?.razaoSocial || fallbackName,
          logoUrl: store?.logoUrl,
          bannerCount: storeBanners.length,
          banners: storeBanners
        };
      })
      .filter((s) => s.bannerCount > 0);
  }, [bannersByStore, validSupermarkets]);

  // Determine current active store when selectedSupermarketId === 'all'
  useEffect(() => {
    if (selectedSupermarketId === 'all') {
      if (storesWithBanners.length > 0 && !storesWithBanners.some((s) => s.id === activeTabStoreId)) {
        setActiveTabStoreId(storesWithBanners[0].id);
        setCurrentIndex(0);
      }
    }
  }, [selectedSupermarketId, storesWithBanners, activeTabStoreId]);

  // Resolved list of isolated banners for the current view
  const activeBanners = useMemo(() => {
    if (selectedSupermarketId !== 'all') {
      // Strictly isolated to the chosen supermarket
      return uniqueBanners.filter((b) => b.supermarketId === selectedSupermarketId);
    }
    // In 'all' mode: show the isolated banners of the active store tab
    if (activeTabStoreId && bannersByStore.has(activeTabStoreId)) {
      return bannersByStore.get(activeTabStoreId) || [];
    }
    return [];
  }, [selectedSupermarketId, uniqueBanners, activeTabStoreId, bannersByStore]);

  // Reset slide index when active banners change
  useEffect(() => {
    setCurrentIndex(0);
  }, [selectedSupermarketId, activeTabStoreId, activeBanners.length]);

  // Auto-rotation interval for active isolated banners
  useEffect(() => {
    if (activeBanners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % activeBanners.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [activeBanners.length]);

  const handleAdd = (item: PromotionItem) => {
    onAddToCart(item);
    setAddedItemIds((prev) => ({ ...prev, [item.id]: true }));
    setTimeout(() => {
      setAddedItemIds((prev) => ({ ...prev, [item.id]: false }));
    }, 1500);
  };

  // Find info of currently selected or active store
  const targetStoreId = selectedSupermarketId !== 'all' ? selectedSupermarketId : activeTabStoreId;
  const currentStoreDetails = validSupermarkets.find(
    (s) => s.uid === targetStoreId || s.supermercadoId === targetStoreId
  );
  const currentStoreName =
    currentStoreDetails?.nomeFantasia ||
    currentStoreDetails?.razaoSocial ||
    activeBanners[0]?.supermarketName ||
    'Supermercado';

  // State A: A specific supermarket is selected, but it has 0 banner promotions
  if (selectedSupermarketId !== 'all' && activeBanners.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-3xl bg-slate-900 border border-slate-800 p-6 sm:p-8 my-6 shadow-2xl text-center">
        <div className="absolute inset-0 bg-gradient-to-r from-sky-950/20 via-slate-900 to-slate-950 pointer-events-none" />
        <div className="relative z-10 max-w-lg mx-auto space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto text-amber-400 shadow-lg">
            {currentStoreDetails?.logoUrl ? (
              <img
                src={currentStoreDetails.logoUrl}
                alt={currentStoreName}
                className="w-14 h-14 object-contain rounded-xl"
              />
            ) : (
              <Store className="w-8 h-8" />
            )}
          </div>

          <div>
            <span className="inline-flex items-center space-x-1 bg-sky-500/20 text-sky-300 border border-sky-500/30 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full mb-2">
              Banner do Dia • Exclusivo
            </span>
            <h3 className="text-lg sm:text-xl font-bold text-white">
              {currentStoreName}
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Este supermercado ainda não selecionou itens para o Banner do Dia hoje. Você pode conferir todas as ofertas e o encarte completo desta loja no catálogo logo abaixo!
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={() => {
                const el = document.getElementById('catalogo-ofertas') || document.getElementById('encarte-digital');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-lg transition-all flex items-center space-x-2"
            >
              <span>Ver Ofertas no Catálogo</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {onSelectSupermarket && (
              <button
                onClick={() => onSelectSupermarket('all')}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-semibold text-xs transition-all flex items-center space-x-1.5"
              >
                <Store className="w-3.5 h-3.5" />
                <span>Ver Outros Supermercados</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // State B: Viewing all stores, but none have banners
  if (selectedSupermarketId === 'all' && storesWithBanners.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 my-6 text-center text-slate-400 shadow-2xl">
        <Sparkles className="w-8 h-8 text-sky-400 mx-auto mb-2 animate-bounce" />
        <p className="font-semibold text-slate-200">Aguardando Destaques no Banner do Dia...</p>
        <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
          Cada supermercado gerencia e destaca suas próprias ofertas de forma individual. Assim que um gestor ativar um banner, ele aparecerá aqui isoladamente.
        </p>
      </div>
    );
  }

  const currentItem = activeBanners[currentIndex % activeBanners.length];
  const discountPercent = currentItem?.originalPrice && currentItem?.promoPrice
    ? Math.round(((currentItem.originalPrice - currentItem.promoPrice) / currentItem.originalPrice) * 100)
    : 0;

  return (
    <div className="relative rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl my-6 overflow-hidden">
      {/* Background Ambient Glow */}
      <div className="absolute inset-0 bg-gradient-to-r from-sky-950/40 via-blue-950/20 to-slate-950 pointer-events-none" />

      {/* Top Bar: Supermarket Identity & Isolation Controls */}
      <div className="relative z-20 border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md px-4 sm:px-6 py-3">
        {selectedSupermarketId !== 'all' ? (
          /* Single Selected Supermarket Mode */
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400 shrink-0">
                {currentStoreDetails?.logoUrl ? (
                  <img
                    src={currentStoreDetails.logoUrl}
                    alt={currentStoreName}
                    className="w-8 h-8 object-contain rounded-lg"
                  />
                ) : (
                  <Building2 className="w-5 h-5" />
                )}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-sm font-black text-white truncate max-w-[200px] sm:max-w-xs">
                    {currentStoreName}
                  </h2>
                  <span className="bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[9px] font-black uppercase px-2 py-0.5 rounded-full">
                    Banner Exclusivo
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {activeBanners.length} {activeBanners.length === 1 ? 'oferta em destaque' : 'ofertas em destaque'} nesta loja
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 self-end sm:self-center">
              {onSelectSupermarket && (
                <button
                  onClick={() => onSelectSupermarket('all')}
                  className="text-[11px] font-bold text-sky-400 hover:text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 px-2.5 py-1 rounded-lg transition-all flex items-center space-x-1"
                >
                  <Store className="w-3 h-3" />
                  <span>Ver todas as lojas</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          /* 'All' Mode: Supermarket Tab Selector for strict banner isolation */
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-300">
                <Store className="w-4 h-4 text-sky-400" />
                <span>Banners Individuais por Supermercado:</span>
              </div>
              <span className="text-[10px] text-slate-500 font-semibold hidden sm:inline">
                Selecione a loja para visualizar seu banner exclusivo
              </span>
            </div>

            {/* Store Tabs */}
            <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-800">
              {storesWithBanners.map((store) => {
                const isActive = activeTabStoreId === store.id;
                return (
                  <button
                    key={store.id}
                    onClick={() => {
                      setActiveTabStoreId(store.id);
                      setCurrentIndex(0);
                    }}
                    className={`shrink-0 flex items-center space-x-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-sky-500/20 border-sky-500/60 text-white shadow-lg shadow-sky-500/10'
                        : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
                    }`}
                  >
                    <Building2 className={`w-3.5 h-3.5 ${isActive ? 'text-sky-400' : 'text-slate-500'}`} />
                    <span className="truncate max-w-[140px] sm:max-w-[200px]">{store.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                      isActive ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {store.bannerCount}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Main Banner Content */}
      <AnimatePresence mode="wait">
        {currentItem && (
          <motion.div
            key={`${currentItem.id}-${currentIndex}`}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.35, ease: 'easeInOut' }}
            className="p-4 sm:p-8 grid grid-cols-1 md:grid-cols-12 gap-6 items-center relative z-10"
          >
            {/* Left Content Area (Columns 1-7) */}
            <div className="md:col-span-7 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center space-x-1.5 bg-gradient-to-r from-red-600 to-amber-500 text-white font-black text-xs px-3 py-1 rounded-full shadow-lg">
                  <Flame className="w-3.5 h-3.5 animate-pulse fill-white" />
                  <span>BANNER DO DIA</span>
                </span>

                <span className="inline-flex items-center space-x-1 bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold text-xs px-3 py-1 rounded-full">
                  <Clock className="w-3 h-3 text-amber-400" />
                  <span>Válido Só Hoje</span>
                </span>

                <span className="inline-flex items-center space-x-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-bold text-xs px-2.5 py-1 rounded-full">
                  <Store className="w-3 h-3 text-emerald-400" />
                  <span className="truncate max-w-[150px]">{currentStoreName}</span>
                </span>
              </div>

              <div>
                <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
                  {currentItem.title}
                </h1>
                <p className="text-slate-300 text-sm sm:text-base mt-2 line-clamp-2">
                  {currentItem.description || 'Super oferta exclusiva por tempo limitado para hoje! Aproveite antes que acabe o estoque.'}
                </p>
              </div>

              {/* Price Row */}
              <div className="flex items-baseline space-x-3 pt-2">
                <span className="text-3xl sm:text-5xl font-black text-emerald-400 tracking-tight">
                  R$ {currentItem.promoPrice.toFixed(2)}
                </span>
                <span className="text-xs sm:text-sm text-slate-400 font-semibold uppercase">
                  / {currentItem.unit}
                </span>

                {currentItem.originalPrice > currentItem.promoPrice && (
                  <span className="text-base sm:text-lg text-slate-500 line-through font-medium ml-2">
                    R$ {currentItem.originalPrice.toFixed(2)}
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-3">
                <button
                  onClick={() => handleAdd(currentItem)}
                  className={`flex-1 sm:flex-none px-6 py-3.5 rounded-2xl font-black text-sm transition-all duration-200 shadow-xl flex items-center justify-center space-x-2 active:scale-95 ${
                    addedItemIds[currentItem.id]
                      ? 'bg-emerald-500 text-slate-950 font-black ring-4 ring-emerald-500/30'
                      : 'bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white shadow-sky-500/20'
                  }`}
                >
                  {addedItemIds[currentItem.id] ? (
                    <>
                      <Check className="w-4 h-4 text-slate-950 stroke-[3]" />
                      <span>Adicionado ao Carrinho!</span>
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="w-4 h-4" />
                      <span>Adicionar Oferta ao Carrinho</span>
                    </>
                  )}
                </button>

                {selectedSupermarketId === 'all' && onSelectSupermarket && (
                  <button
                    onClick={() => onSelectSupermarket(targetStoreId)}
                    className="px-4 py-3.5 rounded-2xl bg-slate-800/90 hover:bg-slate-700/90 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold transition-all flex items-center space-x-1.5"
                    title={`Acessar o catálogo completo de ${currentStoreName}`}
                  >
                    <span>Entrar na Loja</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Right Product Image Area (Columns 8-12) */}
            <div className="md:col-span-5 flex justify-center items-center relative">
              <div className="relative w-full max-w-[280px] sm:max-w-[320px] aspect-square rounded-3xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl group">
                <img
                  src={extractDirectImageUrl(currentItem.imageUrl)}
                  alt={currentItem.title}
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.currentTarget.src = getCategoryFallbackImage(currentItem.category);
                  }}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />

                {/* Corner Discount Pill */}
                {discountPercent > 0 && (
                  <div className="absolute top-3 right-3 bg-red-600/90 text-white text-xs font-black px-2.5 py-1 rounded-xl shadow-lg border border-red-400/30 flex items-center space-x-1">
                    <TrendingDown className="w-3.5 h-3.5" />
                    <span>-{discountPercent}% OFF</span>
                  </div>
                )}

                {/* Supermarket Brand Badge on Product Image */}
                <div className="absolute bottom-3 left-3 right-3 bg-slate-950/85 backdrop-blur-md rounded-xl p-2 border border-slate-800/80 flex items-center space-x-2">
                  <div className="w-6 h-6 rounded-lg bg-slate-800 flex items-center justify-center text-amber-400 shrink-0">
                    <Store className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block text-[10px] text-slate-400 font-semibold uppercase">Supermercado</span>
                    <span className="block text-xs font-bold text-white truncate">{currentStoreName}</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation Controls */}
      {activeBanners.length > 1 && (
        <>
          <button
            onClick={() =>
              setCurrentIndex((prev) => (prev - 1 + activeBanners.length) % activeBanners.length)
            }
            className="absolute left-3 top-1/2 -translate-y-1/2 bg-slate-900/80 hover:bg-slate-800 text-white p-2.5 rounded-full border border-slate-700 backdrop-blur-md transition-all z-20 hover:scale-110"
            title="Oferta Anterior"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <button
            onClick={() => setCurrentIndex((prev) => (prev + 1) % activeBanners.length)}
            className="absolute right-3 top-1/2 -translate-y-1/2 bg-slate-900/80 hover:bg-slate-800 text-white p-2.5 rounded-full border border-slate-700 backdrop-blur-md transition-all z-20 hover:scale-110"
            title="Próxima Oferta"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          {/* Indicator Dots */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center space-x-2 z-20 bg-slate-950/60 px-3 py-1 rounded-full border border-slate-800/80 backdrop-blur-sm">
            {activeBanners.map((b, idx) => (
              <button
                key={b.id}
                onClick={() => setCurrentIndex(idx)}
                className={`h-2 rounded-full transition-all ${
                  idx === currentIndex % activeBanners.length
                    ? 'w-6 bg-sky-400'
                    : 'w-2 bg-slate-600 hover:bg-slate-400'
                }`}
                title={`Ver oferta ${idx + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};
