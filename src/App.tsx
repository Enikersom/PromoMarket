/**
 * PromoMarket - Sistema de Promoções de Supermercado em Tempo Real
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { BannerCarousel } from './components/BannerCarousel';
import { DigitalEncarteViewer } from './components/DigitalEncarteViewer';
import { CartDrawer } from './components/CartDrawer';
import { ManagerDashboard } from './components/ManagerDashboard';
import { SplitViewLayout } from './components/SplitViewLayout';
import { LiveNotificationToast } from './components/LiveNotificationToast';
import { OrderTrackerModal } from './components/OrderTrackerModal';
import { AIRecipeModal } from './components/AIRecipeModal';
import { LoginScreen } from './components/LoginScreen';
import { AdminGeneralDashboard } from './components/AdminGeneralDashboard';
import { playNotificationSound } from './utils/sound';
import { PromotionItem, Encarte, Order, CartItem, RealtimeEvent, OrderStatus, UserProfile, SupermarketDetails } from './types';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('promoMarketUser');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [activeView, setActiveView] = useState<'client' | 'manager' | 'split'>(() => {
    try {
      const saved = localStorage.getItem('promoMarketUser');
      if (saved) {
        const parsed: UserProfile = JSON.parse(saved);
        return parsed.role === 'supermercado' ? 'manager' : 'client';
      }
    } catch {}
    return 'client';
  });

  const [promotions, setPromotions] = useState<PromotionItem[]>([]);
  const [encartes, setEncartes] = useState<Encarte[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [supermarkets, setSupermarkets] = useState<SupermarketDetails[]>([]);

  // Selected supermarket for customer views (synchronizes banner and catalog isolation)
  const [selectedSupermarketId, setSelectedSupermarketId] = useState<string | 'all'>(() => {
    try {
      const saved = localStorage.getItem('promoMarketUser');
      if (saved) {
        const parsed: UserProfile = JSON.parse(saved);
        const boundStore = parsed.registeredSupermarketId || (parsed.role === 'cliente' ? parsed.supermercadoId : undefined);
        if (parsed.role === 'cliente' && boundStore) {
          return boundStore;
        }
      }
      const params = new URLSearchParams(window.location.search);
      const storeParam = params.get('store') || params.get('supermarket') || params.get('tenant') || params.get('id') || params.get('loja') || params.get('teste');
      if (storeParam) return storeParam;
    } catch (e) {}
    return 'all';
  });

  // Sync selectedSupermarketId with browser URL query params
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (selectedSupermarketId && selectedSupermarketId !== 'all') {
        url.searchParams.set('store', selectedSupermarketId);
      } else {
        url.searchParams.delete('store');
      }
      window.history.replaceState({}, '', url.toString());
    } catch (e) {}
  }, [selectedSupermarketId]);

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const storeParam = params.get('store') || params.get('supermarket') || params.get('tenant') || params.get('id') || params.get('loja');
        setSelectedSupermarketId(storeParam || 'all');
      } catch (e) {}
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Modals & UI States
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isAIRecipeOpen, setIsAIRecipeOpen] = useState(false);
  const [isOrderTrackerOpen, setIsOrderTrackerOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [latestEvent, setLatestEvent] = useState<RealtimeEvent | null>(null);

  // Synchronize active view based on user role
  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === 'supermercado') {
        setActiveView('manager');
      } else {
        setActiveView('client');
      }
    }
  }, [currentUser]);

  // User Auth Handlers
  const handleUserLogin = (user: UserProfile) => {
    setCurrentUser(user);
    localStorage.setItem('promoMarketUser', JSON.stringify(user));
    setActiveView(user.role === 'supermercado' ? 'manager' : 'client');

    const boundStore = user.registeredSupermarketId || (user.role === 'cliente' ? user.supermercadoId : undefined);
    if (user.role === 'cliente' && boundStore) {
      setSelectedSupermarketId(boundStore);
    } else if (user.role === 'supermercado' && user.supermercadoId) {
      setSelectedSupermarketId(user.supermercadoId);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('promoMarketUser');
  };

  // Initial Fetch Data
  useEffect(() => {
    fetch('/api/promotions')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const unique = Array.from(new Map<string, PromotionItem>(data.map((item: PromotionItem) => [item.id, item])).values());
          setPromotions(unique);
        }
      })
      .catch((err) => console.error('Error loading promotions:', err));

    fetch('/api/encartes')
      .then((res) => res.json())
      .then((data) => setEncartes(data))
      .catch((err) => console.error('Error loading encartes:', err));

    fetch('/api/orders')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const unique = Array.from(new Map<string, Order>(data.map((item: Order) => [item.id, item])).values());
          setOrders(unique);
        }
      })
      .catch((err) => console.error('Error loading orders:', err));

    fetch('/api/supermarkets')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setSupermarkets(data);
        }
      })
      .catch((err) => console.error('Error loading supermarkets:', err));
  }, []);

  // SSE Real-time Subscription
  useEffect(() => {
    let eventSource: EventSource | null = null;

    function connectSSE() {
      eventSource = new EventSource('/api/events');

      eventSource.onopen = () => {
        setIsConnected(true);
      };

      eventSource.onmessage = (e) => {
        try {
          const parsed: RealtimeEvent = JSON.parse(e.data);
          if (parsed.type === 'CONNECTED') return;

          setLatestEvent(parsed);

          // Audio chime & state updates based on event type
          if (parsed.type === 'ORDER_CREATED') {
            if (soundEnabled) playNotificationSound('order');
            setOrders((prev) => [parsed.data, ...prev.filter((o) => o.id !== parsed.data.id)]);
          } else if (parsed.type === 'PROMOTION_CREATED') {
            if (soundEnabled) playNotificationSound('deal');
            setPromotions((prev) => [parsed.data, ...prev.filter((p) => p.id !== parsed.data.id)]);
          } else if (parsed.type === 'PROMOTION_UPDATED' || parsed.type === 'FLASH_BANNER_UPDATE') {
            if (soundEnabled) playNotificationSound('deal');
            setPromotions((prev) =>
              prev.map((p) => (p.id === parsed.data.id ? parsed.data : p))
            );
          } else if (parsed.type === 'PROMOTION_DELETED') {
            setPromotions((prev) => prev.filter((p) => p.id !== parsed.data.id));
          } else if (parsed.type === 'ORDER_STATUS_CHANGED') {
            if (soundEnabled) playNotificationSound('status');
            setOrders((prev) =>
              prev.map((o) => (o.id === parsed.data.id ? parsed.data : o))
            );
          } else if (parsed.type === 'ENCARTE_UPDATED') {
            if (Array.isArray(parsed.data)) {
              setEncartes(parsed.data);
            } else if (parsed.data && parsed.data.id) {
              setEncartes((prev) => {
                const idx = prev.findIndex((e) => e.id === parsed.data.id);
                if (idx >= 0) {
                  const newArr = [...prev];
                  newArr[idx] = parsed.data;
                  return newArr;
                }
                return [parsed.data, ...prev];
              });
            }
          } else if (parsed.type === 'TENANT_DELETED') {
            const delId = parsed.data?.id;
            if (delId) {
              setSupermarkets((prev) => prev.filter((s) => s.uid !== delId && s.supermercadoId !== delId));
              setPromotions((prev) => prev.filter((p) => p.supermarketId !== delId));
              setEncartes((prev) => prev.filter((e) => e.supermarketId !== delId));
            }
          } else if (parsed.type === 'TENANT_UPDATED') {
            if (parsed.data && (parsed.data.id || parsed.data.uid)) {
              const uId = parsed.data.id || parsed.data.uid;
              setSupermarkets((prev) => {
                const exists = prev.some((s) => s.uid === uId || s.supermercadoId === uId);
                if (exists) {
                  return prev.map((s) => (s.uid === uId || s.supermercadoId === uId ? { ...s, ...parsed.data } : s));
                }
                return [...prev, parsed.data];
              });
            }
          }
        } catch (err) {
          console.error('Error handling SSE message:', err);
        }
      };

      eventSource.onerror = () => {
        setIsConnected(false);
        eventSource?.close();
        setTimeout(connectSSE, 3000);
      };
    }

    connectSSE();

    return () => {
      eventSource?.close();
    };
  }, [soundEnabled]);

  // Cart Operations
  const handleAddToCart = (item: PromotionItem) => {
    setCartItems((prev) => {
      const existingIndex = prev.findIndex((ci) => ci.item.id === item.id);
      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex].quantity += 1;
        return updated;
      }
      return [...prev, { item, quantity: 1 }];
    });
  };

  const handleUpdateQuantity = (itemId: string, newQty: number) => {
    if (newQty <= 0) {
      setCartItems((prev) => prev.filter((ci) => ci.item.id !== itemId));
    } else {
      setCartItems((prev) =>
        prev.map((ci) => (ci.item.id === itemId ? { ...ci, quantity: newQty } : ci))
      );
    }
  };

  const handleClearCart = () => {
    setCartItems([]);
  };

  const cartCount = cartItems.reduce((acc, ci) => acc + ci.quantity, 0);
  const cartTotal = cartItems.reduce((acc, ci) => acc + ci.item.promoPrice * ci.quantity, 0);
  const cartQuantitiesMap = cartItems.reduce<Record<string, number>>((map, ci) => {
    map[ci.item.id] = ci.quantity;
    return map;
  }, {});

  // Manager Handlers
  const handleAddPromotion = async (promoData: Partial<PromotionItem>) => {
    const res = await fetch('/api/promotions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(promoData)
    });
    if (res.ok) {
      const created = await res.json();
      setPromotions((prev) => [created, ...prev.filter((p) => p.id !== created.id)]);
    }
  };

  const handleToggleBanner = async (id: string) => {
    const res = await fetch(`/api/promotions/${id}/toggle-banner`, {
      method: 'POST'
    });
    if (res.ok) {
      const updated = await res.json();
      setPromotions((prev) => prev.map((p) => (p.id === id ? updated : p)));
    }
  };

  const handleDeletePromotion = async (id: string) => {
    const res = await fetch(`/api/promotions/${id}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      setPromotions((prev) => prev.filter((p) => p.id !== id));
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, status: OrderStatus) => {
    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (res.ok) {
      const updated = await res.json();
      setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
    }
  };

  const handleSaveEncarte = async (encarteData: Partial<Encarte>) => {
    const res = await fetch('/api/encartes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(encarteData)
    });
    if (res.ok) {
      const saved = await res.json();
      setEncartes((prev) => {
        const idx = prev.findIndex((e) => e.id === saved.id);
        if (idx >= 0) {
          const newArr = [...prev];
          newArr[idx] = saved;
          return newArr;
        }
        return [saved, ...prev];
      });
    }
  };

  const bannerPromotions = promotions.filter((p) => p.isBanner);

  // If user is not authenticated, show Google Auth Login Screen
  if (!currentUser) {
    return (
      <LoginScreen 
        onLogin={handleUserLogin} 
        storeParam={selectedSupermarketId !== 'all' ? selectedSupermarketId : undefined}
        supermarkets={supermarkets}
      />
    );
  }

  // If user is Admin Geral, show Admin Dashboard
  if (currentUser.role === 'admin') {
    return <AdminGeneralDashboard onLogout={handleLogout} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-sky-500 selection:text-white">
      {/* Header */}
      <Header
        activeView={activeView}
        setActiveView={setActiveView}
        cartCount={cartCount}
        cartTotal={cartTotal}
        onOpenCart={() => setIsCartOpen(true)}
        onOpenAIRecipe={() => setIsAIRecipeOpen(true)}
        onOpenOrderTracker={() => setIsOrderTrackerOpen(true)}
        activeOrdersCount={orders.filter((o) => o.status !== 'completed' && o.status !== 'cancelled').length}
        soundEnabled={soundEnabled}
        setSoundEnabled={setSoundEnabled}
        isConnected={isConnected}
        latestEventMessage={latestEvent?.message}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Main Container */}
      {(() => {
        const isClientStoreLocked = currentUser?.role === 'cliente' && Boolean(currentUser.registeredSupermarketId || currentUser.supermercadoId);
        const effectiveStoreId = isClientStoreLocked 
          ? (currentUser.registeredSupermarketId || currentUser.supermercadoId!) 
          : selectedSupermarketId;
        const effectiveOnSelectSupermarket = isClientStoreLocked ? undefined : setSelectedSupermarketId;

        return (
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
            {activeView === 'client' && (
              <>
                {/* Top Banner do Dia Carousel - Isolated per supermarket */}
                <BannerCarousel
                  banners={bannerPromotions}
                  supermarkets={supermarkets}
                  selectedSupermarketId={effectiveStoreId}
                  onSelectSupermarket={effectiveOnSelectSupermarket}
                  onAddToCart={handleAddToCart}
                />

                {/* Digital Encarte Viewer */}
                <DigitalEncarteViewer
                  promotions={promotions}
                  encartes={encartes}
                  supermarkets={supermarkets}
                  selectedSupermarketId={effectiveStoreId}
                  onSelectSupermarket={effectiveOnSelectSupermarket}
                  isStoreLocked={isClientStoreLocked}
                  onAddToCart={handleAddToCart}
                  cartQuantities={cartQuantitiesMap}
                />
              </>
            )}

        {activeView === 'manager' && (
          <ManagerDashboard
            promotions={promotions}
            orders={orders}
            encartes={encartes}
            currentUser={currentUser}
            onAddPromotion={handleAddPromotion}
            onToggleBanner={handleToggleBanner}
            onDeletePromotion={handleDeletePromotion}
            onUpdateOrderStatus={handleUpdateOrderStatus}
            onSaveEncarte={handleSaveEncarte}
          />
        )}

        {activeView === 'split' && (
          <SplitViewLayout
            promotions={promotions}
            encartes={encartes}
            orders={orders}
            supermarkets={supermarkets}
            currentUser={currentUser}
            onAddToCart={handleAddToCart}
            cartQuantities={cartQuantitiesMap}
            onAddPromotion={handleAddPromotion}
            onToggleBanner={handleToggleBanner}
            onDeletePromotion={handleDeletePromotion}
            onUpdateOrderStatus={handleUpdateOrderStatus}
            onSaveEncarte={handleSaveEncarte}
          />
        )}
      </main>
        );
      })()}

      {/* Modals & Toasts */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cartItems}
        onUpdateQuantity={handleUpdateQuantity}
        onClearCart={handleClearCart}
        onOrderPlaced={(newOrder) => {
          setOrders((prev) => [newOrder, ...prev.filter((o) => o.id !== newOrder.id)]);
        }}
      />

      <OrderTrackerModal
        isOpen={isOrderTrackerOpen}
        onClose={() => setIsOrderTrackerOpen(false)}
        orders={orders}
      />

      <AIRecipeModal
        isOpen={isAIRecipeOpen}
        onClose={() => setIsAIRecipeOpen(false)}
        promotions={promotions}
        onAddToCart={handleAddToCart}
      />

      <LiveNotificationToast
        event={latestEvent}
        onClose={() => setLatestEvent(null)}
      />
    </div>
  );
}
