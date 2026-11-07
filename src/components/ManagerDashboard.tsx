import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Plus, 
  Store, 
  Flame, 
  Star, 
  ShoppingBag, 
  DollarSign, 
  Sparkles, 
  Trash2, 
  Edit3, 
  Check, 
  Clock, 
  Truck, 
  PackageCheck, 
  CheckCircle2, 
  AlertCircle,
  Tag,
  RefreshCw,
  Search,
  ExternalLink,
  Image as ImageIcon,
  CheckCircle,
  HelpCircle,
  BookOpen,
  Save,
  Calendar,
  QrCode,
  Copy,
  Share2,
  Download,
  Smartphone,
  Palette,
  Upload,
  Eye,
  Settings,
  Phone,
  MapPin,
  Menu,
  X,
  Volume2,
  VolumeX,
  FileSpreadsheet
} from 'lucide-react';
import { PromotionItem, Category, Order, OrderStatus, Encarte, UserProfile, SupermarketDetails } from '../types';
import { extractDirectImageUrl, getCategoryFallbackImage } from '../utils/image';
import { getStoreOperatingStatus } from '../utils/storeHours';
import { playNotificationSound } from '../utils/sound';
import { QRCodeModal } from './QRCodeModal';
import { updateTenantInFirestore, saveSupermarketDetailsToFirestore } from '../lib/firebase';
import { StoreSettingsTab } from './StoreSettingsTab';

interface ManagerDashboardProps {
  promotions: PromotionItem[];
  orders: Order[];
  encartes?: Encarte[];
  currentUser?: UserProfile | null;
  targetSupermarket?: SupermarketDetails | null;
  isAdminImpersonating?: boolean;
  onReturnToAdmin?: () => void;
  onLogout?: () => void;
  onAddPromotion: (promo: Partial<PromotionItem>) => Promise<void>;
  onToggleBanner: (id: string) => Promise<void>;
  onDeletePromotion: (id: string) => Promise<void>;
  onUpdateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  onSaveEncarte?: (encarte: Partial<Encarte>) => Promise<void>;
  onUpdateSupermarket?: (updated: SupermarketDetails) => void;
  onUpdateUser?: (user: UserProfile) => void;
}

export const ManagerDashboard: React.FC<ManagerDashboardProps> = ({
  promotions,
  orders,
  encartes = [],
  currentUser,
  targetSupermarket,
  isAdminImpersonating = false,
  onReturnToAdmin,
  onLogout,
  onAddPromotion,
  onToggleBanner,
  onDeletePromotion,
  onUpdateOrderStatus,
  onSaveEncarte,
  onUpdateSupermarket,
  onUpdateUser
}) => {
  const [activeTab, setActiveTab] = useState<'orders' | 'create' | 'banner' | 'inventory' | 'encarte' | 'qrcode' | 'settings' | 'branding'>(() => {
    try {
      const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const tabParam = params ? (params.get('tab') || params.get('aba')) : null;
      if (tabParam === 'settings' || tabParam === 'configuracoes' || tabParam === 'config' || tabParam === 'cores' || tabParam === 'horarios') {
        return 'settings';
      }
      if (tabParam === 'encarte') return 'encarte';
      if (tabParam === 'qrcode') return 'qrcode';
      if (tabParam === 'banner') return 'banner';
      if (tabParam === 'create') return 'create';
      if (tabParam === 'inventory' || tabParam === 'catalogo') return 'inventory';
    } catch (e) {}
    return 'orders';
  });
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [copiedStoreLink, setCopiedStoreLink] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Dynamic store identification based on target supermarket or current user
  const activeStoreId = targetSupermarket?.supermercadoId || targetSupermarket?.uid || currentUser?.supermercadoId || (currentUser?.role === 'supermercado' ? currentUser.uid : '') || '';
  const activeStoreName = targetSupermarket?.nomeFantasia || targetSupermarket?.razaoSocial || currentUser?.nomeFantasia || currentUser?.razaoSocial || currentUser?.nome || 'Supermercado';

  // Form State for Promotion
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<Category>('acougue');
  const [description, setDescription] = useState('');
  const [originalPrice, setOriginalPrice] = useState<number | ''>('');
  const [promoPrice, setPromoPrice] = useState<number | ''>('');
  const [unit, setUnit] = useState('un');
  const [imageUrl, setImageUrl] = useState('');
  const [isBanner, setIsBanner] = useState(false);
  const [stockQuantity, setStockQuantity] = useState<number | ''>('');
  const [badgeText, setBadgeText] = useState('');

  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [isGoogleLinkExtracted, setIsGoogleLinkExtracted] = useState(false);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);

  // Form State for Encarte
  const myEncarte = React.useMemo(() => {
    if (activeStoreId && encartes.length > 0) {
      return encartes.find(e => e.supermarketId === activeStoreId || e.id === `encarte-${activeStoreId}`);
    }
    return currentUser?.uid ? undefined : encartes[0];
  }, [activeStoreId, currentUser, encartes]);

  const currentStoreDetails = React.useMemo<SupermarketDetails>(() => {
    if (targetSupermarket) {
      return {
        ...targetSupermarket,
        supermercadoId: targetSupermarket.supermercadoId || targetSupermarket.uid || activeStoreId,
        nomeFantasia: targetSupermarket.nomeFantasia || targetSupermarket.razaoSocial || activeStoreName,
        primaryColor: targetSupermarket.primaryColor,
        secondaryColor: targetSupermarket.secondaryColor,
        splashImageUrl: targetSupermarket.splashImageUrl
      };
    }
    return {
      supermercadoId: activeStoreId,
      nomeFantasia: activeStoreName,
      razaoSocial: currentUser?.razaoSocial || activeStoreName,
      cnpj: currentUser?.cnpj || '',
      inscricaoEstadual: currentUser?.inscricaoEstadual || '',
      inscricaoMunicipal: currentUser?.inscricaoMunicipal || '',
      cidade: currentUser?.cidade || '',
      estado: currentUser?.estado || '',
      address: currentUser?.endereco || '',
      bairro: currentUser?.bairro || '',
      cep: currentUser?.cep || '',
      phone: currentUser?.telefone || '',
      logoUrl: currentUser?.logoUrl || myEncarte?.coverImage || '',
      primaryColor: (currentUser as any)?.primaryColor,
      secondaryColor: (currentUser as any)?.secondaryColor,
      splashImageUrl: (currentUser as any)?.splashImageUrl
    };
  }, [targetSupermarket, activeStoreId, activeStoreName, currentUser, myEncarte]);

  const storeDirectUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/?store=${encodeURIComponent(currentStoreDetails.supermercadoId)}`
    : `/?store=${encodeURIComponent(currentStoreDetails.supermercadoId)}`;

  const qrContainerRef = React.useRef<HTMLDivElement>(null);
  const [isQrScriptLoaded, setIsQrScriptLoaded] = useState(false);

  // Garantir carregamento da biblioteca qrcode.js via CDN
  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    if ((window as any).QRCode) {
      setIsQrScriptLoaded(true);
      return;
    }

    const existingScript = document.querySelector('script[src*="qrcode.min.js"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => setIsQrScriptLoaded(true));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
    script.async = true;
    script.onload = () => setIsQrScriptLoaded(true);
    document.head.appendChild(script);
  }, []);

  // Gerar QR Code real dinâmico na URL da loja
  const renderEncarteQrCode = React.useCallback(() => {
    if (!qrContainerRef.current) return;
    qrContainerRef.current.innerHTML = '';

    const targetUrl = storeDirectUrl || (typeof window !== 'undefined' ? window.location.href : 'https://netlify.app');

    // 1. Tentar renderizar com qrcode.js do CDN (window.QRCode)
    if (typeof window !== 'undefined' && (window as any).QRCode) {
      try {
        new (window as any).QRCode(qrContainerRef.current, {
          text: targetUrl,
          width: 192,
          height: 192,
          colorDark: '#0f172a',
          colorLight: '#ffffff',
          correctLevel: (window as any).QRCode.CorrectLevel.H
        });
        return;
      } catch (err) {
        console.warn('Fallback para gerador alternativo de QR Code:', err);
      }
    }

    // 2. Fallback resiliente usando a biblioteca QRCode importada
    import('qrcode').then((QRCodeModule) => {
      if (!qrContainerRef.current) return;
      const QRCodeLib = QRCodeModule.default || QRCodeModule;
      const canvas = document.createElement('canvas');
      canvas.width = 192;
      canvas.height = 192;
      QRCodeLib.toCanvas(canvas, targetUrl, {
        width: 192,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        },
        errorCorrectionLevel: 'H'
      }).then(() => {
        if (qrContainerRef.current) {
          qrContainerRef.current.innerHTML = '';
          qrContainerRef.current.appendChild(canvas);
        }
      }).catch(console.error);
    }).catch(console.error);
  }, [storeDirectUrl]);

  React.useEffect(() => {
    if (activeTab === 'qrcode') {
      const timer = setTimeout(() => {
        renderEncarteQrCode();
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [activeTab, storeDirectUrl, isQrScriptLoaded, renderEncarteQrCode]);

  // Função para baixar diretamente a imagem PNG real do QR Code
  const handleDownloadQrCode = () => {
    if (!qrContainerRef.current) return;

    const canvas = qrContainerRef.current.querySelector('canvas') as HTMLCanvasElement | null;
    const img = qrContainerRef.current.querySelector('img') as HTMLImageElement | null;

    let dataUrl = '';
    if (canvas) {
      dataUrl = canvas.toDataURL('image/png');
    } else if (img && img.src && img.src.startsWith('data:image')) {
      dataUrl = img.src;
    }

    if (dataUrl) {
      const link = document.createElement('a');
      const cleanStoreName = (currentStoreDetails.nomeFantasia || 'encarte')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '-');
      link.download = `qrcode-encarte-${cleanStoreName}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      setIsQrModalOpen(true);
    }
  };

  const [encarteTitle, setEncarteTitle] = useState('');
  const [encarteSubtitle, setEncarteSubtitle] = useState('');
  const [encarteStartDate, setEncarteStartDate] = useState('');
  const [encarteEndDate, setEncarteEndDate] = useState('');
  const [encarteCoverImage, setEncarteCoverImage] = useState('');
  const [isSavingEncarte, setIsSavingEncarte] = useState(false);
  const [encarteSavedSuccess, setEncarteSavedSuccess] = useState(false);

  React.useEffect(() => {
    if (myEncarte) {
      setEncarteTitle(myEncarte.title || '');
      setEncarteSubtitle(myEncarte.subtitle || '');
      setEncarteStartDate(myEncarte.startDate || new Date().toLocaleDateString('pt-BR'));
      setEncarteEndDate(myEncarte.endDate || new Date(Date.now() + 7 * 86400000).toLocaleDateString('pt-BR'));
      setEncarteCoverImage(myEncarte.coverImage || '');
    } else {
      setEncarteTitle(`Encarte de Ofertas - ${activeStoreName}`);
      setEncarteSubtitle('Ofertas imbatíveis e preços baixos toda semana!');
      setEncarteStartDate(new Date().toLocaleDateString('pt-BR'));
      setEncarteEndDate(new Date(Date.now() + 7 * 86400000).toLocaleDateString('pt-BR'));
      setEncarteCoverImage(currentStoreDetails.logoUrl || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80');
    }
  }, [myEncarte, activeStoreName, currentStoreDetails.logoUrl]);

  const handleSaveEncarteForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSaveEncarte) return;
    setIsSavingEncarte(true);
    setEncarteSavedSuccess(false);

    const targetEncarteId = myEncarte?.id || (activeStoreId ? `encarte-${activeStoreId}` : `encarte-${Date.now()}`);

    try {
      await onSaveEncarte({
        id: targetEncarteId,
        title: encarteTitle || `Encarte de Ofertas`,
        subtitle: encarteSubtitle || 'Aproveite nossas promoções!',
        startDate: encarteStartDate || new Date().toLocaleDateString('pt-BR'),
        endDate: encarteEndDate || new Date(Date.now() + 7 * 86400000).toLocaleDateString('pt-BR'),
        coverImage: extractDirectImageUrl(encarteCoverImage) || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80',
        supermarketId: activeStoreId,
        supermarketName: activeStoreName,
        active: true
      });
      setEncarteSavedSuccess(true);
      setTimeout(() => setEncarteSavedSuccess(false), 5000);
    } catch (err) {
      console.error('Error saving encarte:', err);
    } finally {
      setIsSavingEncarte(false);
    }
  };

  // Branding & Store Settings State (Logo, Cores, Horários de Funcionamento e Contato)
  const [brandLogoUrl, setBrandLogoUrl] = useState(() => targetSupermarket?.logoUrl || currentUser?.logoUrl || '');
  const [brandSplashUrl, setBrandSplashUrl] = useState(() => targetSupermarket?.splashImageUrl || (currentUser as any)?.splashImageUrl || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1080&h=1920&q=80');
  const [brandPrimaryColor, setBrandPrimaryColor] = useState(() => targetSupermarket?.primaryColor || (currentUser as any)?.primaryColor || '#16a34a');
  const [brandSecondaryColor, setBrandSecondaryColor] = useState(() => targetSupermarket?.secondaryColor || (currentUser as any)?.secondaryColor || '#f59e0b');
  const [brandTertiaryColor, setBrandTertiaryColor] = useState(() => targetSupermarket?.tertiaryColor || (currentUser as any)?.tertiaryColor || '#dc2626');
  const [brandQuaternaryColor, setBrandQuaternaryColor] = useState(() => targetSupermarket?.quaternaryColor || (currentUser as any)?.quaternaryColor || '#ffffff');
  const [brandExtraColors, setBrandExtraColors] = useState<string[]>(() => targetSupermarket?.brandColors || (currentUser as any)?.brandColors || []);

  // Horários de Funcionamento da Loja
  const [horarioSegSex, setHorarioSegSex] = useState(() => targetSupermarket?.horarioSegSex || (currentUser as any)?.horarioSegSex || '07:00 às 21:30');
  const [horarioSab, setHorarioSab] = useState(() => targetSupermarket?.horarioSab || (currentUser as any)?.horarioSab || '07:00 às 21:00');
  const [horarioDom, setHorarioDom] = useState(() => targetSupermarket?.horarioDom || (currentUser as any)?.horarioDom || '08:00 às 14:00');
  const [horarioObservacoes, setHorarioObservacoes] = useState(() => targetSupermarket?.horarioObservacoes || (currentUser as any)?.horarioObservacoes || '');
  const [horarioFuncionamento, setHorarioFuncionamento] = useState(() => targetSupermarket?.horarioFuncionamento || (currentUser as any)?.horarioFuncionamento || '');

  // Contato e Loja
  const [storePhone, setStorePhone] = useState(() => targetSupermarket?.phone || currentUser?.phone || '');
  const [storeAddress, setStoreAddress] = useState(() => targetSupermarket?.address || currentUser?.address || '');
  const [storeAceitaCompraOnline, setStoreAceitaCompraOnline] = useState<boolean>(() => {
    if (typeof targetSupermarket?.aceitaCompraOnline === 'boolean') return targetSupermarket.aceitaCompraOnline;
    if (typeof (currentUser as any)?.aceitaCompraOnline === 'boolean') return (currentUser as any).aceitaCompraOnline;
    return true;
  });

  const [isSavingBranding, setIsSavingBranding] = useState(false);
  const [brandingSavedSuccess, setBrandingSavedSuccess] = useState(false);

  React.useEffect(() => {
    const source = targetSupermarket || (currentUser as any);
    if (source) {
      if (source.logoUrl) setBrandLogoUrl(source.logoUrl);
      if (source.splashImageUrl) setBrandSplashUrl(source.splashImageUrl);
      if (source.primaryColor) setBrandPrimaryColor(source.primaryColor);
      if (source.secondaryColor) setBrandSecondaryColor(source.secondaryColor);
      if (source.tertiaryColor) setBrandTertiaryColor(source.tertiaryColor);
      if (source.quaternaryColor) setBrandQuaternaryColor(source.quaternaryColor);
      if (Array.isArray(source.brandColors)) setBrandExtraColors(source.brandColors);
      if (source.horarioSegSex) setHorarioSegSex(source.horarioSegSex);
      if (source.horarioSab) setHorarioSab(source.horarioSab);
      if (source.horarioDom) setHorarioDom(source.horarioDom);
      if (source.horarioObservacoes) setHorarioObservacoes(source.horarioObservacoes);
      if (source.horarioFuncionamento) setHorarioFuncionamento(source.horarioFuncionamento);
      if (source.phone) setStorePhone(source.phone);
      if (source.address) setStoreAddress(source.address);
      if (typeof source.aceitaCompraOnline === 'boolean') setStoreAceitaCompraOnline(source.aceitaCompraOnline);
    }
  }, [targetSupermarket, currentUser]);

  // Helper para processar e comprimir imagens carregadas da galeria do celular ou PC (Garante peso leve para o Firestore)
  const processImageFile = (
    file: File,
    maxWidth: number,
    maxHeight: number,
    onSuccess: (dataUrl: string) => void,
    format: 'image/png' | 'image/jpeg' = 'image/jpeg'
  ) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        
        // Limita as dimensões máximas preservando a proporção
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          // Compressão otimizada para caber no Firestore e Netlify sem estourar o limite de 1MB
          let quality = 0.75;
          let dataUrl = canvas.toDataURL('image/jpeg', quality);
          if (dataUrl.length > 300000) {
            quality = 0.60;
            dataUrl = canvas.toDataURL('image/jpeg', quality);
          }
          onSuccess(dataUrl);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSavingBranding(true);
    setBrandingSavedSuccess(false);

    const consolidatedHorario = horarioFuncionamento.trim() || 
      `Seg a Sex: ${horarioSegSex} • Sáb: ${horarioSab} • Dom: ${horarioDom}`;

    const updates: Partial<SupermarketDetails> = {
      logoUrl: brandLogoUrl || brandSplashUrl,
      splashImageUrl: brandSplashUrl,
      primaryColor: brandPrimaryColor,
      secondaryColor: brandSecondaryColor,
      tertiaryColor: brandTertiaryColor,
      quaternaryColor: brandQuaternaryColor,
      brandColors: brandExtraColors,
      horarioSegSex,
      horarioSab,
      horarioDom,
      horarioObservacoes,
      horarioFuncionamento: consolidatedHorario,
      phone: storePhone,
      address: storeAddress,
      aceitaCompraOnline: storeAceitaCompraOnline
    };

    try {
      if (activeStoreId) {
        await updateTenantInFirestore(activeStoreId, updates);
        await saveSupermarketDetailsToFirestore(activeStoreId, {
          razaoSocial: currentStoreDetails.razaoSocial,
          nomeFantasia: currentStoreDetails.nomeFantasia,
          cnpj: currentStoreDetails.cnpj,
          phone: storePhone || currentStoreDetails.phone,
          address: storeAddress || currentStoreDetails.address,
          bairro: currentStoreDetails.bairro,
          cidade: currentStoreDetails.cidade,
          estado: currentStoreDetails.estado,
          cep: currentStoreDetails.cep,
          aceitaCompraOnline: storeAceitaCompraOnline,
          logoUrl: brandLogoUrl || brandSplashUrl,
          splashImageUrl: brandSplashUrl,
          primaryColor: brandPrimaryColor,
          secondaryColor: brandSecondaryColor,
          tertiaryColor: brandTertiaryColor,
          quaternaryColor: brandQuaternaryColor,
          brandColors: brandExtraColors,
          horarioSegSex,
          horarioSab,
          horarioDom,
          horarioObservacoes,
          horarioFuncionamento: consolidatedHorario
        });

        // Backup local garantido para sobrevivência imediata em deploys Netlify
        try {
          localStorage.setItem(`promoMarketTenant_${activeStoreId}`, JSON.stringify(updates));
          const existingMap = JSON.parse(localStorage.getItem('promoMarketTenantsCustomMap') || '{}');
          existingMap[activeStoreId] = {
            ...(existingMap[activeStoreId] || {}),
            ...currentStoreDetails,
            ...updates,
            updatedAt: new Date().toISOString()
          };
          localStorage.setItem('promoMarketTenantsCustomMap', JSON.stringify(existingMap));
        } catch (_) {}
      }

      // Sincronizar sessão local do usuário caso seja o gerente deste supermercado
      if (currentUser && (currentUser.supermercadoId === activeStoreId || currentUser.uid === activeStoreId)) {
        const updatedUser: UserProfile = {
          ...currentUser,
          logoUrl: brandLogoUrl || brandSplashUrl,
          splashImageUrl: brandSplashUrl,
          primaryColor: brandPrimaryColor,
          secondaryColor: brandSecondaryColor,
          tertiaryColor: brandTertiaryColor,
          quaternaryColor: brandQuaternaryColor,
          brandColors: brandExtraColors,
          horarioSegSex,
          horarioSab,
          horarioDom,
          horarioObservacoes,
          horarioFuncionamento: consolidatedHorario,
          phone: storePhone,
          address: storeAddress,
          aceitaCompraOnline: storeAceitaCompraOnline
        };
        try {
          localStorage.setItem('promoMarketUser', JSON.stringify(updatedUser));
          sessionStorage.setItem('promoMarketUser', JSON.stringify(updatedUser));
        } catch (e) {}

        if (onUpdateUser) {
          onUpdateUser(updatedUser);
        }
      }

      // Notificar App.tsx para atualização reativa instantânea
      if (onUpdateSupermarket) {
        onUpdateSupermarket({
          ...currentStoreDetails,
          ...updates
        });
      }

      await fetch('/api/supermarkets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...currentStoreDetails,
          ...updates
        })
      }).catch(() => {});

      setBrandingSavedSuccess(true);
      setTimeout(() => setBrandingSavedSuccess(false), 6000);
    } catch (err) {
      console.error('Erro ao salvar configurações do supermercado:', err);
    } finally {
      setIsSavingBranding(false);
    }
  };

  const handleSaveBranding = handleSaveSettings;

  // Category Photo Presets for Quick Selection
  const categoryImagePresets: Record<string, { label: string; url: string }[]> = {
    acougue: [
      { label: '🥩 Picanha / Carne', url: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80' },
      { label: '🍖 Costela / Churrasco', url: 'https://images.unsplash.com/photo-1603048588665-791ca8aea617?auto=format&fit=crop&w=800&q=80' },
      { label: '🍗 Frango / Aves', url: 'https://images.unsplash.com/photo-1587593810167-a84920ea0781?auto=format&fit=crop&w=800&q=80' },
    ],
    hortifruti: [
      { label: '🍓 Morangos / Frutas', url: 'https://images.unsplash.com/photo-1464965911861-746a04b4bca6?auto=format&fit=crop&w=800&q=80' },
      { label: '🥬 Legumes & Verduras', url: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=800&q=80' },
      { label: '🍎 Maçãs / Salada', url: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=800&q=80' },
    ],
    padaria: [
      { label: '🍞 Pão Francês', url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80' },
      { label: '🥐 Croissant', url: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=800&q=80' },
      { label: '🧀 Queijos & Frios', url: 'https://images.unsplash.com/photo-1452195100486-9cc805987862?auto=format&fit=crop&w=800&q=80' },
    ],
    bebidas: [
      { label: '🍺 Cerveja / Geladas', url: 'https://images.unsplash.com/photo-1608270586620-248524c67de9?auto=format&fit=crop&w=800&q=80' },
      { label: '🥤 Sucos & Refrigerantes', url: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=800&q=80' },
      { label: '🍷 Vinhos', url: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=800&q=80' },
    ],
    mercearia: [
      { label: '🫒 Azeite de Oliva', url: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=800&q=80' },
      { label: '☕ Café Torrado', url: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&w=800&q=80' },
      { label: '🌾 Arroz & Grãos', url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80' },
    ],
    limpeza: [
      { label: '🧹 Produtos de Limpeza', url: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&w=800&q=80' },
      { label: '🧴 Sabão / Detergentes', url: 'https://images.unsplash.com/photo-1585421514284-efb74c2b69ba?auto=format&fit=crop&w=800&q=80' },
    ]
  };

  const handleImageUrlChange = (rawUrl: string) => {
    setImageLoadFailed(false);
    const cleaned = extractDirectImageUrl(rawUrl);
    setImageUrl(cleaned);
    if (rawUrl.includes('google.') && cleaned !== rawUrl) {
      setIsGoogleLinkExtracted(true);
      setTimeout(() => setIsGoogleLinkExtracted(false), 6000);
    } else {
      setIsGoogleLinkExtracted(false);
    }
  };

  const handleOpenGoogleSearch = () => {
    const query = encodeURIComponent(title ? `${title} produto` : `supermercado ${category}`);
    window.open(`https://www.google.com/search?tbm=isch&q=${query}`, '_blank');
  };

  // Deduplicate and strictly isolate promotions and orders for this supermarket
  const uniquePromotions = React.useMemo(() => {
    const all = Array.from(new Map<string, PromotionItem>(promotions.map((p) => [p.id, p])).values());
    if (activeStoreId) {
      return all.filter((p) => {
        if (p.supermarketId === activeStoreId) return true;
        if (targetSupermarket) {
          if (p.supermarketId === targetSupermarket.uid || p.supermarketId === targetSupermarket.supermercadoId) return true;
          if (p.supermarketName && targetSupermarket.nomeFantasia && p.supermarketName.toLowerCase().trim() === targetSupermarket.nomeFantasia.toLowerCase().trim()) return true;
        }
        return false;
      });
    }
    return all;
  }, [promotions, activeStoreId, targetSupermarket]);

  const uniqueOrders = React.useMemo(() => {
    const all = Array.from(new Map<string, Order>(orders.map((o) => [o.id, o])).values());
    if (activeStoreId) {
      return all.filter((o) =>
        o.items.some((it) => it.supermarketId === activeStoreId || (targetSupermarket && (it.supermarketId === targetSupermarket.uid || it.supermarketId === targetSupermarket.supermercadoId))) ||
        (o as any).supermarketId === activeStoreId
      );
    }
    return all;
  }, [orders, activeStoreId, targetSupermarket]);

  // Calculate Metrics
  const activeOffersCount = uniquePromotions.length;
  const bannerItemsCount = uniquePromotions.filter(p => p.isBanner).length;
  const pendingOrdersCount = uniqueOrders.filter(o => o.status === 'pending' || o.status === 'preparing').length;
  const deliveredOrdersCount = uniqueOrders.filter(o => o.status === 'delivered').length;
  const validOrdersCount = uniqueOrders.filter(o => o.status !== 'cancelled').length;
  const totalSalesToday = uniqueOrders
    .filter(o => o.status !== 'cancelled')
    .reduce((sum, o) => sum + o.totalAmount, 0);
  const averageTicket = validOrdersCount > 0 ? (totalSalesToday / validOrdersCount) : 0;

  // Controle de som de notificações
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('promoMarketSoundEnabled') !== 'false';
    } catch (_) {
      return true;
    }
  });

  const toggleSound = () => {
    setSoundEnabled(prev => {
      const next = !prev;
      try {
        localStorage.setItem('promoMarketSoundEnabled', String(next));
      } catch (_) {}
      return next;
    });
  };

  const handleTestSound = () => {
    playNotificationSound('order');
  };

  // Alerta sonoro e visual para novos pedidos recebidos em tempo real
  const prevOrdersCountRef = React.useRef<number>(uniqueOrders.length);
  const [newOrderToast, setNewOrderToast] = React.useState<Order | null>(null);

  React.useEffect(() => {
    if (uniqueOrders.length > prevOrdersCountRef.current && prevOrdersCountRef.current > 0) {
      const newestOrder = uniqueOrders[0];
      if (newestOrder && (newestOrder.status === 'pending' || newestOrder.status === 'preparing')) {
        if (soundEnabled) {
          playNotificationSound('order');
        }
        setNewOrderToast(newestOrder);
        const timer = setTimeout(() => setNewOrderToast(null), 8000);
        return () => clearTimeout(timer);
      }
    }
    prevOrdersCountRef.current = uniqueOrders.length;
  }, [uniqueOrders, soundEnabled]);

  // Exportar Pedidos em CSV
  const handleExportOrdersCsv = () => {
    if (uniqueOrders.length === 0) {
      alert('Nenhum pedido encontrado para exportar.');
      return;
    }

    const headers = [
      'ID Pedido',
      'Data e Hora',
      'Cliente',
      'Telefone',
      'Endereço',
      'Forma de Pagamento',
      'Status',
      'Qtd Itens',
      'Resumo dos Itens',
      'Valor Total (R$)'
    ];

    const rows = uniqueOrders.map(o => {
      const dateStr = new Date(o.createdAt).toLocaleString('pt-BR');
      const itemsSummary = o.items.map(i => `${i.quantity}x ${i.title} (R$ ${i.price.toFixed(2)})`).join(' | ');
      const totalItemsCount = o.items.reduce((s, i) => s + (i.quantity || 1), 0);
      const safe = (val: any) => `"${String(val || '').replace(/"/g, '""')}"`;

      return [
        safe(o.id),
        safe(dateStr),
        safe(o.customerName),
        safe(o.customerPhone),
        safe(o.address),
        safe(o.paymentMethod),
        safe(o.status),
        totalItemsCount,
        safe(itemsSummary),
        safe(o.totalAmount.toFixed(2))
      ].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const cleanStoreName = (activeStoreName || 'loja').toLowerCase().replace(/[^a-z0-9]/g, '-');
    link.download = `pedidos-${cleanStoreName}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // AI Copy Generation handler
  const copyStoreLinkSafe = (text: string) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text)
          .then(() => {
            setCopiedStoreLink(true);
            setTimeout(() => setCopiedStoreLink(false), 2500);
          })
          .catch(() => fallbackCopy(text));
      } else {
        fallbackCopy(text);
      }
    } catch (e) {
      fallbackCopy(text);
    }
  };

  const fallbackCopy = (text: string) => {
    try {
      const el = document.createElement('textarea');
      el.value = text;
      el.setAttribute('readonly', '');
      el.style.position = 'absolute';
      el.style.left = '-9999px';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopiedStoreLink(true);
      setTimeout(() => setCopiedStoreLink(false), 2500);
    } catch (err) {
      console.error('Falha ao copiar:', err);
    }
  };

  const handleGenerateAICopy = async () => {
    if (!title) {
      alert('Digite primeiro o nome do produto para gerar a chamada publicitária com IA.');
      return;
    }

    setIsGeneratingAI(true);
    try {
      const res = await fetch('/api/ai/generate-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          category,
          originalPrice,
          promoPrice,
          unit
        })
      });

      if (res.ok) {
        const data = await res.json();
        setDescription(`${data.headline} ${data.description}`);
        if (data.suggestedBadge) {
          setBadgeText(data.suggestedBadge);
        }
      }
    } catch (err) {
      console.error('Error generating AI copy:', err);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleSubmitNewOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const cleanImageUrl = extractDirectImageUrl(imageUrl) || getCategoryFallbackImage(category);

      await onAddPromotion({
        title,
        category,
        description: description || `Oferta imperdível no setor de ${category}!`,
        originalPrice: Number(originalPrice) || 0,
        promoPrice: Number(promoPrice) || 0,
        unit,
        imageUrl: cleanImageUrl,
        isBanner,
        isFlashDeal: true,
        validUntil: new Date(Date.now() + 86400000 * 3).toISOString(),
        stockQuantity: Number(stockQuantity) || 0,
        badgeText,
        supermarketId: activeStoreId,
        supermarketName: activeStoreName
      });

      // Reset form
      setTitle('');
      setDescription('');
      setOriginalPrice('');
      setPromoPrice('');
      setUnit('un');
      setImageUrl('');
      setIsBanner(false);
      setStockQuantity('');
      setBadgeText('');
      setActiveTab('inventory');
    } catch (err) {
      console.error('Error adding promotion:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredPromotions = uniquePromotions.filter(p =>
    p.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
    p.category.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="space-y-8 my-6">
      
      {/* Admin Impersonation Notice Bar */}
      {isAdminImpersonating && (
        <div className="p-4 bg-gradient-to-r from-amber-500/20 via-slate-900 to-amber-500/20 border border-amber-500/40 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-200 shadow-xl">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold shrink-0 text-lg shadow-inner">
              🛡️
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full">
                  Modo Administrador Geral
                </span>
                <span className="text-[11px] text-slate-400 font-mono">ID: {activeStoreId}</span>
              </div>
              <p className="font-extrabold text-white text-sm sm:text-base mt-0.5">
                Painel do Supermercado: <span className="text-amber-300">{activeStoreName}</span>
              </p>
              <p className="text-[11px] text-slate-300">
                Você pode cadastrar produtos, ajustar o encarte digital, gerenciar banners e acompanhar pedidos desta loja.
              </p>
            </div>
          </div>
          {onReturnToAdmin && (
            <button
              type="button"
              onClick={onReturnToAdmin}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl transition-all shadow-lg shadow-amber-500/20 active:scale-95 shrink-0 flex items-center space-x-2 cursor-pointer"
            >
              <span>Voltar ao Admin Geral</span>
              <span>→</span>
            </button>
          )}
        </div>
      )}

      {/* Top Header & KPI Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4 relative">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Gestão de Encartes & Pedidos Ao Vivo
            </h2>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <span className="text-xs text-slate-400 font-medium">Aba aberta:</span>
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold bg-sky-500/15 text-sky-400 border border-sky-500/30">
                {activeTab === 'orders' && `Pedidos (${pendingOrdersCount})`}
                {activeTab === 'create' && 'Criar Nova Oferta'}
                {activeTab === 'banner' && `Banner (${bannerItemsCount})`}
                {activeTab === 'inventory' && `Catálogo (${activeOffersCount})`}
                {activeTab === 'encarte' && 'Encarte Digital'}
                {activeTab === 'qrcode' && 'Link & QR Code'}
                {(activeTab === 'settings' || activeTab === 'branding') && 'Configurações da Loja'}
              </span>
              {pendingOrdersCount > 0 && activeTab !== 'orders' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('orders')}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-500/20 text-blue-300 border border-blue-500/40 hover:bg-blue-500/30 transition-all cursor-pointer"
                >
                  <ShoppingBag className="w-3 h-3" />
                  <span>{pendingOrdersCount} pedido{pendingOrdersCount > 1 ? 's' : ''} novo{pendingOrdersCount > 1 ? 's' : ''}</span>
                </button>
              )}
            </div>
          </div>

          {/* Menu Sanduíche para Otimização Visual do Painel */}
          <div className="relative shrink-0">
            <button
              type="button"
              id="btn-menu-sanduiche"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              className={`flex items-center space-x-2.5 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition-all shadow-xl cursor-pointer border ${
                isMenuOpen
                  ? 'bg-sky-500 text-white border-sky-400 shadow-sky-500/30 ring-2 ring-sky-400/40'
                  : 'bg-slate-950 text-slate-200 hover:text-white border-slate-800 hover:border-slate-700 hover:bg-slate-900'
              }`}
              aria-expanded={isMenuOpen}
              title="Menu sanduíche com todas as abas e ações do painel"
            >
              {isMenuOpen ? (
                <X className="w-5 h-5 text-white" />
              ) : (
                <Menu className="w-5 h-5 text-sky-400" />
              )}
              <span>Menu de Gestão</span>
              {pendingOrdersCount > 0 && (
                <span className="flex h-2.5 w-2.5 relative ml-1">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                </span>
              )}
            </button>

            {/* Dropdown Menu Sanduíche */}
            {isMenuOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-[2px]" 
                  onClick={() => setIsMenuOpen(false)} 
                />

                <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-slate-950/95 backdrop-blur-2xl border border-slate-800 rounded-3xl shadow-2xl p-2.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-2 border-b border-slate-800/80 mb-1 flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider">
                      Módulos do Estabelecimento
                    </span>
                    <span className="text-[10px] text-sky-400 font-bold bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/20">
                      Navegação
                    </span>
                  </div>

                  <div className="space-y-1">
                    {/* Pedidos */}
                    <button
                      type="button"
                      id="tab-orders"
                      onClick={() => {
                        setActiveTab('orders');
                        setIsMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                        activeTab === 'orders'
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                          : 'text-slate-300 hover:text-white hover:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div className={`p-1.5 rounded-lg shrink-0 ${activeTab === 'orders' ? 'bg-white/20 text-white' : 'bg-slate-900 text-blue-400 border border-slate-800'}`}>
                          <ShoppingBag className="w-4 h-4" />
                        </div>
                        <span className="truncate font-bold">Pedidos Ao Vivo</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                        activeTab === 'orders'
                          ? 'bg-white text-blue-900'
                          : pendingOrdersCount > 0
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30 animate-pulse'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}>
                        {pendingOrdersCount}
                      </span>
                    </button>

                    {/* Criar Oferta */}
                    <button
                      type="button"
                      id="tab-create"
                      onClick={() => {
                        setActiveTab('create');
                        setIsMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                        activeTab === 'create'
                          ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30'
                          : 'text-slate-300 hover:text-white hover:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div className={`p-1.5 rounded-lg shrink-0 ${activeTab === 'create' ? 'bg-white/20 text-white' : 'bg-slate-900 text-sky-400 border border-slate-800'}`}>
                          <Plus className="w-4 h-4" />
                        </div>
                        <span className="truncate font-bold">Criar Nova Oferta</span>
                      </div>
                    </button>

                    {/* Banner */}
                    <button
                      type="button"
                      id="tab-banner"
                      onClick={() => {
                        setActiveTab('banner');
                        setIsMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                        activeTab === 'banner'
                          ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30'
                          : 'text-slate-300 hover:text-white hover:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div className={`p-1.5 rounded-lg shrink-0 ${activeTab === 'banner' ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-900 text-amber-400 border border-slate-800'}`}>
                          <Star className="w-4 h-4" />
                        </div>
                        <span className="truncate font-bold">Destaques no Banner</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                        activeTab === 'banner'
                          ? 'bg-slate-950 text-amber-300'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}>
                        {bannerItemsCount}
                      </span>
                    </button>

                    {/* Catálogo de Produtos */}
                    <button
                      type="button"
                      id="tab-inventory"
                      onClick={() => {
                        setActiveTab('inventory');
                        setIsMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                        activeTab === 'inventory'
                          ? 'bg-slate-700 text-white shadow-md'
                          : 'text-slate-300 hover:text-white hover:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div className={`p-1.5 rounded-lg shrink-0 ${activeTab === 'inventory' ? 'bg-white/20 text-white' : 'bg-slate-900 text-slate-300 border border-slate-800'}`}>
                          <Tag className="w-4 h-4" />
                        </div>
                        <span className="truncate font-bold">Catálogo de Produtos</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                        activeTab === 'inventory'
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}>
                        {activeOffersCount}
                      </span>
                    </button>

                    {/* Encarte Digital */}
                    <button
                      type="button"
                      id="tab-encarte"
                      onClick={() => {
                        setActiveTab('encarte');
                        setIsMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                        activeTab === 'encarte'
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                          : 'text-slate-300 hover:text-white hover:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div className={`p-1.5 rounded-lg shrink-0 ${activeTab === 'encarte' ? 'bg-white/20 text-white' : 'bg-slate-900 text-emerald-400 border border-slate-800'}`}>
                          <BookOpen className="w-4 h-4" />
                        </div>
                        <span className="truncate font-bold">Encarte Digital</span>
                      </div>
                    </button>

                    {/* Link & QR Code */}
                    <button
                      type="button"
                      id="tab-qrcode"
                      onClick={() => {
                        setActiveTab('qrcode');
                        setIsMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                        activeTab === 'qrcode'
                          ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                          : 'text-slate-300 hover:text-white hover:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div className={`p-1.5 rounded-lg shrink-0 ${activeTab === 'qrcode' ? 'bg-white/20 text-white' : 'bg-slate-900 text-teal-400 border border-slate-800'}`}>
                          <QrCode className="w-4 h-4" />
                        </div>
                        <span className="truncate font-bold">Link Oficial & QR Code</span>
                      </div>
                    </button>

                    {/* Configurações da Loja */}
                    <button
                      type="button"
                      id="tab-settings"
                      onClick={() => {
                        setActiveTab('settings');
                        setIsMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                        activeTab === 'settings' || activeTab === 'branding'
                          ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/30'
                          : 'text-slate-300 hover:text-white hover:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div className={`p-1.5 rounded-lg shrink-0 ${activeTab === 'settings' || activeTab === 'branding' ? 'bg-white/20 text-white' : 'bg-slate-900 text-purple-400 border border-slate-800'}`}>
                          <Settings className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-bold">Configurações da Loja</div>
                          <div className={`text-[10px] ${activeTab === 'settings' ? 'text-purple-200' : 'text-slate-400'}`}>Cores, Logo & Horários</div>
                        </div>
                      </div>
                    </button>
                  </div>

                  {/* Sessão inferior com Sair/Trocar de Conta e Voltar ao Admin se aplicável */}
                  {(onLogout || onReturnToAdmin) && (
                    <div className="mt-2 pt-2 border-t border-slate-800/80 space-y-1">
                      {onReturnToAdmin && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsMenuOpen(false);
                            onReturnToAdmin();
                          }}
                          className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-bold text-amber-400 hover:bg-amber-500/10 transition-all text-left cursor-pointer"
                        >
                          <span>← Voltar ao Admin Geral</span>
                        </button>
                      )}
                      {onLogout && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsMenuOpen(false);
                            onLogout();
                          }}
                          className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-bold text-red-400 hover:bg-red-500/10 transition-all text-left cursor-pointer"
                        >
                          <span>Sair / Trocar de Conta</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Store Link & QR Code Quick Action Bar */}
        <div className="bg-slate-950/80 border border-sky-500/30 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-inner">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-black uppercase text-sky-400 tracking-wider">
                  Link Oficial do Estabelecimento
                </span>
                <span className="bg-emerald-500/20 text-emerald-400 text-[9px] font-bold px-1.5 py-0.2 rounded-full border border-emerald-500/30">
                  Ao Vivo
                </span>
              </div>
              <p className="text-xs text-slate-300 truncate font-medium">
                {currentStoreDetails.nomeFantasia} • Compartilhe com clientes para acesso direto ao encarte
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              type="button"
              onClick={() => copyStoreLinkSafe(storeDirectUrl)}
              className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                copiedStoreLink
                  ? 'bg-emerald-500 text-white shadow-md'
                  : 'bg-sky-500 hover:bg-sky-400 text-white shadow-md shadow-sky-500/20'
              }`}
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copiedStoreLink ? 'Link Copiado!' : 'Copiar Link'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsQrModalOpen(true)}
              className="flex items-center space-x-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20 active:scale-95"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Ver QR Code</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30 ring-2 ring-purple-400'
                  : 'bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40'
              }`}
              title="Configurar cores da loja, logotipo oficial e horários de funcionamento"
            >
              <Settings className="w-3.5 h-3.5 text-purple-300" />
              <span>Cores, Logo & Horários</span>
            </button>

            <a
              href={storeDirectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-95"
              title="Abrir a visão da loja como cliente"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Ver como Cliente</span>
            </a>
          </div>
        </div>

        {/* 4 KPI Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Ofertas Ativas no App
            </span>
            <div className="text-2xl font-black text-sky-400 mt-1">{activeOffersCount}</div>
            <span className="text-[10px] text-slate-500 mt-0.5 block">Disponíveis para clientes</span>
          </div>

          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Em Destaque no Banner
            </span>
            <div className="text-2xl font-black text-amber-400 mt-1">{bannerItemsCount}</div>
            <span className="text-[10px] text-slate-500 mt-0.5 block">Carrossel do topo</span>
          </div>

          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Pedidos a Processar
            </span>
            <div className="text-2xl font-black text-emerald-400 mt-1">{pendingOrdersCount}</div>
            <span className="text-[10px] text-slate-500 mt-0.5 block">Tempo real ativo</span>
          </div>

          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Faturamento Hoje
            </span>
            <div className="text-2xl font-black text-purple-400 mt-1">
              R$ {totalSalesToday.toFixed(2)}
            </div>
            <span className="text-[10px] text-slate-500 mt-0.5 block">Vendas efetuadas</span>
          </div>
        </div>
      </div>

      {/* Toast Alert de Novo Pedido Ao Vivo */}
      {newOrderToast && (
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between animate-bounce border-2 border-emerald-300">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">🔔</span>
            <div>
              <div className="text-xs font-black uppercase tracking-wider text-emerald-100">Novo Pedido Recebido Agora!</div>
              <div className="text-sm font-black">Pedido #{newOrderToast.id} • {newOrderToast.customerName} (R$ {newOrderToast.totalAmount.toFixed(2)})</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setActiveTab('orders');
              setNewOrderToast(null);
            }}
            className="px-3 py-1.5 bg-white text-emerald-950 font-black text-xs rounded-xl hover:bg-emerald-50 transition-all cursor-pointer"
          >
            Ver Pedido
          </button>
        </div>
      )}

      {/* TAB 1: REALTIME ORDERS MONITOR */}
      {activeTab === 'orders' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
          {/* Header & Controls */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Monitor de Pedidos em Tempo Real</h3>
                <p className="text-xs text-slate-400">
                  Acompanhe vendas instantaneamente com áudio e atualizações automáticas
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Botão de Som */}
              <button
                type="button"
                id="btn-toggle-som-pedidos"
                onClick={toggleSound}
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  soundEnabled 
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30' 
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                }`}
                title={soundEnabled ? 'Silenciar alertas sonoros' : 'Ativar alertas sonoros'}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                <span>{soundEnabled ? 'Som Ativado' : 'Som Mudo'}</span>
              </button>

              <button
                type="button"
                id="btn-testar-som-pedidos"
                onClick={handleTestSound}
                className="flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold border border-slate-700 transition-all cursor-pointer"
                title="Tocar som de teste"
              >
                <span>🔔 Testar Som</span>
              </button>

              {/* Botão Exportar CSV */}
              <button
                type="button"
                id="btn-exportar-pedidos-csv"
                onClick={handleExportOrdersCsv}
                disabled={uniqueOrders.length === 0}
                className="flex items-center space-x-1.5 px-3.5 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-lg shadow-sky-600/20 transition-all cursor-pointer"
                title="Exportar planilha de pedidos em formato Excel/CSV"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Exportar Pedidos (CSV)</span>
              </button>
            </div>
          </div>

          {/* Cards de Métricas Financeiras e Operacionais */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-2xl">
              <span className="text-[11px] font-bold text-slate-400 block">Faturamento Total</span>
              <span className="text-lg sm:text-xl font-black text-emerald-400">
                R$ {totalSalesToday.toFixed(2)}
              </span>
            </div>
            <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-2xl">
              <span className="text-[11px] font-bold text-slate-400 block">Total de Pedidos</span>
              <span className="text-lg sm:text-xl font-black text-white">
                {uniqueOrders.length}
              </span>
            </div>
            <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-2xl">
              <span className="text-[11px] font-bold text-slate-400 block">Entregues</span>
              <span className="text-lg sm:text-xl font-black text-sky-400">
                {deliveredOrdersCount}
              </span>
            </div>
            <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-2xl">
              <span className="text-[11px] font-bold text-slate-400 block">Ticket Médio</span>
              <span className="text-lg sm:text-xl font-black text-amber-400">
                R$ {averageTicket.toFixed(2)}
              </span>
            </div>
          </div>

          {uniqueOrders.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <ShoppingBag className="w-12 h-12 text-slate-600 mx-auto mb-2" />
              <p className="text-white font-bold">Nenhum pedido recebido ainda</p>
            </div>
          ) : (
            <div className="space-y-4">
              {uniqueOrders.map((order) => (
                <div
                  key={order.id}
                  className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-md"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="bg-sky-500/20 text-sky-300 font-extrabold text-xs px-2.5 py-0.5 rounded-lg border border-sky-500/30">
                          {order.id}
                        </span>
                        <span className="text-xs text-slate-400">
                          {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <h4 className="font-bold text-base text-white mt-1">
                        {order.customerName} - {order.customerPhone}
                      </h4>
                      <p className="text-xs text-slate-400">{order.address}</p>
                    </div>

                    <div className="text-right space-y-1">
                      <span className="bg-slate-800 text-slate-300 text-[10px] font-bold px-2 py-0.5 rounded uppercase block">
                        Pagamento: {order.paymentMethod}
                      </span>
                      <span className="text-lg font-black text-emerald-400 block">
                        R$ {order.totalAmount.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Purchased Items List */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                    {order.items.map((i) => (
                      <div key={i.itemId} className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-sky-400 rounded-full" />
                        <span className="text-slate-200 font-semibold">{i.quantity}x</span>
                        <span className="text-slate-300 truncate">{i.title}</span>
                      </div>
                    ))}
                  </div>

                  {/* Status Change Buttons */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <span className="text-xs text-slate-400">
                      Status Atual: <strong className="text-amber-400 uppercase">{order.status}</strong>
                    </span>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => onUpdateOrderStatus(order.id, 'preparing')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          order.status === 'preparing'
                            ? 'bg-amber-500 text-slate-950 font-black'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                        }`}
                      >
                        📦 Em Preparação
                      </button>

                      <button
                        onClick={() => onUpdateOrderStatus(order.id, 'delivering')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          order.status === 'delivering'
                            ? 'bg-blue-600 text-white font-black'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                        }`}
                      >
                        🚚 Saiu para Entrega
                      </button>

                      <button
                        onClick={() => onUpdateOrderStatus(order.id, 'completed')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          order.status === 'completed'
                            ? 'bg-emerald-500 text-white font-black'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                        }`}
                      >
                        ✅ Concluído
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CREATE PROMOTION WITH AI COPYWRITER */}
      {activeTab === 'create' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-xl font-bold text-white flex items-center">
                Cadastrar Nova Oferta no Encarte
                <Flame className="w-5 h-5 text-red-500 ml-2" />
              </h3>
              <p className="text-xs text-slate-400">
                Os dados salvos aqui aparecem instantaneamente para todos os clientes online.
              </p>
            </div>
          </div>

          <form id="form-create-promotion" onSubmit={handleSubmitNewOffer} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Product Title */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Nome do Produto *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Filé Mignon Friboi Peça 1kg"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Category Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Setor / Categoria *
                </label>
                <select
                  value={category}
                  onChange={(e: any) => setCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500 cursor-pointer"
                >
                  <option value="acougue">🥩 Açougue & Peixaria</option>
                  <option value="hortifruti">🥬 Hortifruti & Feira</option>
                  <option value="padaria">🍞 Padaria & Frios</option>
                  <option value="bebidas">🍺 Bebidas Geladas</option>
                  <option value="mercearia">🫒 Mercearia</option>
                  <option value="limpeza">🧹 Limpeza & Perfumaria</option>
                </select>
              </div>

              {/* Original Price */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Preço Normal (De) R$ *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={originalPrice}
                  onChange={(e) => setOriginalPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Promotional Price */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Preço Promocional (Por) R$ *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={promoPrice}
                  onChange={(e) => setPromoPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Unit */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Unidade de Medida
                </label>
                <input
                  type="text"
                  placeholder="kg, un, pack, 500g, L"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Stock Quantity */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Quantidade em Estoque Promocional
                </label>
                <input
                  type="number"
                  placeholder="0"
                  value={stockQuantity}
                  onChange={(e) => setStockQuantity(e.target.value === '' ? '' : parseInt(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Image URL & Google Search Helper */}
              <div className="md:col-span-2 space-y-3 bg-slate-950/80 p-4 rounded-2xl border border-slate-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="block text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-sky-400" />
                    <span>Link da Foto do Produto (URL / Google Imagens) *</span>
                  </label>

                  {/* Google Image Search Button */}
                  <button
                    type="button"
                    onClick={handleOpenGoogleSearch}
                    className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 self-start sm:self-auto"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>🔍 Pesquisar no Google Imagens</span>
                    <ExternalLink className="w-3 h-3 opacity-80" />
                  </button>
                </div>

                {/* Input Field */}
                <div className="relative">
                  <input
                    type="url"
                    required
                    placeholder="Cole o link aqui (aceita links do Google Imagens, Unsplash, etc)..."
                    value={imageUrl}
                    onChange={(e) => handleImageUrlChange(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                  />
                  {imageUrl && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                    </div>
                  )}
                </div>

                {/* Google Redirect Extraction Success Badge */}
                {isGoogleLinkExtracted && (
                  <div className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-3 py-2 rounded-xl text-xs flex items-center space-x-2 animate-fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      <strong>Link do Google detectado!</strong> O sistema extraiu e converteu automaticamente para o link direto da foto real.
                    </span>
                  </div>
                )}

                {/* Helper Instructions */}
                <div className="text-[11px] text-slate-400 space-y-1">
                  <p className="flex items-center gap-1 text-slate-300 font-semibold">
                    <HelpCircle className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span>Como pegar o link direto no Google Imagens:</span>
                  </p>
                  <ol className="list-decimal list-inside pl-1 space-y-0.5 text-slate-400 text-[10px]">
                    <li>Clique no botão azul acima para abrir a busca do Google Imagens.</li>
                    <li>No Google, clique com o botão direito sobre a foto desejada.</li>
                    <li>Selecione <strong>"Copiar endereço da imagem"</strong> (ou "Copiar link da imagem").</li>
                    <li>Cole no campo acima (o sistema limpa parâmetros do Google automaticamente).</li>
                  </ol>
                </div>

                {/* Category Photo Presets */}
                {categoryImagePresets[category] && (
                  <div className="pt-2 border-t border-slate-800">
                    <span className="text-[11px] font-bold text-slate-300 block mb-2">
                      🖼️ Ou escolha uma foto profissional em HD do setor ({category}):
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {categoryImagePresets[category].map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setImageUrl(preset.url);
                            setImageLoadFailed(false);
                          }}
                          className={`text-xs px-3 py-1.5 rounded-xl border font-medium transition-all flex items-center space-x-1.5 ${
                            imageUrl === preset.url
                              ? 'bg-sky-500 text-white border-sky-400 font-bold shadow-md'
                              : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          <span>{preset.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Live Image Preview Card */}
                {imageUrl && (
                  <div className="pt-2 border-t border-slate-800 flex items-center gap-3">
                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-900 border border-slate-700 shrink-0 relative">
                      <img
                        src={imageUrl}
                        alt="Prévia"
                        referrerPolicy="no-referrer"
                        onError={() => setImageLoadFailed(true)}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="text-xs">
                      <span className="font-bold text-white block">Prévia da Foto</span>
                      {imageLoadFailed ? (
                        <div className="text-red-400 flex items-center space-x-1 mt-0.5">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>Não foi possível carregar esta foto. Use uma das sugestões acima!</span>
                        </div>
                      ) : (
                        <span className="text-emerald-400 flex items-center space-x-1 mt-0.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Imagem carregada com sucesso!</span>
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Description & AI Generator */}
              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-300">
                    Descrição Promocional & Chamada
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateAICopy}
                    disabled={isGeneratingAI}
                    className="flex items-center space-x-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-3 py-1 rounded-lg text-xs font-bold shadow-md transition-all active:scale-95 disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                    <span>{isGeneratingAI ? 'Gerando...' : '✨ Gerar Texto com IA (Gemini)'}</span>
                  </button>
                </div>
                <textarea
                  rows={2}
                  placeholder="Descrição atrativa da oferta ou clique no botão acima para a IA criar automaticamente!"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Badge Text */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Selo / Selo de Destaque
                </label>
                <input
                  type="text"
                  placeholder="30% OFF - SÓ HOJE"
                  value={badgeText}
                  onChange={(e) => setBadgeText(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Highlight in Banner Toggle */}
              <div className="flex items-center space-x-3 pt-5">
                <input
                  id="checkbox-banner"
                  type="checkbox"
                  checked={isBanner}
                  onChange={(e) => setIsBanner(e.target.checked)}
                  className="w-4 h-4 text-sky-500 bg-slate-950 border-slate-700 rounded focus:ring-sky-500"
                />
                <label htmlFor="checkbox-banner" className="text-xs font-bold text-amber-300 cursor-pointer">
                  ⭐ Destacar Imediatamente no "Banner do Dia" (Carrossel Principal)
                </label>
              </div>

            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-black py-3.5 rounded-xl shadow-xl transition-all flex items-center justify-center space-x-2 active:scale-95 disabled:opacity-50"
            >
              <Plus className="w-5 h-5" />
              <span>{isSubmitting ? 'Publicando...' : 'Publicar Oferta em Tempo Real no App'}</span>
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: BANNER MANAGER (1-CLICK TOGGLE MATRIX) */}
      {activeTab === 'banner' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-4 gap-3">
            <div>
              <div className="flex items-center space-x-2">
                <span className="bg-sky-500/20 text-sky-300 border border-sky-500/30 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full">
                  Exclusivo de {activeStoreName}
                </span>
              </div>
              <h3 className="text-lg font-bold text-white flex items-center mt-1">
                Gerenciador do Banner do Dia
                <Star className="w-5 h-5 text-amber-400 fill-amber-400 ml-2" />
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Os produtos destacados aqui aparecerão exclusivamente no Banner do Dia do seu supermercado.
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-amber-400 font-bold bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-xl">
                {uniquePromotions.filter(p => p.isBanner).length} produto(s) no Banner
              </span>
            </div>
          </div>

          {uniquePromotions.length === 0 ? (
            <div className="text-center py-12 px-4 bg-slate-950/60 rounded-2xl border border-slate-800 space-y-3">
              <Sparkles className="w-10 h-10 text-sky-400 mx-auto opacity-70" />
              <h4 className="text-base font-bold text-white">Nenhuma oferta cadastrada ainda</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Cadastre seus primeiros produtos na aba "Criar Oferta". Depois, você poderá destacá-los aqui para que apareçam no Banner do Dia exclusivo do seu supermercado.
              </p>
              <button
                onClick={() => setActiveTab('create')}
                className="inline-flex items-center space-x-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Criar Primeira Oferta</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {uniquePromotions.map((promo) => (
                <div
                  key={promo.id}
                  className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                    promo.isBanner
                      ? 'bg-slate-950 border-amber-500/50 shadow-amber-500/10 shadow-lg'
                      : 'bg-slate-950/60 border-slate-800 opacity-70 hover:opacity-100'
                  }`}
                >
                  <img
                    src={promo.imageUrl}
                    alt={promo.title}
                    referrerPolicy="no-referrer"
                    onError={(e) => { e.currentTarget.src = getCategoryFallbackImage(promo.category); }}
                    className="w-14 h-14 rounded-xl object-cover bg-slate-900 border border-slate-800 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-xs text-white truncate">{promo.title}</h4>
                    <span className="text-emerald-400 font-extrabold text-xs">
                      R$ {promo.promoPrice.toFixed(2)}
                    </span>
                  </div>

                  <button
                    onClick={() => onToggleBanner(promo.id)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                      promo.isBanner
                        ? 'bg-amber-400 text-slate-950 font-black'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {promo.isBanner ? '⭐ Destacado' : '+ Destacar'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: FULL CATALOG INVENTORY TABLE */}
      {activeTab === 'inventory' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <h3 className="text-lg font-bold text-white">Catálogo Completo de Promoções</h3>

            {/* Search filter */}
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Filtrar catálogo..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-3">Produto</th>
                  <th className="p-3">Setor</th>
                  <th className="p-3">Preço De / Por</th>
                  <th className="p-3">Banner</th>
                  <th className="p-3">Estoque</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredPromotions.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-950/50 transition-colors">
                    <td className="p-3 flex items-center space-x-3">
                      <img
                        src={p.imageUrl}
                        alt={p.title}
                        referrerPolicy="no-referrer"
                        onError={(e) => { e.currentTarget.src = getCategoryFallbackImage(p.category); }}
                        className="w-10 h-10 rounded-lg object-cover bg-slate-950"
                      />
                      <div>
                        <span className="font-bold text-white block">{p.title}</span>
                        <span className="text-[10px] text-slate-400">{p.badgeText}</span>
                      </div>
                    </td>
                    <td className="p-3 font-semibold uppercase text-sky-400">{p.category}</td>
                    <td className="p-3">
                      <span className="line-through text-slate-500 block">R$ {p.originalPrice.toFixed(2)}</span>
                      <span className="text-emerald-400 font-bold">R$ {p.promoPrice.toFixed(2)}</span>
                    </td>
                    <td className="p-3">
                      {p.isBanner ? (
                        <span className="bg-amber-400/20 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded text-[10px] font-bold">
                          ⭐ Sim
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[10px]">Não</span>
                      )}
                    </td>
                    <td className="p-3 font-bold">{p.stockQuantity} un</td>
                    <td className="p-3 text-right space-x-2">
                      <button
                        onClick={() => onDeletePromotion(p.id)}
                        className="p-1.5 text-red-400 hover:text-white hover:bg-red-500/20 rounded-lg transition-colors"
                        title="Excluir Oferta"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: EDIT ENCARTE DO ESTABELECIMENTO */}
      {activeTab === 'encarte' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-xl font-bold text-white flex items-center">
                Configurar Encarte Digital do Estabelecimento
                <BookOpen className="w-5 h-5 text-emerald-400 ml-2" />
              </h3>
              <p className="text-xs text-slate-400">
                Personalize o título, slogan, imagem de capa e período de validade do folheto de ofertas do seu supermercado.
              </p>
            </div>
          </div>

          <form id="form-save-encarte" onSubmit={handleSaveEncarteForm} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Título do Encarte *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Encarte de Ofertas da Semana"
                  value={encarteTitle}
                  onChange={(e) => setEncarteTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Subtítulo / Slogan *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Preços baixos e economia garantida em todos os setores"
                  value={encarteSubtitle}
                  onChange={(e) => setEncarteSubtitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Data de Início da Validade
                </label>
                <input
                  type="text"
                  placeholder="29/07/2026"
                  value={encarteStartDate}
                  onChange={(e) => setEncarteStartDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Data de Término da Validade
                </label>
                <input
                  type="text"
                  placeholder="05/08/2026"
                  value={encarteEndDate}
                  onChange={(e) => setEncarteEndDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="md:col-span-2 space-y-2 bg-slate-950/80 p-4 rounded-2xl border border-slate-800">
                <label className="block text-xs font-bold text-slate-200">
                  Foto de Capa do Encarte (URL ou Imagem)
                </label>
                <input
                  type="url"
                  placeholder="Cole a URL da capa do encarte..."
                  value={encarteCoverImage}
                  onChange={(e) => setEncarteCoverImage(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
                {encarteCoverImage && (
                  <div className="mt-2 flex items-center gap-3">
                    <img
                      src={extractDirectImageUrl(encarteCoverImage)}
                      alt="Capa do Encarte"
                      referrerPolicy="no-referrer"
                      className="w-20 h-20 object-cover rounded-xl border border-slate-700 bg-slate-900"
                    />
                    <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" />
                      Prévia da Capa Atual do Encarte
                    </span>
                  </div>
                )}
              </div>
            </div>

            {encarteSavedSuccess && (
              <div className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-4 py-3 rounded-xl text-xs font-bold flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Encarte salvo com sucesso no Firestore! O público já pode visualizar as alterações no app.</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSavingEncarte}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black py-3.5 rounded-xl shadow-xl transition-all flex items-center justify-center space-x-2 active:scale-95 disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              <span>{isSavingEncarte ? 'Salvando Encarte...' : 'Salvar Encarte do Estabelecimento no Banco de Dados'}</span>
            </button>
          </form>
        </div>
      )}

      {/* TAB 6: LINK OFICIAL & QR CODE DEDICATED VIEW */}
      {activeTab === 'qrcode' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-8 animate-in fade-in duration-300">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
            <div>
              <div className="flex items-center space-x-2">
                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full">
                  DIVULGAÇÃO & CANAIS DIGITAIS
                </span>
              </div>
              <h3 className="text-2xl font-black text-white mt-1">
                Link Oficial & QR Code de {currentStoreDetails.nomeFantasia}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Utilize este link e QR Code exclusivo para direcionar seus clientes diretamente para os encartes e produtos da sua loja.
              </p>
            </div>

            <div className="flex items-center space-x-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setIsQrModalOpen(true)}
                className="flex items-center space-x-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
              >
                <Download className="w-4 h-4" />
                <span>Baixar Arte do QR Code (PNG)</span>
              </button>
            </div>
          </div>

          {/* Main 2-Column Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Direct Link & Copy Action */}
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4">
                <h4 className="text-sm font-black text-white flex items-center gap-2">
                  <ExternalLink className="w-4 h-4 text-sky-400" />
                  Link Permanente do Seu Supermercado
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Este é o endereço web oficial que isola estritamente o catálogo da sua loja. Clientes que acessam por aqui visualizam suas ofertas exclusivas, banner do dia e encartes semanais sem misturar com nenhum outro mercado.
                </p>

                <div className="flex items-center space-x-2 bg-slate-900 border border-slate-700/80 rounded-xl p-2">
                  <input
                    type="text"
                    readOnly
                    value={storeDirectUrl}
                    className="bg-transparent text-xs text-slate-200 px-2 flex-1 focus:outline-none select-all truncate font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => copyStoreLinkSafe(storeDirectUrl)}
                    className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center space-x-1.5 transition-all shrink-0 ${
                      copiedStoreLink
                        ? 'bg-emerald-500 text-white'
                        : 'bg-sky-500 hover:bg-sky-400 text-white shadow-md shadow-sky-500/20 active:scale-95'
                    }`}
                  >
                    {copiedStoreLink ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar Link</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex flex-wrap gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const text = encodeURIComponent(
                        `🛒 *Confira as ofertas e o encarte digital do ${currentStoreDetails.nomeFantasia}!* 🍗🍎\n\nAcesse diretamente pelo link oficial:\n${storeDirectUrl}`
                      );
                      window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
                    }}
                    className="flex items-center space-x-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold text-xs py-2 px-3.5 rounded-xl transition-all"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Compartilhar no WhatsApp</span>
                  </button>

                  <a
                    href={storeDirectUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 font-bold text-xs py-2 px-3.5 rounded-xl transition-all"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Testar Link no Navegador</span>
                  </a>
                </div>
              </div>

              {/* Best Practices Guide */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 space-y-3">
                <h4 className="text-xs font-black uppercase text-sky-400 tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-sky-400" />
                  Onde e Como Usar o QR Code & Link da Loja:
                </h4>
                <ul className="text-xs text-slate-300 space-y-2">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>No Balcão e Caixas:</strong> Baixe a arte em PNG, imprima em papel cartão ou acrílico e coloque nos caixas para que os clientes confiram o encarte na hora.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Nas Sacolas e Cupons:</strong> Imprima o QR Code no rodapé do cupom fiscal ou na sacola do supermercado para compras futuras.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Status e Redes Sociais:</strong> Envie o link ou a imagem do QR Code nos seus stories do Instagram, Facebook e grupos de ofertas no WhatsApp.</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Right Column: Interactive QR Code Card */}
            <div className="lg:col-span-5 flex flex-col items-center">
              <div className="bg-white rounded-3xl p-6 shadow-2xl border-4 border-slate-800 w-full max-w-sm text-center space-y-4">
                <div className="border-b border-slate-200 pb-3">
                  <span className="text-[10px] font-black uppercase text-sky-700 tracking-widest block">
                    ENCARTE DIGITAL
                  </span>
                  <h5 className="text-base font-black text-slate-900 truncate">
                    {currentStoreDetails.nomeFantasia}
                  </h5>
                </div>

                <div 
                  onClick={() => setIsQrModalOpen(true)}
                  className="cursor-pointer group relative bg-slate-50 p-4 rounded-2xl border border-slate-200 hover:border-sky-500 transition-all flex flex-col items-center justify-center min-h-[250px]"
                  title="Clique para abrir e baixar em tamanho grande"
                >
                  <div className="p-3 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center">
                    <div 
                      id="encarte-qrcode-box"
                      ref={qrContainerRef} 
                      className="w-[192px] h-[192px] flex items-center justify-center [&>img]:mx-auto [&>canvas]:mx-auto [&>img]:block [&>canvas]:block group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <span className="mt-3 text-[11px] font-black text-sky-700 group-hover:text-sky-800 flex items-center gap-1">
                    <Smartphone className="w-3.5 h-3.5" />
                    Clique para Abrir em Alta Resolução
                  </span>
                </div>

                <button
                  type="button"
                  id="btn-baixar-qrcode-encarte"
                  onClick={handleDownloadQrCode}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center space-x-2 active:scale-95 cursor-pointer"
                >
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span>Baixar QR Code (PNG)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: CONFIGURAÇÕES DA LOJA (CORES, LOGO, HORÁRIOS & DADOS) */}
      {(activeTab === 'settings' || activeTab === 'branding') && (
        <StoreSettingsTab
          activeStoreId={activeStoreId}
          activeStoreName={activeStoreName}
          currentStoreDetails={currentStoreDetails}
          currentUser={currentUser}
          targetSupermarket={targetSupermarket}
          storeDirectUrl={storeDirectUrl}
          brandLogoUrl={brandLogoUrl}
          setBrandLogoUrl={setBrandLogoUrl}
          brandSplashUrl={brandSplashUrl}
          setBrandSplashUrl={setBrandSplashUrl}
          brandPrimaryColor={brandPrimaryColor}
          setBrandPrimaryColor={setBrandPrimaryColor}
          brandSecondaryColor={brandSecondaryColor}
          setBrandSecondaryColor={setBrandSecondaryColor}
          brandTertiaryColor={brandTertiaryColor}
          setBrandTertiaryColor={setBrandTertiaryColor}
          brandQuaternaryColor={brandQuaternaryColor}
          setBrandQuaternaryColor={setBrandQuaternaryColor}
          brandExtraColors={brandExtraColors}
          setBrandExtraColors={setBrandExtraColors}
          horarioSegSex={horarioSegSex}
          setHorarioSegSex={setHorarioSegSex}
          horarioSab={horarioSab}
          setHorarioSab={setHorarioSab}
          horarioDom={horarioDom}
          setHorarioDom={setHorarioDom}
          horarioObservacoes={horarioObservacoes}
          setHorarioObservacoes={setHorarioObservacoes}
          horarioFuncionamento={horarioFuncionamento}
          setHorarioFuncionamento={setHorarioFuncionamento}
          storePhone={storePhone}
          setStorePhone={setStorePhone}
          storeAddress={storeAddress}
          setStoreAddress={setStoreAddress}
          storeAceitaCompraOnline={storeAceitaCompraOnline}
          setStoreAceitaCompraOnline={setStoreAceitaCompraOnline}
          isSavingSettings={isSavingBranding}
          settingsSavedSuccess={brandingSavedSuccess}
          onSaveSettings={handleSaveSettings}
          processImageFile={processImageFile}
        />
      )}


      {/* Modal de QR Code e Link Exclusivo */}
      <QRCodeModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        supermarket={currentStoreDetails}
        customStoreUrl={storeDirectUrl}
      />

    </div>
  );
};
