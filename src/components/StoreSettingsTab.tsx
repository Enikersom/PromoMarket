import React, { useState } from 'react';
import { 
  Palette, 
  Clock, 
  Smartphone, 
  Upload, 
  Save, 
  CheckCircle2, 
  Phone, 
  MapPin,
  Sparkles,
  Plus,
  Trash2,
  Check,
  HelpCircle,
  Lock,
  Key,
  ShieldCheck
} from 'lucide-react';
import { UserProfile, SupermarketDetails } from '../types';
import { getStoreOperatingStatus } from '../utils/storeHours';
import { changeTenantPasswordInFirestore } from '../lib/firebase';

export interface StoreSettingsTabProps {
  activeStoreId: string;
  activeStoreName: string;
  currentStoreDetails: SupermarketDetails;
  currentUser?: UserProfile | null;
  targetSupermarket?: SupermarketDetails | null;
  storeDirectUrl: string;
  brandLogoUrl: string;
  setBrandLogoUrl: (val: string) => void;
  brandSplashUrl: string;
  setBrandSplashUrl: (val: string) => void;
  brandPrimaryColor: string;
  setBrandPrimaryColor: (val: string) => void;
  brandSecondaryColor: string;
  setBrandSecondaryColor: (val: string) => void;
  brandTertiaryColor: string;
  setBrandTertiaryColor: (val: string) => void;
  brandQuaternaryColor: string;
  setBrandQuaternaryColor: (val: string) => void;
  brandExtraColors: string[];
  setBrandExtraColors: (val: string[]) => void;
  horarioSegSex: string;
  setHorarioSegSex: (val: string) => void;
  horarioSab: string;
  setHorarioSab: (val: string) => void;
  horarioDom: string;
  setHorarioDom: (val: string) => void;
  horarioObservacoes: string;
  setHorarioObservacoes: (val: string) => void;
  horarioFuncionamento: string;
  setHorarioFuncionamento: (val: string) => void;
  storePhone: string;
  setStorePhone: (val: string) => void;
  storeAddress: string;
  setStoreAddress: (val: string) => void;
  storeAceitaCompraOnline: boolean;
  setStoreAceitaCompraOnline: (val: boolean) => void;
  isSavingSettings: boolean;
  settingsSavedSuccess: boolean;
  onSaveSettings: (e?: React.FormEvent) => void;
  processImageFile: (
    file: File,
    maxWidth: number,
    maxHeight: number,
    onSuccess: (dataUrl: string) => void,
    format?: 'image/png' | 'image/jpeg'
  ) => void;
}

export const StoreSettingsTab: React.FC<StoreSettingsTabProps> = ({
  activeStoreId,
  activeStoreName,
  currentStoreDetails,
  currentUser,
  targetSupermarket,
  storeDirectUrl,
  brandLogoUrl,
  setBrandLogoUrl,
  brandSplashUrl,
  setBrandSplashUrl,
  brandPrimaryColor,
  setBrandPrimaryColor,
  brandSecondaryColor,
  setBrandSecondaryColor,
  brandTertiaryColor,
  setBrandTertiaryColor,
  brandQuaternaryColor,
  setBrandQuaternaryColor,
  brandExtraColors = [],
  setBrandExtraColors,
  horarioSegSex,
  setHorarioSegSex,
  horarioSab,
  setHorarioSab,
  horarioDom,
  setHorarioDom,
  horarioObservacoes,
  setHorarioObservacoes,
  horarioFuncionamento,
  setHorarioFuncionamento,
  storePhone,
  setStorePhone,
  storeAddress,
  setStoreAddress,
  storeAceitaCompraOnline,
  setStoreAceitaCompraOnline,
  isSavingSettings,
  settingsSavedSuccess,
  onSaveSettings,
  processImageFile
}) => {
  const [newExtraColor, setNewExtraColor] = useState('#ffffff');
  const [showAddColorInput, setShowAddColorInput] = useState(false);

  // Senha do Lojista
  const [tenantNewPassword, setTenantNewPassword] = useState('');
  const [tenantConfirmPassword, setTenantConfirmPassword] = useState('');
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleUpdateTenantPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordFeedback(null);

    if (!tenantNewPassword) {
      setPasswordFeedback({ type: 'error', text: 'Informe a nova senha.' });
      return;
    }
    if (tenantNewPassword.length < 6) {
      setPasswordFeedback({ type: 'error', text: 'A senha deve ter no mínimo 6 caracteres.' });
      return;
    }
    if (tenantNewPassword !== tenantConfirmPassword) {
      setPasswordFeedback({ type: 'error', text: 'As senhas digitadas não conferem.' });
      return;
    }

    setIsUpdatingPassword(true);
    const targetId = activeStoreId || currentUser?.supermercadoId || currentUser?.uid || '';

    try {
      // 1. Atualiza no backend via API
      try {
        await fetch(`/api/supermarkets/${encodeURIComponent(targetId)}/password`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newPassword: tenantNewPassword })
        });
      } catch (apiErr) {
        console.warn('API password indisponível, tentando Firestore:', apiErr);
      }

      // 2. Atualiza no Firestore direto
      if (targetId) {
        await changeTenantPasswordInFirestore(targetId, tenantNewPassword);
      }

      // 3. Atualiza no localStorage
      try {
        const storedUser = JSON.parse(localStorage.getItem('promoMarketUser') || '{}');
        if (storedUser) {
          storedUser.senha = tenantNewPassword;
          storedUser.senhaProvisoria = tenantNewPassword;
          localStorage.setItem('promoMarketUser', JSON.stringify(storedUser));
        }
      } catch (_) {}

      setPasswordFeedback({ type: 'success', text: 'Senha alterada com sucesso! Use a nova senha no seu próximo login.' });
      setTenantNewPassword('');
      setTenantConfirmPassword('');
    } catch (err) {
      console.error('Erro ao alterar senha:', err);
      setPasswordFeedback({ type: 'error', text: 'Erro ao atualizar a senha. Tente novamente.' });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const previewStoreStatus = getStoreOperatingStatus({
    horarioSegSex,
    horarioSab,
    horarioDom,
    horarioObservacoes,
    horarioFuncionamento
  });

  // Paletas pré-definidas com 4 cores harmoniosas para supermercados
  const colorPresets = [
    {
      name: 'Supermercado Tradicional',
      p: '#16a34a', // Verde
      s: '#f59e0b', // Amarelo
      t: '#dc2626', // Vermelho
      q: '#ffffff'  // Branco
    },
    {
      name: 'Atacarejo & Ofertas',
      p: '#dc2626', // Vermelho
      s: '#eab308', // Amarelo
      t: '#ea580c', // Laranja
      q: '#0f172a'  // Grafite
    },
    {
      name: 'Hipermercado Moderno',
      p: '#2563eb', // Azul Real
      s: '#06b6d4', // Ciano
      t: '#f59e0b', // Âmbar Ouro
      q: '#0f172a'  // Azul Noite
    },
    {
      name: 'Empório & Gourmet',
      p: '#15803d', // Verde Oliva
      s: '#b45309', // Dourado
      t: '#fef3c7', // Bege
      q: '#78350f'  // Marrom Café
    },
    {
      name: 'Hortifrúti & Natural',
      p: '#059669', // Esmeralda
      s: '#84cc16', // Lima
      t: '#f97316', // Cenoura
      q: '#ffffff'  // Branco
    }
  ];

  const applyPreset = (preset: typeof colorPresets[0]) => {
    setBrandPrimaryColor(preset.p);
    setBrandSecondaryColor(preset.s);
    setBrandTertiaryColor(preset.t);
    setBrandQuaternaryColor(preset.q);
  };

  const handleAddExtraColor = () => {
    if (newExtraColor && !brandExtraColors.includes(newExtraColor)) {
      setBrandExtraColors([...brandExtraColors, newExtraColor]);
      setShowAddColorInput(false);
    }
  };

  const handleRemoveExtraColor = (indexToRemove: number) => {
    setBrandExtraColors(brandExtraColors.filter((_, idx) => idx !== indexToRemove));
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-5 gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 bg-purple-500/10 text-purple-400 rounded-xl border border-purple-500/20">
              <Palette className="w-5 h-5" />
            </span>
            <span className="text-[11px] font-black uppercase tracking-widest text-purple-400">
              Identidade Visual & Operação
            </span>
          </div>
          <h3 className="text-2xl font-black text-white mt-1">
            Configurações, Cores e Horários
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Personalize a imagem splash vertical com a logo oficial, a paleta de 4 ou mais cores e os horários de funcionamento do seu supermercado.
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            type="button"
            onClick={onSaveSettings}
            disabled={isSavingSettings}
            className="flex items-center space-x-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-lg shadow-emerald-600/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{isSavingSettings ? 'Salvando...' : 'Salvar Alterações'}</span>
          </button>
        </div>
      </div>

      {settingsSavedSuccess && (
        <div className="p-4 bg-emerald-500/20 border border-emerald-500/40 rounded-2xl flex items-center space-x-3 text-xs text-emerald-300 font-bold animate-pulse">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>Configurações, cores e horários salvos com sucesso! As alterações já estão sincronizadas com o banco de dados e visíveis para os clientes.</span>
        </div>
      )}

      {/* Grid: Coluna da Esquerda (Formulário) e Coluna da Direita (Mockup Celular) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Form Controls */}
        <form onSubmit={onSaveSettings} className="lg:col-span-7 space-y-6">

          {/* 1. HORÁRIOS DE FUNCIONAMENTO */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div>
                <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-400" />
                  Horário de Funcionamento do Supermercado
                </h4>
                <p className="text-[11px] text-slate-400">
                  Os horários definem se o selo &quot;Aberto&quot; ou &quot;Fechado&quot; aparece automaticamente no cabeçalho.
                </p>
              </div>

              <div className="text-right">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  previewStoreStatus.isOpen 
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}>
                  {previewStoreStatus.isOpen ? '● Loja Aberta Agora' : '○ Loja Fechada Agora'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span>Segunda a Sexta</span>
                </label>
                <input
                  type="text"
                  value={horarioSegSex}
                  onChange={(e) => setHorarioSegSex(e.target.value)}
                  placeholder="Ex: 07:00 às 21:30"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span>Sábados</span>
                </label>
                <input
                  type="text"
                  value={horarioSab}
                  onChange={(e) => setHorarioSab(e.target.value)}
                  placeholder="Ex: 07:00 às 21:00"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span>Domingos e Feriados</span>
                </label>
                <input
                  type="text"
                  value={horarioDom}
                  onChange={(e) => setHorarioDom(e.target.value)}
                  placeholder="Ex: 08:00 às 14:00"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="space-y-1.5 pt-1">
              <label className="text-xs font-bold text-slate-300">
                Observações de Atendimento (Opcional)
              </label>
              <input
                type="text"
                value={horarioObservacoes}
                onChange={(e) => setHorarioObservacoes(e.target.value)}
                placeholder="Ex: No almoço de domingo fechamos às 14h. Estacionamento gratuito."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* 2. CORES DO ESTABELECIMENTO (PALETA DE 4 OU MAIS CORES) */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div>
                <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
                  <Palette className="w-4 h-4 text-purple-400" />
                  Paleta de Cores da Marca (4 ou mais cores)
                </h4>
                <p className="text-[11px] text-slate-400">
                  Configure até quatro ou mais cores oficiais da sua marca para acompanhar fielmente a logo do supermercado.
                </p>
              </div>
            </div>

            {/* Barra Visual da Paleta Completa */}
            <div className="space-y-1.5 bg-slate-900/90 p-3 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Pré-visualização da Paleta da Loja:
                </span>
                <span className="text-[10px] text-purple-300 font-bold">
                  {4 + brandExtraColors.length} Cores Ativas
                </span>
              </div>
              <div className="flex h-6 rounded-lg overflow-hidden border border-slate-700 shadow-inner">
                <div style={{ backgroundColor: brandPrimaryColor }} className="flex-1 transition-all" title={`Cor 1 (Primária): ${brandPrimaryColor}`} />
                <div style={{ backgroundColor: brandSecondaryColor }} className="flex-1 transition-all" title={`Cor 2 (Secundária): ${brandSecondaryColor}`} />
                <div style={{ backgroundColor: brandTertiaryColor }} className="flex-1 transition-all" title={`Cor 3 (Terciária): ${brandTertiaryColor}`} />
                <div style={{ backgroundColor: brandQuaternaryColor }} className="flex-1 transition-all" title={`Cor 4 (Quaternária): ${brandQuaternaryColor}`} />
                {brandExtraColors.map((color, idx) => (
                  <div key={idx} style={{ backgroundColor: color }} className="flex-1 transition-all" title={`Cor Extra ${idx + 1}: ${color}`} />
                ))}
              </div>
            </div>

            {/* Sugestões de Paletas Prontas de Supermercado com 4 Cores */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Paletas Harmoniosas Prontas (4 Cores):
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {colorPresets.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className="flex items-center justify-between p-2 bg-slate-900 hover:bg-slate-800 rounded-xl border border-slate-800 hover:border-slate-700 text-left transition-all cursor-pointer group"
                  >
                    <span className="text-xs font-bold text-slate-200 group-hover:text-white truncate">
                      {preset.name}
                    </span>
                    <div className="flex space-x-1 shrink-0 ml-2">
                      <span className="w-3.5 h-3.5 rounded-full border border-white/20" style={{ backgroundColor: preset.p }} />
                      <span className="w-3.5 h-3.5 rounded-full border border-white/20" style={{ backgroundColor: preset.s }} />
                      <span className="w-3.5 h-3.5 rounded-full border border-white/20" style={{ backgroundColor: preset.t }} />
                      <span className="w-3.5 h-3.5 rounded-full border border-white/20" style={{ backgroundColor: preset.q }} />
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* As 4 Cores Principais */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800/80">
              
              {/* Cor 1: Primária */}
              <div className="space-y-1.5 bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: brandPrimaryColor }} />
                    Cor 1 - Primária (Principal)
                  </label>
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                    {brandPrimaryColor}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">Botões principais, cabeçalho e destaques</p>
                <div className="flex items-center space-x-2 pt-1">
                  <input
                    type="color"
                    value={brandPrimaryColor}
                    onChange={(e) => setBrandPrimaryColor(e.target.value)}
                    className="w-9 h-9 rounded-lg cursor-pointer bg-transparent border-0 p-0 shrink-0"
                  />
                  <input
                    type="text"
                    value={brandPrimaryColor}
                    onChange={(e) => setBrandPrimaryColor(e.target.value)}
                    placeholder="#16a34a"
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono uppercase focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Cor 2: Secundária */}
              <div className="space-y-1.5 bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: brandSecondaryColor }} />
                    Cor 2 - Secundária (Acentos)
                  </label>
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                    {brandSecondaryColor}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">Selos de oferta, preços promocionais e tags</p>
                <div className="flex items-center space-x-2 pt-1">
                  <input
                    type="color"
                    value={brandSecondaryColor}
                    onChange={(e) => setBrandSecondaryColor(e.target.value)}
                    className="w-9 h-9 rounded-lg cursor-pointer bg-transparent border-0 p-0 shrink-0"
                  />
                  <input
                    type="text"
                    value={brandSecondaryColor}
                    onChange={(e) => setBrandSecondaryColor(e.target.value)}
                    placeholder="#f59e0b"
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono uppercase focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Cor 3: Terciária */}
              <div className="space-y-1.5 bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: brandTertiaryColor }} />
                    Cor 3 - Terciária (Bordas & Realces)
                  </label>
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                    {brandTertiaryColor}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">Bordas dinâmicas, ícones e linhas de divisão</p>
                <div className="flex items-center space-x-2 pt-1">
                  <input
                    type="color"
                    value={brandTertiaryColor}
                    onChange={(e) => setBrandTertiaryColor(e.target.value)}
                    className="w-9 h-9 rounded-lg cursor-pointer bg-transparent border-0 p-0 shrink-0"
                  />
                  <input
                    type="text"
                    value={brandTertiaryColor}
                    onChange={(e) => setBrandTertiaryColor(e.target.value)}
                    placeholder="#dc2626"
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono uppercase focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Cor 4: Quaternária */}
              <div className="space-y-1.5 bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: brandQuaternaryColor }} />
                    Cor 4 - Quaternária (Contraste & Fundo)
                  </label>
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                    {brandQuaternaryColor}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">Fundos de destaque, cartões e contraste da logo</p>
                <div className="flex items-center space-x-2 pt-1">
                  <input
                    type="color"
                    value={brandQuaternaryColor}
                    onChange={(e) => setBrandQuaternaryColor(e.target.value)}
                    className="w-9 h-9 rounded-lg cursor-pointer bg-transparent border-0 p-0 shrink-0"
                  />
                  <input
                    type="text"
                    value={brandQuaternaryColor}
                    onChange={(e) => setBrandQuaternaryColor(e.target.value)}
                    placeholder="#ffffff"
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono uppercase focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

            </div>

            {/* Cores Extras (5ª, 6ª, etc.) */}
            <div className="space-y-3 pt-2 border-t border-slate-800/80">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-300">
                    Cores Adicionais da Marca (Opcional):
                  </span>
                  <p className="text-[10px] text-slate-500">
                    Adicione mais cores caso sua logo possua mais de 4 tonalidades
                  </p>
                </div>

                {!showAddColorInput && (
                  <button
                    type="button"
                    onClick={() => setShowAddColorInput(true)}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-purple-400 text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar Cor</span>
                  </button>
                )}
              </div>

              {/* Form para adicionar nova cor extra */}
              {showAddColorInput && (
                <div className="flex items-center space-x-2 bg-slate-900 p-2.5 rounded-xl border border-purple-500/40">
                  <input
                    type="color"
                    value={newExtraColor}
                    onChange={(e) => setNewExtraColor(e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 p-0 shrink-0"
                  />
                  <input
                    type="text"
                    value={newExtraColor}
                    onChange={(e) => setNewExtraColor(e.target.value)}
                    placeholder="#ffffff"
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white font-mono uppercase focus:outline-none focus:border-purple-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddExtraColor}
                    className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                  >
                    Salvar Cor
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddColorInput(false)}
                    className="px-2 py-1 text-xs text-slate-400 hover:text-white"
                  >
                    Cancelar
                  </button>
                </div>
              )}

              {/* Lista de Cores Extras já adicionadas */}
              {brandExtraColors.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {brandExtraColors.map((color, idx) => (
                    <div
                      key={idx}
                      className="flex items-center space-x-2 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 text-xs font-mono text-slate-200"
                    >
                      <span className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0" style={{ backgroundColor: color }} />
                      <span>{color}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveExtraColor(idx)}
                        className="text-slate-500 hover:text-red-400 transition-colors cursor-pointer ml-1"
                        title="Remover cor extra"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* 3. IMAGEM SPLASH VERTICAL 1080x1920 (Banner Oficial & Logo do Estabelecimento) */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div>
                <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-purple-400" />
                  Imagem Splash Vertical 1080x1920 (Banner Oficial & Logo)
                </h4>
                <p className="text-[11px] text-slate-400">
                  Foto de fundo vertical que enche a tela com a identidade visual e o logotipo do seu supermercado.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <input
                  type="file"
                  id="branding-splash-file-input"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      processImageFile(file, 1080, 1920, (dataUrl) => {
                        setBrandSplashUrl(dataUrl);
                        // Sincroniza logoUrl para compatibilidade
                        if (!brandLogoUrl) setBrandLogoUrl(dataUrl);
                      }, 'image/jpeg');
                    }
                  }}
                  className="hidden"
                />
                <label
                  htmlFor="branding-splash-file-input"
                  className="inline-flex items-center justify-center space-x-2 px-5 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-black rounded-xl cursor-pointer transition-all shadow-lg shadow-purple-600/20 active:scale-95"
                >
                  <Upload className="w-4 h-4 text-white" />
                  <span>Carregar Arte Vertical / Logo (Celular ou PC)</span>
                </label>

                <span className="text-[11px] text-slate-500">
                  Formato ideal: proporção 9:16 (ex: 1080x1920 pixels)
                </span>
              </div>

              {/* URL Direta Opcional */}
              <div className="pt-1">
                <input
                  type="text"
                  value={brandSplashUrl}
                  onChange={(e) => setBrandSplashUrl(e.target.value)}
                  placeholder="Ou cole a URL direta da imagem vertical de fundo"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Modelos Prontos de Banners Verticais em Alta Definição */}
              <div className="pt-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Modelos de Banners Verticais 1080x1920 em Alta Definição:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { label: '🍇 Frutas Frescas', url: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1080&h=1920&q=80' },
                    { label: '🥩 Açougue & Carnes', url: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1080&h=1920&q=80' },
                    { label: '🥖 Padaria Artesanal', url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1080&h=1920&q=80' },
                    { label: '🏪 Gôndolas & Loja', url: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=1080&h=1920&q=80' },
                    { label: '🍓 Frutas Tropicais', url: 'https://images.unsplash.com/photo-1464965911861-746a04b4bca6?auto=format&fit=crop&w=1080&h=1920&q=80' },
                    { label: '🍷 Adega Gourmet', url: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=1080&h=1920&q=80' }
                  ].map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => setBrandSplashUrl(item.url)}
                      className={`p-1.5 rounded-xl border text-left flex items-center space-x-2 transition-all cursor-pointer ${
                        brandSplashUrl === item.url
                          ? 'bg-purple-950/60 border-purple-500 shadow-md shadow-purple-500/10'
                          : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <img
                        src={item.url}
                        alt={item.label}
                        className="w-8 h-12 object-cover rounded-lg shrink-0 border border-slate-700"
                      />
                      <span className="text-[10px] font-bold text-slate-200 truncate">
                        {item.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 4. DADOS DE CONTATO & INFORMAÇÕES DA LOJA */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div>
                <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
                  <Phone className="w-4 h-4 text-emerald-400" />
                  Contato & Opções da Loja
                </h4>
                <p className="text-[11px] text-slate-400">
                  Telefone para contato dos clientes e endereço físico do supermercado.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1">
                  <Phone className="w-3 h-3 text-emerald-400" />
                  Telefone / WhatsApp do Supermercado
                </label>
                <input
                  type="text"
                  id="input-store-phone"
                  value={storePhone}
                  onChange={(e) => setStorePhone(e.target.value)}
                  placeholder="Ex: (11) 98765-4321"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-emerald-400" />
                  Endereço da Loja
                </label>
                <input
                  type="text"
                  id="input-store-address"
                  value={storeAddress}
                  onChange={(e) => setStoreAddress(e.target.value)}
                  placeholder="Ex: Av. Principal, 1200 - Centro"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-center space-x-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  id="input-aceita-compra-online"
                  checked={storeAceitaCompraOnline}
                  onChange={(e) => setStoreAceitaCompraOnline(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 text-emerald-600 focus:ring-emerald-500 bg-slate-900"
                />
                <span className="text-xs font-bold text-slate-200">
                  Permitir pedidos e compras online pelo app para este supermercado
                </span>
              </label>
            </div>
          </div>

          {/* 5. SEGURANÇA & ALTERAÇÃO DE SENHA DA LOJA */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div>
                <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
                  <Lock className="w-4 h-4 text-purple-400" />
                  Segurança & Senha de Acesso
                </h4>
                <p className="text-[11px] text-slate-400">
                  Altere a senha utilizada para acessar este painel do supermercado.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1">
                  <Key className="w-3 h-3 text-purple-400" />
                  Nova Senha (mínimo 6 dígitos)
                </label>
                <div className="relative">
                  <input
                    type={showPasswordText ? "text" : "password"}
                    id="input-tenant-new-password"
                    value={tenantNewPassword}
                    onChange={(e) => setTenantNewPassword(e.target.value)}
                    placeholder="Digite a nova senha"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordText(!showPasswordText)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hover:text-slate-200"
                  >
                    {showPasswordText ? 'Ocultar' : 'Ver'}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-purple-400" />
                  Confirmar Nova Senha
                </label>
                <input
                  type={showPasswordText ? "text" : "password"}
                  id="input-tenant-confirm-password"
                  value={tenantConfirmPassword}
                  onChange={(e) => setTenantConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                id="btn-alterar-senha-lojista"
                onClick={handleUpdateTenantPassword}
                disabled={isUpdatingPassword || !tenantNewPassword}
                className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center space-x-2 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{isUpdatingPassword ? 'Atualizando Senha...' : 'Atualizar Minha Senha'}</span>
              </button>

              {passwordFeedback && (
                <div className={`text-xs font-bold px-3 py-1.5 rounded-lg ${
                  passwordFeedback.type === 'success' 
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                    : 'bg-red-500/20 text-red-300 border border-red-500/30'
                }`}>
                  {passwordFeedback.text}
                </div>
              )}
            </div>
          </div>

          {/* Botão Salvar Todas as Configurações */}
          <div className="pt-2">
            <button
              type="submit"
              id="btn-salvar-configuracoes-loja"
              disabled={isSavingSettings}
              className="w-full py-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm rounded-2xl shadow-xl shadow-emerald-600/20 active:scale-95 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-5 h-5" />
              <span>{isSavingSettings ? 'Salvando Configurações no Banco de Dados...' : 'Salvar Todas as Configurações da Loja'}</span>
            </button>

            {settingsSavedSuccess && (
              <div className="mt-3 p-4 bg-emerald-500/20 border border-emerald-500/40 rounded-xl flex items-center space-x-2 text-xs text-emerald-300 font-bold animate-pulse">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>Configurações salvas com sucesso! Cores, logo e horários de funcionamento já foram atualizados no app do cliente.</span>
              </div>
            )}
          </div>

        </form>

        {/* Right Column: Live Mockup Smartphone 1080x1920 Simulation */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <div className="w-full max-w-[320px] bg-slate-950 rounded-[40px] p-3 shadow-2xl border-4 border-slate-800 space-y-2">
            <div className="text-center py-1 border-b border-slate-800/80">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                Visualização do Banner Vertical & Logo (9:16)
              </span>
            </div>

            {/* Smartphone Screen in 1080x1920 proportion */}
            <div 
              className="relative rounded-[32px] overflow-hidden aspect-[9/16] w-full flex flex-col justify-between p-4 border border-slate-800 shadow-inner bg-slate-950"
              style={{
                backgroundImage: `url(${brandSplashUrl || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1080&h=1920&q=80'})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}
            >
              {/* Subtle Dark Vignette gradient to ensure buttons and badges remain readable without blocking the artwork */}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-slate-950/60 pointer-events-none" />

              {/* Top Bar inside Phone */}
              <div className="relative z-10 flex items-center justify-between">
                <span 
                  className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full border text-white shadow-sm"
                  style={{ backgroundColor: `${brandPrimaryColor}80`, borderColor: brandTertiaryColor || brandPrimaryColor }}
                >
                  Supermercado Oficial
                </span>
                <span className={`text-[8px] font-bold px-2 py-0.5 rounded uppercase ${
                  previewStoreStatus.isOpen 
                    ? 'bg-emerald-500/90 text-white' 
                    : 'bg-amber-500/90 text-slate-950 font-black'
                }`}>
                  {previewStoreStatus.isOpen ? '● Aberto' : '○ Fechado'}
                </span>
              </div>

              {/* Center: Clean & Unobstructed */}
              {/* Note: The square logo box and superimposed store name have been hidden as requested, allowing the vertical splash artwork with the official logo to shine through unobstructed! */}
              <div className="relative z-10 text-center flex flex-col items-center my-auto py-2">
                {/* Horários discretos flutuantes na base do banner */}
                <div 
                  className="px-3 py-1 rounded-full border backdrop-blur-md shadow-lg"
                  style={{
                    backgroundColor: 'rgba(15, 23, 42, 0.75)',
                    borderColor: brandTertiaryColor || 'rgba(255, 255, 255, 0.2)'
                  }}
                >
                  <p className="text-[9px] text-emerald-300 font-bold flex items-center justify-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    <span>{previewStoreStatus.todaySchedule}</span>
                  </p>
                </div>
              </div>

              {/* Bottom: Simulated Client Login Buttons in Primary, Secondary & Quaternary Colors */}
              <div className="relative z-10 space-y-1.5 pt-2">
                <button
                  type="button"
                  className="w-full py-2.5 rounded-xl text-[11px] font-black text-white shadow-lg flex items-center justify-center space-x-1 transition-transform active:scale-95"
                  style={{
                    backgroundColor: brandPrimaryColor,
                    boxShadow: `0 4px 14px ${brandPrimaryColor}60`
                  }}
                >
                  <span>Entrar na Minha Conta</span>
                </button>

                <button
                  type="button"
                  className="w-full py-2 rounded-xl text-[10px] font-extrabold bg-slate-950/80 backdrop-blur-sm border flex items-center justify-center"
                  style={{ 
                    borderColor: brandSecondaryColor, 
                    color: brandSecondaryColor 
                  }}
                >
                  <span>Criar Cadastro no Supermercado</span>
                </button>

                {/* Micro barra mostrando as 4+ cores aplicadas */}
                <div className="flex items-center justify-center gap-1 pt-1">
                  <span className="w-2 h-2 rounded-full border border-white/20" style={{ backgroundColor: brandPrimaryColor }} title="Cor 1" />
                  <span className="w-2 h-2 rounded-full border border-white/20" style={{ backgroundColor: brandSecondaryColor }} title="Cor 2" />
                  <span className="w-2 h-2 rounded-full border border-white/20" style={{ backgroundColor: brandTertiaryColor }} title="Cor 3" />
                  <span className="w-2 h-2 rounded-full border border-white/20" style={{ backgroundColor: brandQuaternaryColor }} title="Cor 4" />
                  {brandExtraColors.map((c, i) => (
                    <span key={i} className="w-2 h-2 rounded-full border border-white/20" style={{ backgroundColor: c }} title={`Cor Extra ${i + 1}`} />
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
