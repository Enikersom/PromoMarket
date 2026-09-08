import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Clock, PackageCheck, Truck, CheckCircle2, ShoppingBag } from 'lucide-react';
import { Order, OrderStatus } from '../types';

interface OrderTrackerModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
}

export const OrderTrackerModal: React.FC<OrderTrackerModalProps> = ({
  isOpen,
  onClose,
  orders
}) => {
  if (!isOpen) return null;

  const uniqueOrders = Array.from(new Map<string, Order>(orders.map((o) => [o.id, o])).values());

  const steps: { status: OrderStatus; label: string; icon: any }[] = [
    { status: 'pending', label: 'Recebido / Aguardando', icon: Clock },
    { status: 'preparing', label: 'Em Preparação', icon: PackageCheck },
    { status: 'delivering', label: 'Saiu para Entrega', icon: Truck },
    { status: 'completed', label: 'Entregue com Sucesso', icon: CheckCircle2 }
  ];

  const getStatusIndex = (status: OrderStatus) => {
    switch (status) {
      case 'pending': return 0;
      case 'preparing': return 1;
      case 'delivering': return 2;
      case 'completed': return 3;
      default: return 0;
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 text-white shadow-2xl relative space-y-6"
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-xl">
                <Clock className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">Acompanhamento em Tempo Real</h3>
                <p className="text-xs text-slate-400">
                  Status atualizado ao vivo conforme o painel do supermercado
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Orders List */}
          <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-1">
            {uniqueOrders.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <ShoppingBag className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                <p className="font-bold text-white">Nenhum pedido realizado ainda nesta sessão.</p>
              </div>
            ) : (
              uniqueOrders.map((order) => {
                const currentStepIdx = getStatusIndex(order.status);

                return (
                  <div
                    key={order.id}
                    className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                      <div>
                        <span className="text-xs font-bold text-sky-400 uppercase">
                          Pedido {order.id}
                        </span>
                        <h4 className="font-semibold text-sm text-white">{order.customerName}</h4>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-slate-400 block">Total do Pedido</span>
                        <span className="text-sm font-black text-emerald-400">
                          R$ {order.totalAmount.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Timeline Progress */}
                    <div className="relative pt-2">
                      <div className="grid grid-cols-4 gap-2 text-center">
                        {steps.map((step, idx) => {
                          const Icon = step.icon;
                          const isDone = idx <= currentStepIdx;
                          const isCurrent = idx === currentStepIdx;

                          return (
                            <div key={step.status} className="space-y-2 flex flex-col items-center">
                              <div
                                className={`w-10 h-10 rounded-2xl border flex items-center justify-center transition-all ${
                                  isCurrent
                                    ? 'bg-sky-500 border-sky-400 text-white ring-4 ring-sky-500/20 scale-110 shadow-lg'
                                    : isDone
                                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                                    : 'bg-slate-900 border-slate-800 text-slate-600'
                                }`}
                              >
                                <Icon className="w-5 h-5" />
                              </div>
                              <span
                                className={`text-[10px] font-bold leading-tight ${
                                  isCurrent
                                    ? 'text-sky-300'
                                    : isDone
                                    ? 'text-emerald-400'
                                    : 'text-slate-600'
                                }`}
                              >
                                {step.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Items Purchased List */}
                    <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/60 text-xs text-slate-300 space-y-1">
                      <p className="font-semibold text-slate-400 text-[10px] uppercase mb-1">
                        Itens no Pedido ({order.items.length}):
                      </p>
                      {order.items.map((i) => (
                        <div key={i.itemId} className="flex justify-between">
                          <span>{i.quantity}x {i.title}</span>
                          <span className="text-slate-400">R$ {(i.promoPrice * i.quantity).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
