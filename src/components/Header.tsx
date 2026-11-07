import React from 'react';
import { 
  ShoppingBag, 
  Store, 
  Smartphone, 
  Sparkles, 
  Volume2, 
  VolumeX, 
  Radio, 
  Clock,
  Flame,
  LogOut,
  UserCheck,
  ShieldCheck
} from 'lucide-react';
import { UserProfile, SupermarketDetails } from '../types';
import { PWAInstallButton } from './PWAInstallButton';
import { getStoreOperatingStatus } from '../utils/storeHours';

interface HeaderProps {
  activeView: 'client' | 'manager' | 'split';
  setActiveView: (view: 'client' | 'manager' | 'split') => void;
  cartCount: number;
  cartTotal: number;
  onOpenCart: () => void;
  onOpenAIRecipe: () => void;
  onOpenOrderTracker: () => void;
  activeOrdersCount: number;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  isConnected: boolean;
  latestEventMessage?: string;
  currentUser?: UserProfile | null;
  currentStore?: SupermarketDetails | null;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeView,
  setActiveView,
  cartCount,
  cartTotal,
  onOpenCart,
  onOpenAIRecipe,
  onOpenOrderTracker,
  activeOrdersCount,
  soundEnabled,
  setSoundEnabled,
  isConnected,
  latestEventMessage,
  currentUser,
  currentStore,
  onLogout
}) => {
  const storeStatus = getStoreOperatingStatus(currentStore);

  // Paleta de 4+ cores do estabelecimento
  const primaryColor = currentStore?.primaryColor;
  const secondaryColor = currentStore?.secondaryColor;
  const tertiaryColor = currentStore?.tertiaryColor;
  const quaternaryColor = currentStore?.quaternaryColor;

  // Gradiente dinâmico com 4 ou mais cores para acompanhar fielmente a logo do supermercado
  const tickerGradientStyle = (primaryColor && secondaryColor) ? {
    background: `linear-gradient(to right, ${primaryColor}, ${secondaryColor}${tertiaryColor ? `, ${tertiaryColor}` : ''}${quaternaryColor ? `, ${quaternaryColor}` : ''})`
  } : undefined;

  return (
    <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 text-white shadow-xl">
      {/* Top User Bar / Authenticated User Status */}
      {currentUser && (
        <div className="bg-slate-950 border-b border-slate-800 px-3 sm:px-4 py-1.5 flex items-center justify-between text-xs gap-2">
          <div className="flex items-center space-x-1.5 sm:space-x-2 overflow-hidden min-w-0">
            <div className={`p-1 rounded-full shrink-0 ${currentUser.role === 'supermercado' ? 'bg-amber-500/20 text-amber-400' : 'bg-sky-500/20 text-sky-400'}`}>
              {currentUser.role === 'supermercado' ? <ShieldCheck className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
            </div>
            <span className="font-semibold text-slate-200 truncate max-w-[100px] sm:max-w-none">
              {currentUser.nome}
            </span>
            <span className="text-slate-500 hidden sm:inline">•</span>
            <span className="text-slate-400 truncate max-w-[140px] sm:max-w-[180px] hidden sm:inline">
              {currentUser.email}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-wider shrink-0 ${
              currentUser.role === 'supermercado' 
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
            }`}>
              {currentUser.role === 'supermercado' ? 'Gestor' : 'Cliente'}
            </span>

            {currentUser.role === 'cliente' && (currentUser.registeredSupermarketName || currentUser.registeredSupermarketId) && (
              <span className="hidden sm:inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] sm:text-[10px] font-bold px-2.5 py-0.5 rounded-full shrink-0">
                <Store className="w-3 h-3 text-emerald-400" />
                <span className="truncate max-w-[140px]">{currentUser.registeredSupermarketName || 'Supermercado Vinculado'}</span>
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <span className="text-slate-400 text-[11px] hidden md:inline">
              Sessão Ativa
            </span>
            {onLogout && (
              <button
                onClick={onLogout}
                className="flex items-center space-x-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 px-2 py-1 rounded transition-colors font-medium text-[11px] min-h-[32px] active:scale-95"
                title="Encerrar sessão"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sair</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Top Banner Ticker */}
      <div 
        className="bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-700 text-white text-xs py-1.5 px-4 font-medium flex items-center justify-between"
        style={tickerGradientStyle}
      >
        <div className="flex items-center space-x-2 overflow-hidden">
          <span className="flex items-center bg-red-500 text-white px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider animate-pulse">
            <Flame className="w-3 h-3 mr-1 inline" /> Ao Vivo
          </span>
          <span className="truncate text-sky-100">
            {latestEventMessage || 'Transmissão em tempo real ativada! Qualquer oferta atualizada pelo painel é refletida instantaneamente.'}
          </span>
        </div>
        <div className="hidden md:flex items-center space-x-3 text-sky-100 text-[11px] shrink-0">
          <span className="flex items-center">
            <Radio className={`w-3 h-3 mr-1 ${isConnected ? 'text-emerald-400 animate-ping' : 'text-amber-400'}`} />
            {isConnected ? 'SSE Conectado' : 'Reconectando...'}
          </span>
          <span className="flex items-center space-x-1.5 bg-slate-900/60 px-2 py-0.5 rounded-md border border-white/10">
            <Clock className="w-3 h-3 text-sky-300" />
            <span>{storeStatus.todaySchedule}</span>
            <span className={`text-[9px] font-black px-1.5 py-0.2 rounded-full uppercase ${
              storeStatus.isOpen 
                ? 'bg-emerald-500 text-white' 
                : 'bg-amber-500 text-slate-950'
            }`}>
              {storeStatus.isOpen ? 'Aberto' : 'Fechado'}
            </span>
          </span>
        </div>
      </div>

      {/* Main Nav Header */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3.5 flex items-center justify-between gap-2 sm:gap-4">
        
        {/* Brand & Logo */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          <div 
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl overflow-hidden shadow-lg flex items-center justify-center shrink-0 border bg-slate-950 p-0.5"
            style={{
              borderColor: tertiaryColor || primaryColor || 'rgba(56, 189, 248, 0.3)',
              boxShadow: primaryColor ? `0 4px 14px ${primaryColor}30` : undefined
            }}
          >
            {currentStore?.logoUrl || currentStore?.splashImageUrl ? (
              <img src={currentStore.logoUrl || currentStore.splashImageUrl} alt={currentStore.nomeFantasia || 'Supermercado'} className="w-full h-full object-contain" />
            ) : (
              <img src="/pwa-192x192.png" alt="PromoMarket" className="w-full h-full object-cover" />
            )}
          </div>
          <div>
            <div className="flex items-center space-x-1.5 sm:space-x-2">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white font-sans">
                {currentStore?.nomeFantasia ? (
                  <span className="text-white truncate max-w-[180px] sm:max-w-[240px] inline-block align-bottom">{currentStore.nomeFantasia}</span>
                ) : (
                  <>Promo<span className="text-sky-400">Market</span></>
                )}
              </h1>
              <span className={`text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full font-semibold uppercase ${
                storeStatus.isOpen
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}>
                {storeStatus.isOpen ? 'Aberto Agora' : 'Fechado'}
              </span>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-emerald-400 shrink-0" />
              <span className="truncate max-w-[200px] sm:hidden">{storeStatus.todaySchedule}</span>
              <span className="truncate max-w-md hidden sm:inline">{storeStatus.fullSchedule}</span>
            </p>
          </div>
        </div>

        {/* Screen Title Badge based on active role */}
        <div className="hidden md:flex items-center space-x-2 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700/80 text-xs font-semibold">
          {currentUser?.role === 'supermercado' ? (
            <div className="flex items-center space-x-1.5 text-amber-400">
              <Store className="w-4 h-4" />
              <span>Painel de Gestão do Supermercado</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1.5 text-sky-400">
              <Smartphone className="w-4 h-4" />
              <span>Portal de Ofertas do Cliente</span>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-1.5 sm:space-x-2.5 shrink-0">
          {/* PWA Install Button */}
          <PWAInstallButton />

          {/* AI Recipe Button - Visible only in Client view / for Client role */}
          {activeView !== 'manager' && currentUser?.role !== 'supermercado' && (
            <button
              id="btn-ai-recipe"
              onClick={onOpenAIRecipe}
              className="flex items-center space-x-1 sm:space-x-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-2.5 sm:px-3 py-2 sm:py-1.5 rounded-xl text-xs font-semibold shadow-md transition-all border border-purple-400/30 active:scale-95 min-h-[38px]"
              title="Gerar Receitas com Ofertas usando Inteligência Artificial"
            >
              <Sparkles className="w-4 h-4 text-yellow-300 animate-spin" style={{ animationDuration: '4s' }} />
              <span className="hidden sm:inline">Receitas</span>
            </button>
          )}

          {/* Sound Toggle Button */}
          <button
            id="btn-sound-toggle"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-xl text-slate-300 hover:text-white transition-colors border min-h-[38px] min-w-[38px] flex items-center justify-center ${
              soundEnabled ? 'border-sky-500/40 bg-sky-500/10 text-sky-400' : 'border-slate-700 bg-slate-800'
            }`}
            title={soundEnabled ? 'Som de alertas ativado' : 'Som de alertas silenciado'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-sky-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>

          {/* Active Orders Status Tracker Button - Client view only */}
          {activeView !== 'manager' && currentUser?.role !== 'supermercado' && activeOrdersCount > 0 && (
            <button
              id="btn-order-tracker"
              onClick={onOpenOrderTracker}
              className="relative flex items-center space-x-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 sm:px-2.5 py-2 sm:py-1.5 rounded-xl text-xs font-semibold hover:bg-amber-500/30 transition-all animate-pulse min-h-[38px]"
            >
              <Clock className="w-4 h-4" />
              <span className="hidden sm:inline">Pedidos ({activeOrdersCount})</span>
              <span className="sm:hidden font-bold text-[10px]">({activeOrdersCount})</span>
            </button>
          )}

          {/* Cart Drawer Trigger Button - Client view only */}
          {activeView !== 'manager' && currentUser?.role !== 'supermercado' && (
            <button
              id="btn-cart-drawer"
              onClick={onOpenCart}
              className="relative flex items-center space-x-1.5 sm:space-x-2 bg-sky-500 hover:bg-sky-400 text-white px-2.5 sm:px-3.5 py-2 sm:py-1.5 rounded-xl text-xs font-bold shadow-lg shadow-sky-500/25 transition-all active:scale-95 min-h-[38px]"
            >
              <ShoppingBag className="w-4 h-4" />
              <span className="hidden sm:inline">Carrinho</span>
              {cartCount > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center shadow-md">
                  {cartCount}
                </span>
              )}
              {cartTotal > 0 && (
                <span className="text-sky-100 font-semibold text-xs border-l border-sky-400/50 pl-1.5 hidden sm:inline">
                  R$ {cartTotal.toFixed(2)}
                </span>
              )}
            </button>
          )}
        </div>

      </div>
    </header>
  );
};
