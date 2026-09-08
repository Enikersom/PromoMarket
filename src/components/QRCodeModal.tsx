import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { X, Download, Copy, Check, ExternalLink, Share2, Building2, Smartphone, MapPin } from 'lucide-react';
import { SupermarketDetails } from '../types';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  supermarket: SupermarketDetails | null;
  customStoreUrl?: string;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({
  isOpen,
  onClose,
  supermarket,
  customStoreUrl
}) => {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [downloading, setDownloading] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const storeId = supermarket?.supermercadoId || (supermarket as any)?.uid || '';
  const storeName = supermarket?.nomeFantasia || supermarket?.razaoSocial || 'Supermercado';

  // Construct valid, canonical direct link
  const validStoreUrl = customStoreUrl || (typeof window !== 'undefined'
    ? `${window.location.origin}/?store=${encodeURIComponent(storeId)}`
    : `/?store=${encodeURIComponent(storeId)}`);

  useEffect(() => {
    if (!isOpen || !supermarket) return;

    let isMounted = true;

    // Generate high-resolution QR Code
    QRCode.toDataURL(validStoreUrl, {
      width: 480,
      margin: 2,
      color: {
        dark: '#0f172a', // Deep slate for high contrast and modern readability
        light: '#ffffff'
      },
      errorCorrectionLevel: 'H' // High error tolerance allowing robust camera scanning
    })
      .then((url) => {
        if (isMounted) {
          setQrCodeDataUrl(url);
        }
      })
      .catch((err) => {
        console.error('Erro ao gerar QR Code:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, supermarket, validStoreUrl]);

  if (!isOpen || !supermarket) return null;

  const handleCopyLink = () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(validStoreUrl)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
          })
          .catch(() => {
            copyFallback(validStoreUrl);
          });
      } else {
        copyFallback(validStoreUrl);
      }
    } catch (e) {
      copyFallback(validStoreUrl);
    }
  };

  const copyFallback = (text: string) => {
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
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Falha ao copiar texto:', err);
    }
  };

  const handleDownloadPng = async () => {
    setDownloading(true);
    try {
      // Create high-res composite image with Store branding, QR code, and scanning guide
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = 800;
      const height = 1000;
      canvas.width = width;
      canvas.height = height;

      // Background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      // Header Banner Top
      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, '#0284c7'); // sky-600
      gradient.addColorStop(1, '#2563eb'); // blue-600
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, 140);

      // App Brand on Top
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PROMO MARKET • ENCARTE DIGITAL', width / 2, 50);

      ctx.fillStyle = '#e0f2fe';
      ctx.font = 'normal 18px sans-serif';
      ctx.fillText('Ofertas atualizadas em tempo real', width / 2, 85);

      // Store Name Box
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'center';
      const cleanStoreName = storeName.length > 35 ? storeName.substring(0, 32) + '...' : storeName;
      ctx.fillText(cleanStoreName, width / 2, 220);

      // Store Details (City, CNPJ)
      ctx.fillStyle = '#64748b';
      ctx.font = 'normal 18px sans-serif';
      const cityState = supermarket.cidade && supermarket.estado ? `${supermarket.cidade} - ${supermarket.estado}` : '';
      const doc = supermarket.cnpj ? `CNPJ: ${supermarket.cnpj}` : '';
      const subInfo = [cityState, doc].filter(Boolean).join(' • ');
      if (subInfo) {
        ctx.fillText(subInfo, width / 2, 255);
      }

      // QR Code Image in Center
      const qrImg = new Image();
      qrImg.crossOrigin = 'anonymous';

      await new Promise<void>((resolve) => {
        qrImg.onload = () => {
          // Draw QR Code centered (500x500)
          const qrSize = 500;
          const qrX = (width - qrSize) / 2;
          const qrY = 290;

          // Shadow and white card behind QR
          ctx.strokeStyle = '#e2e8f0';
          ctx.lineWidth = 4;
          ctx.strokeRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20);

          ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
          resolve();
        };
        qrImg.onerror = () => {
          resolve();
        };
        qrImg.src = qrCodeDataUrl;
      });

      // Bottom Instruction Callout
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('📲 Aponte a câmera do seu celular', width / 2, 850);

      ctx.fillStyle = '#64748b';
      ctx.font = '18px sans-serif';
      ctx.fillText('Acesse o encarte completo e faça seus pedidos diretamente nesta loja', width / 2, 890);

      // Bottom URL Link
      ctx.fillStyle = '#0284c7';
      ctx.font = 'bold 16px monospace';
      ctx.fillText(validStoreUrl, width / 2, 940);

      const sanitizedFileName = storeName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '-');

      const triggerDownload = (url: string) => {
        const link = document.createElement('a');
        link.download = `qrcode-${sanitizedFileName}.png`;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      };

      // Convert to downloadable Blob with dataURL fallback
      if (canvas.toBlob) {
        canvas.toBlob((blob) => {
          if (!blob) {
            triggerDownload(canvas.toDataURL('image/png'));
            return;
          }
          const url = URL.createObjectURL(blob);
          triggerDownload(url);
          setTimeout(() => URL.revokeObjectURL(url), 2000);
        }, 'image/png');
      } else {
        triggerDownload(canvas.toDataURL('image/png'));
      }
    } catch (err) {
      console.error('Erro ao baixar QR Code:', err);
    } finally {
      setDownloading(false);
    }
  };

  const handleShareWhatsapp = () => {
    const text = encodeURIComponent(
      `🛒 *Confira as ofertas e o encarte digital do ${storeName}!* 🍗🍎\n\nAcesse diretamente pelo link oficial:\n${validStoreUrl}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-md w-full p-6 shadow-2xl relative text-white space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all"
          title="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center space-x-3.5 pr-8">
          {supermarket.logoUrl ? (
            <img
              src={supermarket.logoUrl}
              alt={storeName}
              className="w-12 h-12 rounded-2xl object-contain bg-slate-950 border border-slate-800 p-1 shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
          )}
          <div className="min-w-0">
            <span className="text-[10px] font-black uppercase text-sky-400 tracking-wider block">
              QR Code & Link Exclusivo
            </span>
            <h3 className="text-lg font-black text-white truncate leading-tight">
              {storeName}
            </h3>
            {supermarket.cidade && (
              <p className="text-xs text-slate-400 flex items-center mt-0.5 truncate">
                <MapPin className="w-3 h-3 mr-1 text-slate-500 shrink-0" />
                {supermarket.cidade} {supermarket.estado ? `- ${supermarket.estado}` : ''}
              </p>
            )}
          </div>
        </div>

        {/* QR Code Card Display */}
        <div className="bg-white rounded-2xl p-5 flex flex-col items-center justify-center shadow-inner border border-slate-200">
          {qrCodeDataUrl ? (
            <img
              src={qrCodeDataUrl}
              alt={`QR Code ${storeName}`}
              className="w-60 h-60 object-contain rounded-lg"
            />
          ) : (
            <div className="w-60 h-60 flex items-center justify-center text-slate-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
            </div>
          )}
          <div className="mt-2 text-center">
            <p className="text-xs font-black text-slate-800 flex items-center justify-center gap-1">
              <Smartphone className="w-3.5 h-3.5 text-sky-600" />
              Aponte a câmera para abrir o mercado
            </p>
            <p className="text-[10px] text-slate-500 font-medium">
              Válido para clientes, encartes impressos e balcão
            </p>
          </div>
        </div>

        {/* Direct Link Input Box */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300 block">
            Link Oficial do Estabelecimento:
          </label>
          <div className="flex items-center space-x-2 bg-slate-950 border border-slate-800 rounded-xl p-1.5">
            <input
              type="text"
              readOnly
              value={validStoreUrl}
              className="bg-transparent text-xs text-slate-300 px-2 flex-1 focus:outline-none select-all truncate font-mono"
            />
            <button
              type="button"
              onClick={handleCopyLink}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center space-x-1.5 transition-all shrink-0 ${
                copied
                  ? 'bg-emerald-500 text-white'
                  : 'bg-sky-500 hover:bg-sky-400 text-white shadow-md shadow-sky-500/20 active:scale-95'
              }`}
            >
              {copied ? (
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
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          {/* Download PNG Button */}
          <button
            type="button"
            onClick={handleDownloadPng}
            disabled={downloading || !qrCodeDataUrl}
            className="flex items-center justify-center space-x-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs py-2.5 px-3 rounded-xl shadow-lg shadow-emerald-600/20 transition-all active:scale-95 disabled:opacity-50"
            title="Baixar imagem em alta resolução com o logo do mercado"
          >
            <Download className="w-4 h-4" />
            <span>{downloading ? 'Baixando...' : 'Baixar QR (PNG)'}</span>
          </button>

          {/* Share on WhatsApp */}
          <button
            type="button"
            onClick={handleShareWhatsapp}
            className="flex items-center justify-center space-x-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold text-xs py-2.5 px-3 rounded-xl transition-all active:scale-95"
            title="Compartilhar texto e link no WhatsApp"
          >
            <Share2 className="w-4 h-4" />
            <span>WhatsApp</span>
          </button>

          {/* Open Store in New Tab */}
          <a
            href={validStoreUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs py-2.5 px-3 rounded-xl transition-all active:scale-95"
            title="Abrir a loja em nova aba"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Abrir Loja</span>
          </a>
        </div>
      </div>
    </div>
  );
};
