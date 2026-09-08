import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Trash2, 
  Plus, 
  Minus, 
  ShoppingBag, 
  CreditCard, 
  QrCode, 
  Receipt, 
  CheckCircle, 
  Truck, 
  MapPin, 
  User, 
  Phone,
  Sparkles,
  DollarSign
} from 'lucide-react';
import { CartItem, Order } from '../types';
import { extractDirectImageUrl, getCategoryFallbackImage } from '../utils/image';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  onUpdateQuantity: (itemId: string, newQty: number) => void;
  onClearCart: () => void;
  onOrderPlaced: (order: Order) => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  cartItems,
  onUpdateQuantity,
  onClearCart,
  onOrderPlaced
}) => {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [address, setAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'credit' | 'debit' | 'meal_voucher'>('pix');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<Order | null>(null);

  const subtotal = cartItems.reduce((acc, item) => acc + item.item.originalPrice * item.quantity, 0);
  const totalAmount = cartItems.reduce((acc, item) => acc + item.item.promoPrice * item.quantity, 0);
  const totalSavings = subtotal - totalAmount;

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !customerPhone || !address || cartItems.length === 0) return;

    setIsSubmitting(true);

    try {
      const orderData = {
        customerName,
        customerPhone,
        address,
        paymentMethod,
        notes,
        items: cartItems.map((ci) => ({
          itemId: ci.item.id,
          title: ci.item.title,
          quantity: ci.quantity,
          promoPrice: ci.item.promoPrice,
          originalPrice: ci.item.originalPrice,
          unit: ci.item.unit,
          imageUrl: ci.item.imageUrl,
          supermarketId: ci.item.supermarketId,
          supermarketName: ci.item.supermarketName
        })),
        totalAmount,
        totalSavings
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      });

      if (res.ok) {
        const createdOrder: Order = await res.json();
        setOrderSuccess(createdOrder);
        onOrderPlaced(createdOrder);
        onClearCart();
      } else {
        alert('Ocorreu um erro ao enviar o pedido. Tente novamente.');
      }
    } catch (err) {
      console.error('Error placing order:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-hidden">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
        />

        <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-screen max-w-md bg-slate-900 border-l border-slate-800 text-white shadow-2xl flex flex-col justify-between"
          >
            {/* Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-sky-500/10 border border-sky-500/20 text-sky-400 rounded-xl">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Seu Carrinho de Ofertas</h3>
                  <p className="text-xs text-slate-400">
                    {cartItems.length} {cartItems.length === 1 ? 'item selecionado' : 'itens selecionados'}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              
              {/* Order Success View */}
              {orderSuccess ? (
                <div className="text-center py-8 space-y-4">
                  <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-full flex items-center justify-center mx-auto animate-bounce">
                    <CheckCircle className="w-10 h-10" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-sky-400 uppercase tracking-widest">
                      Pedido Confirmado!
                    </span>
                    <h3 className="text-2xl font-black text-white mt-1">
                      {orderSuccess.id}
                    </h3>
                    <p className="text-xs text-slate-300 mt-2 max-w-xs mx-auto">
                      Seu pedido foi transmitido em tempo real para o Painel do Supermercado.
                    </p>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-left text-xs space-y-2">
                    <div className="flex justify-between text-slate-400">
                      <span>Cliente:</span>
                      <span className="text-white font-semibold">{orderSuccess.customerName}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Forma de Pagamento:</span>
                      <span className="text-white font-semibold uppercase">{orderSuccess.paymentMethod}</span>
                    </div>
                    <div className="flex justify-between text-slate-400 border-t border-slate-800 pt-2">
                      <span>Total Pago:</span>
                      <span className="text-emerald-400 font-bold text-sm">
                        R$ {orderSuccess.totalAmount.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setOrderSuccess(null);
                      onClose();
                    }}
                    className="w-full bg-sky-500 hover:bg-sky-400 text-white font-bold py-3 rounded-xl transition-all shadow-lg"
                  >
                    Voltar às Compras
                  </button>
                </div>
              ) : cartItems.length === 0 ? (
                <div className="text-center py-12 text-slate-400 space-y-3">
                  <ShoppingBag className="w-12 h-12 text-slate-600 mx-auto" />
                  <p className="font-bold text-white text-base">Seu carrinho está vazio</p>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto">
                    Aproveite as ofertas no encartes digitais do supermercado para adicionar produtos com grande desconto!
                  </p>
                </div>
              ) : (
                <>
                  {/* Cart Items List */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Itens no Carrinho
                    </h4>
                    {cartItems.map(({ item, quantity }) => (
                      <div
                        key={item.id}
                        className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex items-center justify-between gap-3"
                      >
                        <img
                          src={extractDirectImageUrl(item.imageUrl)}
                          alt={item.title}
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.currentTarget.src = getCategoryFallbackImage(item.category);
                          }}
                          className="w-14 h-14 rounded-xl object-cover bg-slate-900 border border-slate-800 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <h5 className="font-bold text-xs text-white truncate">{item.title}</h5>
                          <div className="flex items-baseline space-x-2 mt-0.5">
                            <span className="text-emerald-400 font-extrabold text-xs">
                              R$ {item.promoPrice.toFixed(2)}
                            </span>
                            <span className="text-[10px] text-slate-500 line-through">
                              R$ {item.originalPrice.toFixed(2)}
                            </span>
                          </div>
                        </div>

                        {/* Quantity Controls */}
                        <div className="flex items-center space-x-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
                          <button
                            onClick={() => onUpdateQuantity(item.id, quantity - 1)}
                            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-xs font-bold text-white px-1">{quantity}</span>
                          <button
                            onClick={() => onUpdateQuantity(item.id, quantity + 1)}
                            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Total Savings Card */}
                  <div className="bg-gradient-to-r from-emerald-950/80 to-slate-950 p-4 rounded-2xl border border-emerald-500/30 text-emerald-300 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Sparkles className="w-5 h-5 text-emerald-400 shrink-0" />
                      <div>
                        <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                          Economia do Encarte
                        </span>
                        <p className="text-xs font-medium text-emerald-200">
                          Você está economizando nesta compra!
                        </p>
                      </div>
                    </div>
                    <span className="text-lg font-black text-emerald-400">
                      R$ {totalSavings.toFixed(2)}
                    </span>
                  </div>

                  {/* Delivery & Checkout Form */}
                  <form id="form-checkout" onSubmit={handleSubmitOrder} className="space-y-4 pt-2">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center">
                      <Truck className="w-4 h-4 mr-1 text-sky-400" />
                      Dados para Entrega Expressa
                    </h4>

                    {/* Customer Name */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Seu Nome Completo
                      </label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                          type="text"
                          required
                          placeholder="Ex: Ana Maria Silva"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                        />
                      </div>
                    </div>

                    {/* Customer Phone */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        WhatsApp / Celular
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                          type="tel"
                          required
                          placeholder="(11) 99999-8888"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                        />
                      </div>
                    </div>

                    {/* Address */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Endereço Completo de Entrega
                      </label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                          type="text"
                          required
                          placeholder="Rua, número, complemento e bairro"
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                        />
                      </div>
                    </div>

                    {/* Payment Method Selection */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-2">
                        Forma de Pagamento
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('pix')}
                          className={`p-2.5 rounded-xl border text-xs font-bold flex items-center space-x-2 transition-all ${
                            paymentMethod === 'pix'
                              ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          <QrCode className="w-4 h-4 text-emerald-400" />
                          <span>Pix Instantâneo</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setPaymentMethod('credit')}
                          className={`p-2.5 rounded-xl border text-xs font-bold flex items-center space-x-2 transition-all ${
                            paymentMethod === 'credit'
                              ? 'bg-sky-500/20 border-sky-500 text-sky-300'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          <CreditCard className="w-4 h-4 text-sky-400" />
                          <span>Cartão de Crédito</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setPaymentMethod('debit')}
                          className={`p-2.5 rounded-xl border text-xs font-bold flex items-center space-x-2 transition-all ${
                            paymentMethod === 'debit'
                              ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          <DollarSign className="w-4 h-4 text-blue-400" />
                          <span>Débito na Entrega</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setPaymentMethod('meal_voucher')}
                          className={`p-2.5 rounded-xl border text-xs font-bold flex items-center space-x-2 transition-all ${
                            paymentMethod === 'meal_voucher'
                              ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          <Receipt className="w-4 h-4 text-purple-400" />
                          <span>Vale Alimentação</span>
                        </button>
                      </div>
                    </div>
                  </form>
                </>
              )}

            </div>

            {/* Footer Summary & Submit Button */}
            {!orderSuccess && cartItems.length > 0 && (
              <div className="p-5 bg-slate-950 border-t border-slate-800 space-y-3">
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Subtotal Original:</span>
                    <span className="line-through">R$ {subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-400 font-semibold">
                    <span>Desconto Total:</span>
                    <span>- R$ {totalSavings.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-white font-bold text-base pt-1 border-t border-slate-800">
                    <span>Total a Pagar:</span>
                    <span className="text-emerald-400 text-xl font-black">
                      R$ {totalAmount.toFixed(2)}
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  form="form-checkout"
                  disabled={isSubmitting}
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black py-3.5 rounded-xl shadow-xl shadow-emerald-500/20 transition-all flex items-center justify-center space-x-2 active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span>Transmitindo Pedido...</span>
                  ) : (
                    <>
                      <ShoppingBag className="w-5 h-5" />
                      <span>Confirmar & Enviar Pedido ao Vivo</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
};
