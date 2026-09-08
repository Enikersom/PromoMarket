import React, { useState } from 'react';
import { Download, Share2, X, Smartphone } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        id="btn-pwa-install"
        onClick={install}
        className="flex items-center space-x-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs font-bold shadow-md shadow-emerald-900/30 transition-all border border-emerald-400/30 active:scale-95 min-h-[38px] cursor-pointer"
        title="Instalar PromoMarket no seu dispositivo"
      >
        <Download className="w-4 h-4 text-emerald-100" />
        <span className="hidden sm:inline">Instalar App</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          id="btn-pwa-install-ios"
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs font-semibold transition-all min-h-[38px] cursor-pointer"
          title="Instalar PromoMarket no iPhone/iPad"
        >
          <Smartphone className="w-4 h-4 text-sky-400" />
          <span className="hidden sm:inline">Instalar</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-white">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center space-x-2">
                  <img src="/pwa-192x192.png" alt="PromoMarket" className="w-8 h-8 rounded-lg" />
                  <h3 className="text-base font-bold text-white">Instalar no iPhone / iPad</h3>
                </div>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-4 space-y-3 text-xs text-slate-300">
                <div className="flex items-start space-x-3 bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
                  <span className="bg-sky-500/20 text-sky-300 w-5 h-5 rounded-full flex items-center justify-center font-bold shrink-0">1</span>
                  <p>
                    No Safari, toque no botão de <strong className="text-white">Compartilhar</strong> <Share2 className="w-3.5 h-3.5 inline mx-1 text-sky-400" /> na barra inferior.
                  </p>
                </div>
                <div className="flex items-start space-x-3 bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
                  <span className="bg-sky-500/20 text-sky-300 w-5 h-5 rounded-full flex items-center justify-center font-bold shrink-0">2</span>
                  <p>
                    Role para baixo e selecione <strong className="text-white">"Adicionar à Tela de Início"</strong>.
                  </p>
                </div>
                <div className="flex items-start space-x-3 bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
                  <span className="bg-sky-500/20 text-sky-300 w-5 h-5 rounded-full flex items-center justify-center font-bold shrink-0">3</span>
                  <p>
                    Toque em <strong className="text-emerald-400">Adicionar</strong> no canto superior direito para finalizar.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-xl bg-sky-600 hover:bg-sky-500 py-2.5 text-xs font-bold text-white transition-all shadow-md"
              >
                Entendi
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
