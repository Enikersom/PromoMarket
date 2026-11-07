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
import { findSupermarketMatch, getStoreFromUrl } from './utils/supermarket';
import { PromotionItem, Encarte, Order, CartItem, RealtimeEvent, OrderStatus, UserProfile, SupermarketDetails } from './types';
import { 
  subscribeToPromotions, 
  subscribeToOrders, 
  subscribeToTenants,
  getTenantsFromFirestore, 
  getEncartesFromFirestore,
  savePromotionToFirestore,
  updatePromotionInFirestore,
  deletePromotionFromFirestore,
  updateOrderStatusInFirestore,
  saveEncarteToFirestore
} from './lib/firebase';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    try {
      // Clear all cached storage to guarantee the neutral login screen always appears on launch
      localStorage.removeItem('promoMarketLastStore');
      localStorage.removeItem('promoMarketUser');
      sessionStorage.removeItem('promoMarketUser');
      sessionStorage.removeItem('promoMarketAdminUser');
    } catch {
      // Ignore storage errors
    }
    return null;
  });

  // Track original Admin Geral session when impersonating or inspecting supermarket stores
  const [adminSession, setAdminSession] = useState<UserProfile | null>(() => {
    try {
      const saved = sessionStorage.getItem('promoMarketAdminUser');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return null;
  });

  const [activeView, setActiveView] = useState<'client' | 'manager' | 'split'>(() => {
    try {
      const saved = sessionStorage.getItem('promoMarketUser');
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
  const [supermarkets, setSupermarkets] = useState<SupermarketDetails[]>(() => {
    try {
      const savedMap = localStorage.getItem('promoMarketTenantsCustomMap');
      if (savedMap) {
        const parsed = JSON.parse(savedMap);
        const list = Object.values(parsed) as SupermarketDetails[];
        if (list.length > 0) return list;
      }
    } catch {}
    return [];
  });

  // Selected supermarket for customer views (synchronizes banner and catalog isolation)
  const [selectedSupermarketId, setSelectedSupermarketId] = useState<string | 'all'>(() => {
    try {
      // ONLY if explicitly specified in URL query parameter (e.g. ?store=xyz)
      const storeParam = getStoreFromUrl();
      if (storeParam) return storeParam;
    } catch (e) {}
    return 'all';
  });

  // Re-resolve selectedSupermarketId once supermarkets list is loaded (handles slug names or IDs)
  useEffect(() => {
    if (supermarkets.length > 0 && selectedSupermarketId !== 'all') {
      const match = findSupermarketMatch(supermarkets, selectedSupermarketId);
      if (match) {
        const canonicalId = match.supermercadoId || match.uid;
        if (canonicalId && canonicalId !== selectedSupermarketId) {
          setSelectedSupermarketId(canonicalId);
        }
      }
    }
  }, [supermarkets, selectedSupermarketId]);

  // Sync selectedSupermarketId with browser URL query params ONLY when user is authenticated
  useEffect(() => {
    try {
      if (!currentUser) return; // Never mutate URL on neutral login screen!

      const url = new URL(window.location.href);
      if (selectedSupermarketId && selectedSupermarketId !== 'all') {
        url.searchParams.set('store', selectedSupermarketId);
      } else {
        url.searchParams.delete('store');
      }
      window.history.replaceState({}, '', url.toString());
    } catch (e) {}
  }, [selectedSupermarketId, currentUser]);

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

  // Dynamic SEO & Meta Tags (Title, Description, OpenGraph tags)
  useEffect(() => {
    try {
      const activeStore = supermarkets.find(
        s => s.uid === selectedSupermarketId || s.supermercadoId === selectedSupermarketId
      );

      let title = "PromoMarket - Promoções de Supermercado";
      let desc = "Sistema de promoções de supermercado em tempo real com Painel do Gestor e Aplicativo do Cliente sincronizados.";
      let ogTitle = title;
      let ogDesc = desc;
      let ogImage = "/pwa-512x512.png";

      if (activeView === 'admin') {
        title = "Painel do Administrador Geral | PromoMarket";
        desc = "Gestão global de inquilinos, contratos, faturamento e segurança do sistema PromoMarket.";
        ogTitle = title;
        ogDesc = desc;
      } else if (activeView === 'manager') {
        const storeName = currentUser?.nomeFantasia || activeStore?.nomeFantasia || "Gestão da Loja";
        title = `${storeName} | Painel do Gestor - PromoMarket`;
        desc = `Painel de controle para ${storeName}: acompanhe pedidos ao vivo, configure encarte digital e gerencie promoções.`;
        ogTitle = title;
        ogDesc = desc;
      } else if (activeStore) {
        const storeName = activeStore.nomeFantasia || activeStore.razaoSocial || "Supermercado";
        title = `${storeName} | Encarte Digital & Promoções da Semana`;
        desc = `Confira as melhores ofertas e encarte digital do ${storeName}. Preços baixos e economia para você!`;
        ogTitle = `${storeName} - Ofertas e Encarte Digital`;
        ogDesc = desc;
        if (activeStore.logoUrl) {
          ogImage = activeStore.logoUrl;
        } else if (activeStore.splashImageUrl) {
          ogImage = activeStore.splashImageUrl;
        }
      }

      document.title = title;

      // Update meta tags dynamically
      const updateMeta = (selector: string, attr: string, value: string) => {
        let el = document.querySelector(selector);
        if (!el) {
          el = document.createElement('meta');
          if (selector.startsWith('meta[name=')) {
            const name = selector.match(/name="([^"]+)"/)?.[1];
            if (name) el.setAttribute('name', name);
          } else if (selector.startsWith('meta[property=')) {
            const prop = selector.match(/property="([^"]+)"/)?.[1];
            if (prop) el.setAttribute('property', prop);
          }
          document.head.appendChild(el);
        }
        el.setAttribute(attr, value);
      };

      updateMeta('meta[name="description"]', 'content', desc);
      updateMeta('meta[property="og:title"]', 'content', ogTitle);
      updateMeta('meta[property="og:description"]', 'content', ogDesc);
      updateMeta('meta[property="og:image"]', 'content', ogImage);
    } catch (e) {
      console.warn("Could not update meta tags:", e);
    }
  }, [activeView, selectedSupermarketId, supermarkets, currentUser]);

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
    try {
      sessionStorage.setItem('promoMarketUser', JSON.stringify(user));
      localStorage.removeItem('promoMarketUser');
      localStorage.removeItem('promoMarketLastStore');
    } catch (e) {}

    setActiveView(user.role === 'supermercado' ? 'manager' : 'client');

    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const storeParam = params ? (params.get('store') || params.get('supermarket') || params.get('loja')) : null;

    if (storeParam) {
      setSelectedSupermarketId(storeParam);
    } else {
      const boundStore = user.registeredSupermarketId || (user.role === 'cliente' ? user.supermercadoId : undefined);
      if (user.role === 'cliente' && boundStore) {
        setSelectedSupermarketId(boundStore);
      } else if (user.role === 'supermercado' && user.supermercadoId) {
        setSelectedSupermarketId(user.supermercadoId);
      }
    }
  };

  const handleLogout = () => {
    // Complete clean reset to neutral login screen
    setCurrentUser(null);
    setAdminSession(null);
    setSelectedSupermarketId('all');

    try {
      localStorage.removeItem('promoMarketUser');
      sessionStorage.removeItem('promoMarketUser');
      localStorage.removeItem('promoMarketLastStore');
      sessionStorage.removeItem('promoMarketAdminUser');

      const url = new URL(window.location.href);
      url.searchParams.delete('store');
      url.searchParams.delete('supermarket');
      url.searchParams.delete('loja');
      url.searchParams.delete('tenant');
      url.searchParams.delete('id');
      url.searchParams.delete('tab');
      url.searchParams.delete('aba');
      url.searchParams.delete('action');
      window.history.replaceState({}, '', url.pathname);
    } catch (e) {}
  };

  // Initial Fetch Data & Real-time Subscriptions
  useEffect(() => {
    // 1. Inscrições em tempo real no Firestore (funciona no Netlify e localmente)
    const unsubPromos = subscribeToPromotions((data) => {
      if (Array.isArray(data)) {
        setPromotions(data);
      }
    });

    const unsubOrders = subscribeToOrders((data) => {
      if (Array.isArray(data)) {
        setOrders(data);
      }
    });

    const unsubTenants = subscribeToTenants((data) => {
      if (Array.isArray(data)) {
        try {
          const savedMap = JSON.parse(localStorage.getItem('promoMarketTenantsCustomMap') || '{}');
          const merged = data.map((item) => {
            const key = item.supermercadoId || item.uid;
            return key && savedMap[key] ? { ...item, ...savedMap[key] } : item;
          });
          setSupermarkets(merged);
        } catch {
          setSupermarkets(data);
        }
      }
    });

    // 2. Busca direta no Firestore para Encartes e Supermercados
    getEncartesFromFirestore().then((encs) => {
      if (encs && encs.length > 0) setEncartes(encs);
    }).catch(() => {});

    getTenantsFromFirestore().then((tenants) => {
      if (tenants && tenants.length > 0) {
        try {
          const savedMap = JSON.parse(localStorage.getItem('promoMarketTenantsCustomMap') || '{}');
          const merged = tenants.map((item) => {
            const key = item.supermercadoId || item.uid;
            return key && savedMap[key] ? { ...item, ...savedMap[key] } : item;
          });
          setSupermarkets(merged);
        } catch {
          setSupermarkets(tenants);
        }
      }
    }).catch(() => {});

    // 3. Consulta complementar na API local (quando o backend Node estiver ativo)
    fetch('/api/promotions')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const unique = Array.from(new Map<string, PromotionItem>(data.map((item: PromotionItem) => [item.id, item])).values());
          setPromotions(unique);
        }
      })
      .catch(() => {});

    fetch('/api/encartes')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) setEncartes(data);
      })
      .catch(() => {});

    fetch('/api/orders')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const unique = Array.from(new Map<string, Order>(data.map((item: Order) => [item.id, item])).values());
          setOrders(unique);
        }
      })
      .catch(() => {});

    fetch('/api/supermarkets')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setSupermarkets(data);
        }
      })
      .catch(() => {});

    return () => {
      unsubPromos();
      unsubOrders();
      unsubTenants();
    };
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
            const delUid = parsed.data?.uid;
            const delSuperId = parsed.data?.supermercadoId;
            const delName = (parsed.data?.name || '').trim().toLowerCase();
            const ids = new Set([delId, delUid, delSuperId].filter(Boolean));

            try {
              const savedMap = JSON.parse(localStorage.getItem('promoMarketTenantsCustomMap') || '{}');
              ids.forEach(key => { if (key) delete savedMap[key]; });
              localStorage.setItem('promoMarketTenantsCustomMap', JSON.stringify(savedMap));
            } catch (_) {}

            setSupermarkets((prev) => prev.filter((s) => {
              const sName = (s.nomeFantasia || s.razaoSocial || '').trim().toLowerCase();
              const matchId = ids.has(s.uid) || ids.has(s.supermercadoId) || ids.has((s as any).id);
              const matchName = delName && sName === delName;
              return !matchId && !matchName;
            }));
            setPromotions((prev) => prev.filter((p) => {
              const pSuper = (p.supermarketName || '').trim().toLowerCase();
              const matchId = ids.has(p.supermarketId) || ids.has((p as any).tenantId);
              const matchName = delName && pSuper === delName;
              return !matchId && !matchName;
            }));
            setEncartes((prev) => prev.filter((e) => {
              const eSuper = (e.supermarketName || '').trim().toLowerCase();
              const matchId = ids.has(e.supermarketId);
              const matchName = delName && eSuper === delName;
              return !matchId && !matchName;
            }));
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
    let created: any = null;
    try {
      const res = await fetch('/api/promotions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(promoData)
      });
      if (res.ok) {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          created = await res.json();
        }
      }
    } catch (e) {}

    // Fallback direto no Firestore (essencial no Netlify)
    if (!created) {
      created = await savePromotionToFirestore(promoData as any);
    }

    if (created) {
      setPromotions((prev) => [created, ...prev.filter((p) => p.id !== created.id)]);
    }
  };

  const handleToggleBanner = async (id: string) => {
    const item = promotions.find(p => p.id === id);
    const newIsBanner = !item?.isBanner;

    try {
      await fetch(`/api/promotions/${id}/toggle-banner`, {
        method: 'POST'
      });
    } catch (e) {}

    await updatePromotionInFirestore(id, { isBanner: newIsBanner });
    setPromotions((prev) => prev.map((p) => (p.id === id ? { ...p, isBanner: newIsBanner } : p)));
  };

  const handleDeletePromotion = async (id: string) => {
    // 1. Atualização otimista imediata na interface
    setPromotions((prev) => prev.filter((p) => p.id !== id));

    // 2. Exclusão via API backend
    try {
      await fetch(`/api/promotions/${id}`, {
        method: 'DELETE'
      });
    } catch (e) {
      console.warn('Erro ao excluir promoção via API:', e);
    }

    // 3. Exclusão direta no Firestore
    try {
      await deletePromotionFromFirestore(id);
    } catch (e) {
      console.warn('Erro ao excluir promoção no Firestore:', e);
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, status: OrderStatus) => {
    try {
      await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
    } catch (e) {}

    await updateOrderStatusInFirestore(orderId, status);
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));
  };

  const handleSaveEncarte = async (encarteData: Partial<Encarte>) => {
    let saved: any = null;
    try {
      const res = await fetch('/api/encartes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(encarteData)
      });
      if (res.ok) {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          saved = await res.json();
        }
      }
    } catch (e) {}

    // Fallback direto no Firestore (essencial no Netlify)
    if (!saved) {
      const encId = encarteData.id || `encarte-${Date.now()}`;
      saved = await saveEncarteToFirestore({
        id: encId,
        title: encarteData.title || "Encarte Oficial",
        subtitle: encarteData.subtitle || "Confira os destaques da semana",
        startDate: encarteData.startDate || new Date().toLocaleDateString('pt-BR'),
        endDate: encarteData.endDate || new Date(Date.now() + 7 * 86400000).toLocaleDateString('pt-BR'),
        coverImage: encarteData.coverImage || "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80",
        active: true,
        items: encarteData.items || promotions,
        pagesCount: Math.ceil(Math.max(1, (encarteData.items || promotions).length) / 4),
        supermarketId: encarteData.supermarketId,
        supermarketName: encarteData.supermarketName
      });
    }

    if (saved) {
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

  // Check if current URL explicitly targets a specific supermarket
  const explicitStoreInUrl = getStoreFromUrl();
  const hasExplicitStoreInUrl = Boolean(explicitStoreInUrl);

  // If user is not authenticated or an admin is viewing an explicit supermarket store link, show Supermarket Login / Cadastro Screen
  if (!currentUser || (currentUser.role === 'admin' && hasExplicitStoreInUrl)) {
    return (
      <LoginScreen 
        onLogin={handleUserLogin} 
        storeParam={explicitStoreInUrl || undefined}
        supermarkets={supermarkets}
        onClearStoreParam={() => {
          setSelectedSupermarketId('all');
          try {
            const url = new URL(window.location.href);
            url.searchParams.delete('store');
            url.searchParams.delete('supermarket');
            url.searchParams.delete('loja');
            url.searchParams.delete('tenant');
            url.searchParams.delete('id');
            window.history.replaceState({}, '', url.pathname);
          } catch (e) {}
        }}
      />
    );
  }

  // If user is Admin Geral, show Admin Dashboard
  if (currentUser.role === 'admin') {
    return (
      <AdminGeneralDashboard 
        onLogout={handleLogout} 
        onManageSupermarket={(superId) => {
          const found = supermarkets.find(s => s.uid === superId || s.supermercadoId === superId || (s as any).id === superId);
          const sName = found?.nomeFantasia || found?.razaoSocial || 'Supermercado';
          const managerProfile: UserProfile = {
            uid: found?.uid || found?.supermercadoId || superId,
            nome: sName,
            email: (found as any)?.email || `${superId}@supermercado.com`,
            role: 'supermercado',
            supermercadoId: found?.supermercadoId || found?.uid || superId,
            cadastroCompleto: true,
            nomeFantasia: found?.nomeFantasia || sName,
            razaoSocial: found?.razaoSocial,
            cnpj: found?.cnpj,
            logoUrl: found?.logoUrl,
            splashImageUrl: found?.splashImageUrl,
            primaryColor: found?.primaryColor,
            secondaryColor: found?.secondaryColor,
            horarioSegSex: found?.horarioSegSex,
            horarioSabado: found?.horarioSabado,
            horarioDomingo: found?.horarioDomingo,
            horarioObservacoes: found?.horarioObservacoes
          };
          setSelectedSupermarketId(managerProfile.supermercadoId!);
          handleUserLogin(managerProfile);
        }}
      />
    );
  }

  const activeSupermarketForHeader = supermarkets.find(
    s => s.uid === selectedSupermarketId || s.supermercadoId === selectedSupermarketId
  ) || (currentUser?.role === 'supermercado' ? (currentUser as any) : undefined);

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
        currentStore={activeSupermarketForHeader}
        onLogout={handleLogout}
      />

      {/* Main Container */}
      {(() => {
        const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
        const hasExplicitStoreInUrl = Boolean(params && (params.get('store') || params.get('supermarket') || params.get('loja') || params.get('tenant')));
        const isClientStoreLocked = !hasExplicitStoreInUrl && currentUser?.role === 'cliente' && Boolean(currentUser.registeredSupermarketId || currentUser.supermercadoId);
        const effectiveStoreId = isClientStoreLocked 
          ? (currentUser.registeredSupermarketId || currentUser.supermercadoId!) 
          : selectedSupermarketId;
        const effectiveOnSelectSupermarket = isClientStoreLocked ? undefined : setSelectedSupermarketId;

        return (
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
            {activeView === 'client' && (
              <>
                {/* Visual confirmation when arriving via QR Code of a specific supermarket */}
                {(() => {
                  if (!hasExplicitStoreInUrl || effectiveStoreId === 'all') return null;
                  const matchedStore = findSupermarketMatch(supermarkets, effectiveStoreId);
                  if (!matchedStore) return null;

                  return (
                    <div className="mb-6 p-4 bg-gradient-to-r from-emerald-950/60 via-slate-900 to-slate-950 border border-emerald-500/40 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
                      <div className="flex items-center space-x-3">
                        {matchedStore.logoUrl ? (
                          <img 
                            src={matchedStore.logoUrl} 
                            alt={matchedStore.nomeFantasia} 
                            className="w-10 h-10 rounded-xl object-contain bg-slate-900 border border-slate-700 p-1 shrink-0" 
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-black text-xs shrink-0">
                            QR
                          </div>
                        )}
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30">
                              Acessado via QR Code
                            </span>
                            <span className="text-xs text-slate-400 font-medium">Catálogo Exclusivo</span>
                          </div>
                          <h3 className="text-sm sm:text-base font-extrabold text-white">
                            Você está navegando em: <span className="text-emerald-300">{matchedStore.nomeFantasia}</span>
                          </h3>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSupermarketId('all');
                          try {
                            const url = new URL(window.location.href);
                            url.searchParams.delete('store');
                            url.searchParams.delete('supermarket');
                            url.searchParams.delete('loja');
                            window.history.replaceState({}, '', url.toString());
                          } catch (e) {}
                        }}
                        className="text-xs font-bold text-slate-300 hover:text-white px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-xl transition-all border border-slate-700 shrink-0 self-end sm:self-center cursor-pointer"
                      >
                        Ver Todas as Lojas
                      </button>
                    </div>
                  );
                })()}

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
            targetSupermarket={supermarkets.find(s => s.uid === (currentUser?.supermercadoId || currentUser?.uid) || s.supermercadoId === (currentUser?.supermercadoId || currentUser?.uid)) || (currentUser as any)}
            isAdminImpersonating={Boolean(adminSession)}
            onReturnToAdmin={() => {
              if (adminSession) {
                setCurrentUser(adminSession);
                setActiveView('client');
              }
            }}
            onLogout={handleLogout}
            onAddPromotion={handleAddPromotion}
            onToggleBanner={handleToggleBanner}
            onDeletePromotion={handleDeletePromotion}
            onUpdateOrderStatus={handleUpdateOrderStatus}
            onSaveEncarte={handleSaveEncarte}
            onUpdateSupermarket={(updated) => {
              const targetId = updated.uid || updated.supermercadoId;
              if (targetId) {
                try {
                  const existingMap = JSON.parse(localStorage.getItem('promoMarketTenantsCustomMap') || '{}');
                  existingMap[targetId] = { ...(existingMap[targetId] || {}), ...updated };
                  localStorage.setItem('promoMarketTenantsCustomMap', JSON.stringify(existingMap));
                } catch (_) {}
              }
              setSupermarkets((prev) => {
                const exists = prev.some((s) => s.uid === targetId || s.supermercadoId === targetId);
                if (exists) {
                  return prev.map((s) => (s.uid === targetId || s.supermercadoId === targetId) ? { ...s, ...updated } : s);
                }
                return [updated, ...prev];
              });
            }}
            onUpdateUser={(updatedUser) => setCurrentUser(updatedUser)}
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
