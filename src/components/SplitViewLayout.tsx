import React from 'react';
import { Store, Smartphone, Zap } from 'lucide-react';
import { ManagerDashboard } from './ManagerDashboard';
import { BannerCarousel } from './BannerCarousel';
import { DigitalEncarteViewer } from './DigitalEncarteViewer';
import { PromotionItem, Encarte, Order, OrderStatus, UserProfile, SupermarketDetails } from '../types';

interface SplitViewLayoutProps {
  promotions: PromotionItem[];
  encartes: Encarte[];
  orders: Order[];
  supermarkets?: SupermarketDetails[];
  currentUser?: UserProfile | null;
  onAddToCart: (item: PromotionItem) => void;
  cartQuantities: Record<string, number>;
  onAddPromotion: (promo: Partial<PromotionItem>) => Promise<void>;
  onToggleBanner: (id: string) => Promise<void>;
  onDeletePromotion: (id: string) => Promise<void>;
  onUpdateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  onSaveEncarte?: (encarte: Partial<Encarte>) => Promise<void>;
}

export const SplitViewLayout: React.FC<SplitViewLayoutProps> = ({
  promotions,
  encartes,
  orders,
  supermarkets = [],
  currentUser,
  onAddToCart,
  cartQuantities,
  onAddPromotion,
  onToggleBanner,
  onDeletePromotion,
  onUpdateOrderStatus,
  onSaveEncarte
}) => {
  const isSupermarketManager = currentUser?.role === 'supermercado' && currentUser?.uid;
  const managerSupermarketId = isSupermarketManager ? currentUser.uid : 'all';

  // Strictly isolate banners and promotions if viewing as a supermarket manager
  const bannerItems = promotions.filter((p) => {
    if (!p.isBanner) return false;
    if (isSupermarketManager) {
      return p.supermarketId === currentUser.uid;
    }
    return true;
  });

  const customerPromotions = isSupermarketManager
    ? promotions.filter((p) => p.supermarketId === currentUser.uid)
    : promotions;

  return (
    <div className="space-y-4 my-4">
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-sky-950 p-4 rounded-2xl border border-emerald-500/30 text-white flex items-center justify-between text-xs font-medium shadow-xl">
        <div className="flex items-center space-x-2">
          <Zap className="w-5 h-5 text-emerald-400 animate-bounce" />
          <div>
            <span className="font-bold text-emerald-300">Modo Sincronizado Lado a Lado (Dual View):</span>
            <span className="text-slate-300 ml-1">
              {isSupermarketManager 
                ? `Altere ofertas no painel do seu supermercado (à esquerda) e veja a tela exclusiva do cliente (à direita) atualizar instantaneamente!`
                : `Altere qualquer oferta no Painel do Gestor (à esquerda) e veja a tela do Cliente (à direita) atualizar instantaneamente!`}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Manager Panel */}
        <div className="space-y-4">
          <div className="bg-blue-600/20 border border-blue-500/30 px-4 py-2 rounded-xl flex items-center space-x-2 text-blue-300 text-xs font-bold uppercase">
            <Store className="w-4 h-4" />
            <span>PAINEL DO GESTOR ({currentUser?.nomeFantasia || currentUser?.nome || 'SUPERMERCADO'})</span>
          </div>
          <ManagerDashboard
            promotions={promotions}
            orders={orders}
            encartes={encartes}
            currentUser={currentUser}
            onAddPromotion={onAddPromotion}
            onToggleBanner={onToggleBanner}
            onDeletePromotion={onDeletePromotion}
            onUpdateOrderStatus={onUpdateOrderStatus}
            onSaveEncarte={onSaveEncarte}
          />
        </div>

        {/* Right Column: Customer App View */}
        <div className="space-y-4">
          <div className="bg-sky-500/20 border border-sky-500/30 px-4 py-2 rounded-xl flex items-center space-x-2 text-sky-300 text-xs font-bold uppercase">
            <Smartphone className="w-4 h-4" />
            <span>APLICATIVO DO CLIENTE (VISÃO EM TEMPO REAL)</span>
          </div>
          <BannerCarousel 
            banners={bannerItems} 
            supermarkets={supermarkets}
            selectedSupermarketId={managerSupermarketId}
            onAddToCart={onAddToCart} 
          />
          <DigitalEncarteViewer
            promotions={customerPromotions}
            encartes={encartes}
            supermarkets={supermarkets}
            selectedSupermarketId={managerSupermarketId}
            onAddToCart={onAddToCart}
            cartQuantities={cartQuantities}
          />
        </div>
      </div>
    </div>
  );
};
