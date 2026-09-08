import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Flame, ShoppingCart, Star, CheckCircle, BellRing, X } from 'lucide-react';
import { RealtimeEvent } from '../types';

interface LiveNotificationToastProps {
  event: RealtimeEvent | null;
  onClose: () => void;
}

export const LiveNotificationToast: React.FC<LiveNotificationToastProps> = ({ event, onClose }) => {
  useEffect(() => {
    if (event) {
      const timer = setTimeout(() => {
        onClose();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [event, onClose]);

  if (!event) return null;

  const getEventConfig = () => {
    switch (event.type) {
      case 'ORDER_CREATED':
        return {
          bgColor: 'bg-emerald-950 border-emerald-500/50 text-emerald-100',
          badgeBg: 'bg-emerald-500 text-white',
          badgeText: 'NOVO PEDIDO',
          icon: <ShoppingCart className="w-5 h-5 text-emerald-400" />
        };
      case 'FLASH_BANNER_UPDATE':
        return {
          bgColor: 'bg-amber-950 border-amber-500/50 text-amber-100',
          badgeBg: 'bg-amber-500 text-slate-950',
          badgeText: 'BANNER DO DIA',
          icon: <Star className="w-5 h-5 text-amber-400 fill-amber-400 animate-spin" style={{ animationDuration: '6s' }} />
        };
      case 'PROMOTION_CREATED':
        return {
          bgColor: 'bg-sky-950 border-sky-500/50 text-sky-100',
          badgeBg: 'bg-sky-500 text-white',
          badgeText: 'NOVA OFERTA',
          icon: <Flame className="w-5 h-5 text-sky-400" />
        };
      case 'ORDER_STATUS_CHANGED':
        return {
          bgColor: 'bg-blue-950 border-blue-500/50 text-blue-100',
          badgeBg: 'bg-blue-500 text-white',
          badgeText: 'STATUS PEDIDO',
          icon: <CheckCircle className="w-5 h-5 text-blue-400" />
        };
      default:
        return {
          bgColor: 'bg-slate-900 border-slate-700 text-slate-100',
          badgeBg: 'bg-slate-700 text-white',
          badgeText: 'ATUALIZAÇÃO',
          icon: <BellRing className="w-5 h-5 text-sky-400" />
        };
    }
  };

  const config = getEventConfig();

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.9 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className="fixed bottom-5 right-5 z-50 max-w-sm w-full p-1"
      >
        <div className={`p-4 rounded-2xl border shadow-2xl backdrop-blur-md ${config.bgColor} flex items-start space-x-3`}>
          <div className="p-2.5 rounded-xl bg-slate-900/80 border border-white/10 shrink-0">
            {config.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${config.badgeBg}`}>
                {config.badgeText}
              </span>
              <span className="text-[10px] text-slate-400">
                {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <p className="text-xs font-semibold leading-snug break-words">
              {event.message || JSON.stringify(event.data)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
