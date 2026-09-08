export interface UserProfile {
  uid: string;
  nome: string;
  email: string;
  role: 'cliente' | 'supermercado' | 'admin';
  documento?: string; // CPF or CNPJ
  cpf?: string;
  cnpj?: string;
  phone?: string;
  address?: string;
  cep?: string;
  razaoSocial?: string;
  nomeFantasia?: string;
  inscricaoEstadual?: string;
  inscricaoMunicipal?: string;
  cidade?: string;
  bairro?: string;
  estado?: string;
  logoUrl?: string;
  aceitaCompraOnline?: boolean;
  cadastroCompleto?: boolean;
  createdAt?: string;
  valorLocacao?: number;
  dataVencimento?: string;
  statusInquilino?: 'Ativo' | 'Bloqueado' | 'Suspenso' | 'Cancelado';
  bloqueado?: boolean;
  senha?: string;
  senhaProvisoria?: string;
  registeredSupermarketId?: string;
  registeredSupermarketName?: string;
  supermercadoId?: string;
}

export interface SupermarketDetails {
  uid?: string;
  supermercadoId?: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  inscricaoEstadual?: string;
  inscricaoMunicipal?: string;
  phone: string;
  address: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  logoUrl?: string;
  aceitaCompraOnline: boolean;
  valorLocacao?: number;
  dataVencimento?: string;
  statusInquilino?: 'Ativo' | 'Bloqueado' | 'Suspenso' | 'Cancelado';
  bloqueado?: boolean;
  senhaProvisoria?: string;
  senha?: string;
}

export type Category = 
  | 'hortifruti' 
  | 'acougue' 
  | 'padaria' 
  | 'bebidas' 
  | 'mercearia' 
  | 'limpeza';

export interface PromotionItem {
  id: string;
  title: string;
  category: Category;
  description: string;
  originalPrice: number;
  promoPrice: number;
  unit: string; // e.g. 'kg', 'un', 'pack', 'L', '500g'
  imageUrl: string;
  isBanner: boolean; // Highlighted on top "Banner do Dia"
  isFlashDeal: boolean; // Oferta Relâmpago
  validUntil: string; // ISO date string or formatted string
  stockQuantity: number;
  badgeText?: string; // e.g. "SÓ HOJE", "30% OFF", "OFERTA IMPERDÍVEL"
  createdAt: string;
  supermarketId?: string;
  supermarketName?: string;
}

export interface Encarte {
  id: string;
  title: string;
  subtitle: string;
  startDate: string;
  endDate: string;
  coverImage: string;
  items: PromotionItem[];
  active: boolean;
  pagesCount: number;
  supermarketId?: string;
  supermarketName?: string;
}

export interface CartItem {
  item: PromotionItem;
  quantity: number;
}

export type OrderStatus = 'pending' | 'preparing' | 'delivering' | 'completed' | 'cancelled';

export interface OrderItem {
  itemId: string;
  title: string;
  quantity: number;
  promoPrice: number;
  originalPrice: number;
  unit: string;
  imageUrl: string;
  supermarketId?: string;
  supermarketName?: string;
}

export interface Order {
  id: string;
  customerName: string;
  customerPhone: string;
  address: string;
  paymentMethod: 'pix' | 'credit' | 'debit' | 'meal_voucher';
  items: OrderItem[];
  totalAmount: number;
  totalSavings: number;
  status: OrderStatus;
  createdAt: string;
  notes?: string;
}

export interface RealtimeEvent {
  type: 'PROMOTION_CREATED' | 'PROMOTION_UPDATED' | 'PROMOTION_DELETED' | 'ORDER_CREATED' | 'ORDER_STATUS_CHANGED' | 'FLASH_BANNER_UPDATE' | 'ENCARTE_UPDATED' | 'TENANT_DELETED' | 'TENANT_UPDATED' | 'CONNECTED';
  data?: any;
  timestamp: string;
  message?: string;
}

export interface AIResponseCopy {
  headline: string;
  description: string;
  callToAction: string;
  suggestedBadge: string;
}

export interface AIRecipe {
  title: string;
  prepTime: string;
  servings: string;
  description: string;
  discountedIngredientsUsed: string[];
  additionalIngredientsNeeded: string[];
  instructions: string[];
  estimatedCost: number;
}
