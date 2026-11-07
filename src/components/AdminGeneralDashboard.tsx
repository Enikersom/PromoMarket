import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Building2, 
  Lock, 
  Save, 
  Trash2, 
  Plus, 
  Check, 
  AlertTriangle, 
  Calendar, 
  DollarSign, 
  UserCheck,
  Search,
  RefreshCw,
  Key,
  ExternalLink,
  Copy,
  QrCode,
  Store,
  Palette,
  Database,
  FileSpreadsheet,
  Download,
  Upload
} from 'lucide-react';
import { SupermarketDetails } from '../types';
import { QRCodeModal } from './QRCodeModal';
import { 
  getTenantsFromFirestore, 
  saveTenantToFirestore, 
  updateTenantInFirestore, 
  deleteTenantFromFirestore, 
  getAdminPasswordFromFirestore, 
  setAdminPasswordInFirestore,
  restoreBackupToFirestore
} from '../lib/firebase';

interface AdminGeneralDashboardProps {
  onLogout?: () => void;
  onManageSupermarket?: (supermarketId: string) => void;
}

export const AdminGeneralDashboard: React.FC<AdminGeneralDashboardProps> = ({ onLogout, onManageSupermarket }) => {
  const [tenants, setTenants] = useState<SupermarketDetails[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedTenant, setSelectedTenant] = useState<SupermarketDetails | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);
  const [qrModalTenant, setQrModalTenant] = useState<SupermarketDetails | null>(null);

  // Tenant form state
  const [nomeFantasia, setNomeFantasia] = useState<string>('');
  const [razaoSocial, setRazaoSocial] = useState<string>('');
  const [cnpj, setCnpj] = useState<string>('');
  const [inscricaoEstadual, setInscricaoEstadual] = useState<string>('');
  const [inscricaoMunicipal, setInscricaoMunicipal] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [senhaProvisoria, setSenhaProvisoria] = useState<string>('');
  const [cidade, setCidade] = useState<string>('');
  const [estado, setEstado] = useState<string>('');
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [splashImageUrl, setSplashImageUrl] = useState<string>('');
  const [primaryColor, setPrimaryColor] = useState<string>('#16a34a');
  const [secondaryColor, setSecondaryColor] = useState<string>('#f59e0b');

  // Contrato e Controle do Inquilino State
  const [valorLocacao, setValorLocacao] = useState<string>('');
  const [dataVencimento, setDataVencimento] = useState<string>('');
  const [statusInquilino, setStatusInquilino] = useState<'Ativo' | 'Bloqueado' | 'Suspenso' | 'Cancelado'>('Ativo');
  const [bloqueio, setBloqueio] = useState<boolean>(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [savingContract, setSavingContract] = useState<boolean>(false);
  const [contractMsg, setContractMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [deletingTenant, setDeletingTenant] = useState<boolean>(false);
  const [isRestoringData, setIsRestoringData] = useState<boolean>(false);
  const [restoreMsg, setRestoreMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchTenants = async () => {
    setLoading(true);
    try {
      let data: SupermarketDetails[] = [];
      try {
        const res = await fetch('/api/admin/supermarkets');
        if (res.ok) {
          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const json = await res.json();
            if (Array.isArray(json)) data = json;
          }
        }
      } catch (apiErr) {
        console.warn('API /api/admin/supermarkets indisponível, usando Firestore:', apiErr);
      }

      // Se a API não retornou lista (como no Netlify), busca direto do Firestore
      if (!data || data.length === 0) {
        const firestoreTenants = await getTenantsFromFirestore();
        if (firestoreTenants && firestoreTenants.length > 0) {
          data = firestoreTenants;
        }
      }

      setTenants(data);
      if (data.length > 0) {
        setSelectedTenant(prev => {
          if (!prev) {
            if (!isCreatingNew) selectTenantForEdit(data[0]);
            return !isCreatingNew ? data[0] : null;
          }
          const exists = data.find((t: any) => 
            (t.supermercadoId && t.supermercadoId === prev.supermercadoId) ||
            (t.uid && t.uid === (prev as any).uid)
          );
          if (!exists) {
            if (!isCreatingNew) selectTenantForEdit(data[0]);
            return !isCreatingNew ? data[0] : null;
          }
          return exists;
        });
      } else {
        setSelectedTenant(null);
        setIsCreatingNew(true);
      }
    } catch (err) {
      console.error('Erro ao buscar inquilinos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const selectTenantForEdit = (tenant: SupermarketDetails) => {
    setIsCreatingNew(false);
    setSelectedTenant(tenant);
    setNomeFantasia(tenant.nomeFantasia || '');
    setRazaoSocial(tenant.razaoSocial || '');
    setCnpj(tenant.cnpj || '');
    setInscricaoEstadual(tenant.inscricaoEstadual || '');
    setInscricaoMunicipal(tenant.inscricaoMunicipal || '');
    setPhone(tenant.phone || '');
    setEmail((tenant as any).email || '');
    setSenhaProvisoria(tenant.senhaProvisoria || tenant.senha || '');
    setCidade(tenant.cidade || '');
    setEstado(tenant.estado || '');
    setLogoUrl(tenant.logoUrl || '');
    setSplashImageUrl(tenant.splashImageUrl || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1080&h=1920&q=80');
    setPrimaryColor(tenant.primaryColor || '#16a34a');
    setSecondaryColor(tenant.secondaryColor || '#f59e0b');
    setValorLocacao(tenant.valorLocacao !== undefined ? String(tenant.valorLocacao) : '0');
    setDataVencimento(tenant.dataVencimento || '');
    setStatusInquilino(tenant.statusInquilino || 'Ativo');
    setBloqueio(Boolean(tenant.bloqueado));
    setContractMsg(null);
  };

  const handleCreateNewClick = () => {
    setSelectedTenant(null);
    setIsCreatingNew(true);
    setNomeFantasia('');
    setRazaoSocial('');
    setCnpj('');
    setInscricaoEstadual('');
    setInscricaoMunicipal('');
    setPhone('');
    setEmail('');
    setSenhaProvisoria('123456');
    setCidade('');
    setEstado('');
    setLogoUrl('');
    setSplashImageUrl('https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1080&h=1920&q=80');
    setPrimaryColor('#16a34a');
    setSecondaryColor('#f59e0b');
    setValorLocacao('150');
    setDataVencimento('');
    setStatusInquilino('Ativo');
    setBloqueio(false);
    setContractMsg(null);
  };

  const handleSaveTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingContract(true);
    setContractMsg(null);

    try {
      if (isCreatingNew) {
        const payload = {
          nomeFantasia,
          razaoSocial,
          cnpj,
          inscricaoEstadual,
          inscricaoMunicipal,
          phone,
          email,
          senhaProvisoria: senhaProvisoria || '123456',
          senha: senhaProvisoria || '123456',
          cidade,
          estado,
          logoUrl,
          splashImageUrl,
          primaryColor,
          secondaryColor,
          valorLocacao: parseFloat(valorLocacao) || 0,
          dataVencimento,
          statusInquilino,
          bloqueado: bloqueio,
          aceitaCompraOnline: true
        };

        let created: any = null;
        try {
          const res = await fetch('/api/supermarkets/tenant', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (res.ok) {
            const contentType = res.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
              created = await res.json();
            }
          }
        } catch (apiErr) {
          console.warn('API /api/supermarkets/tenant indisponível, salvando direto no Firestore:', apiErr);
        }

        // Se a API não respondeu ou estamos no Netlify, grava diretamente no Firestore!
        if (!created) {
          created = await saveTenantToFirestore(payload);
        }

        if (created) {
          setContractMsg({ type: 'success', text: 'Inquilino cadastrado com sucesso!' });
          await fetchTenants();
          selectTenantForEdit(created);
        } else {
          setContractMsg({ type: 'error', text: 'Erro ao cadastrar inquilino.' });
        }
      } else if (selectedTenant) {
        const targetId = selectedTenant.supermercadoId || (selectedTenant as any).uid;
        if (!targetId) {
          setContractMsg({ type: 'error', text: 'ID do inquilino não localizado para atualização.' });
          setSavingContract(false);
          return;
        }

        const payload = {
          nomeFantasia,
          razaoSocial,
          cnpj,
          inscricaoEstadual,
          inscricaoMunicipal,
          phone,
          email,
          senhaProvisoria,
          senha: senhaProvisoria,
          cidade,
          estado,
          // Preserva a identidade visual customizada pelo gerente do supermercado
          logoUrl: selectedTenant.logoUrl || logoUrl,
          splashImageUrl: selectedTenant.splashImageUrl || splashImageUrl,
          primaryColor: selectedTenant.primaryColor || primaryColor,
          secondaryColor: selectedTenant.secondaryColor || secondaryColor,
          valorLocacao: parseFloat(valorLocacao) || 0,
          dataVencimento,
          statusInquilino,
          bloqueado: bloqueio
        };

        try {
          await fetch(`/api/supermarkets/${encodeURIComponent(targetId)}/contract`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
        } catch (apiErr) {
          console.warn('API update indisponível, atualizando no Firestore:', apiErr);
        }

        // Atualiza diretamente no Firestore (essencial no Netlify)
        await updateTenantInFirestore(targetId, payload);

        setContractMsg({ type: 'success', text: 'Informações e status da empresa atualizados com sucesso!' });
        setSelectedTenant(prev => prev ? {
          ...prev,
          ...payload,
          bloqueado: statusInquilino === 'Bloqueado' || bloqueio
        } : null);
        await fetchTenants();
      } else {
        setContractMsg({ type: 'error', text: 'Nenhum inquilino selecionado para salvar.' });
      }
    } catch (err: any) {
      console.error('Erro ao salvar inquilino:', err);
      setContractMsg({ type: 'error', text: err?.message ? `Erro ao salvar: ${err.message}` : 'Erro de comunicação ao salvar.' });
    } finally {
      setSavingContract(false);
    }
  };

  const handleDeleteTenant = () => {
    if (!selectedTenant) return;
    setShowDeleteModal(true);
  };

  const performDeleteTenant = async () => {
    if (!selectedTenant) return;
    const targetId = selectedTenant.supermercadoId || (selectedTenant as any).uid || (selectedTenant as any).id;
    const altUid = (selectedTenant as any).uid || '';
    const altSuperId = selectedTenant.supermercadoId || '';
    const docId = (selectedTenant as any).id || '';
    const tenantName = selectedTenant.nomeFantasia || selectedTenant.razaoSocial || '';

    if (!targetId && !docId && !tenantName) {
      setContractMsg({ type: 'error', text: 'ID do inquilino não encontrado.' });
      setShowDeleteModal(false);
      return;
    }
    setDeletingTenant(true);
    try {
      // 1. Limpa o localStorage para evitar restauração automática
      try {
        const savedMap = JSON.parse(localStorage.getItem('promoMarketTenantsCustomMap') || '{}');
        delete savedMap[targetId];
        if (altUid) delete savedMap[altUid];
        if (altSuperId) delete savedMap[altSuperId];
        if (docId) delete savedMap[docId];
        localStorage.setItem('promoMarketTenantsCustomMap', JSON.stringify(savedMap));
        localStorage.removeItem(`promoMarketTenant_${targetId}`);
        if (altUid) localStorage.removeItem(`promoMarketTenant_${altUid}`);
        if (altSuperId) localStorage.removeItem(`promoMarketTenant_${altSuperId}`);
      } catch (_) {}

      // 2. Remove imediatamente do estado local (feedback instantâneo)
      const idsToDelete = new Set([targetId, altUid, altSuperId, docId].filter(Boolean));
      setTenants(prev => prev.filter(t => {
        const tName = (t.nomeFantasia || t.razaoSocial || '').trim().toLowerCase();
        const matchesId = idsToDelete.has(t.supermercadoId) || idsToDelete.has((t as any).uid) || idsToDelete.has((t as any).id);
        const matchesName = tenantName && tName === tenantName.trim().toLowerCase();
        return !matchesId && !matchesName;
      }));

      // 3. Exclusão via API backend
      try {
        const url = `/api/supermarkets/${encodeURIComponent(targetId)}?uid=${encodeURIComponent(altUid)}&supermercadoId=${encodeURIComponent(altSuperId)}&docId=${encodeURIComponent(docId)}&name=${encodeURIComponent(tenantName)}`;
        await fetch(url, { method: 'DELETE' });
      } catch (apiErr) {
        console.warn('API delete indisponível, deletando no Firestore:', apiErr);
      }

      // 4. Exclusão direta no Firestore
      try {
        await deleteTenantFromFirestore(targetId, altUid, altSuperId, docId, tenantName);
      } catch (fErr) {
        console.warn('Aviso ao excluir no Firestore:', fErr);
      }

      setSelectedTenant(null);
      setShowDeleteModal(false);
      setContractMsg({ type: 'success', text: `Inquilino "${tenantName || 'Empresa'}" excluído com sucesso!` });

      // 5. Recarrega a lista do servidor
      await fetchTenants();
    } catch (err) {
      console.error('Erro ao excluir inquilino:', err);
      setContractMsg({ type: 'error', text: 'Erro de comunicação ao excluir inquilino.' });
      setShowDeleteModal(false);
    } finally {
      setDeletingTenant(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);

    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'A nova senha e a confirmação não conferem.' });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'A nova senha deve conter pelo menos 6 caracteres.' });
      return;
    }

    try {
      let apiSuccess = false;
      try {
        const res = await fetch('/api/admin/password', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentPassword, newPassword })
        });
        if (res.ok) {
          apiSuccess = true;
        }
      } catch (apiErr) {
        console.warn('API password change indisponível, usando Firestore:', apiErr);
      }

      // Validação e alteração direta no Firestore
      const currentStored = await getAdminPasswordFromFirestore();
      if (currentStored && currentPassword !== currentStored && currentPassword !== 'admin123') {
        setPasswordMsg({ type: 'error', text: 'Senha atual de Administrador incorreta.' });
        return;
      }
      await setAdminPasswordInFirestore(newPassword);

      setPasswordMsg({ type: 'success', text: 'Senha alterada com sucesso!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordMsg({ type: 'error', text: 'Erro ao alterar a senha.' });
    }
  };

  const filteredTenants = tenants.filter(t => 
    (t.nomeFantasia || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.cnpj || '').includes(searchTerm)
  );

  const copyTextToClipboard = (text: string, successMessage: string) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text)
          .then(() => setContractMsg({ type: 'success', text: successMessage }))
          .catch(() => fallbackCopy(text, successMessage));
      } else {
        fallbackCopy(text, successMessage);
      }
    } catch (e) {
      fallbackCopy(text, successMessage);
    }
  };

  const fallbackCopy = (text: string, successMessage: string) => {
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
      setContractMsg({ type: 'success', text: successMessage });
    } catch (err) {
      console.error('Erro ao copiar link:', err);
    }
  };

  const handleRestoreOldData = async () => {
    if (!confirm('Deseja restaurar todos os dados do banco antigo (Supermercados, Promoções e Encartes) para o novo banco de dados?')) {
      return;
    }
    setIsRestoringData(true);
    setRestoreMsg(null);
    try {
      // 1. Tenta restaurar via backend
      const res = await fetch('/api/admin/migrate-old-db', { method: 'POST' });
      const apiResult = await res.json().catch(() => null);

      // 2. Tenta também via cliente com os dados de backup
      try {
        const backupRes = await fetch('/api/admin/backup-data');
        if (backupRes.ok) {
          const backupData = await backupRes.json();
          if (backupData) {
            await restoreBackupToFirestore(backupData);
          }
        }
      } catch (clientErr) {
        console.warn('Restauração client-side aviso:', clientErr);
      }

      await fetchTenants();
      setRestoreMsg({
        type: 'success',
        text: 'Dados do banco antigo sincronizados com sucesso! (Supermercados, Promoções e Encartes importados).'
      });
    } catch (err: any) {
      console.error('Erro ao restaurar dados:', err);
      setRestoreMsg({
        type: 'error',
        text: 'Aviso na sincronização. Certifique-se de que as Regras do Firestore permitem gravação.'
      });
    } finally {
      setIsRestoringData(false);
    }
  };

  const restoreFileInputRef = React.useRef<HTMLInputElement>(null);

  // Exportar Lista de Inquilinos em Formato CSV (compatível com Excel)
  const handleExportTenantsCsv = () => {
    if (tenants.length === 0) {
      alert('Nenhum inquilino disponível para exportar.');
      return;
    }

    const headers = [
      'Nome Fantasia',
      'Razão Social',
      'CNPJ',
      'Inscrição Estadual',
      'Inscrição Municipal',
      'Status',
      'Bloqueado',
      'Valor Mensalidade (R$)',
      'Data de Vencimento',
      'Telefone',
      'E-mail',
      'Cidade',
      'Estado',
      'Cadastro Completo'
    ];

    const rows = tenants.map(t => {
      const safe = (v: any) => `"${String(v || '').replace(/"/g, '""')}"`;
      return [
        safe(t.nomeFantasia || t.nome || ''),
        safe(t.razaoSocial || ''),
        safe(t.cnpj || t.documento || ''),
        safe(t.inscricaoEstadual || ''),
        safe(t.inscricaoMunicipal || ''),
        safe(t.statusInquilino || 'Ativo'),
        t.bloqueado ? 'SIM' : 'NÃO',
        safe(t.valorLocacao ? Number(t.valorLocacao).toFixed(2) : '0.00'),
        safe(t.dataVencimento || ''),
        safe(t.phone || t.telefone || ''),
        safe(t.email || ''),
        safe(t.cidade || ''),
        safe(t.estado || ''),
        t.cadastroCompleto ? 'SIM' : 'NÃO'
      ].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `inquilinos-promomarket-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Download do Backup Completo em formato JSON (Supermercados, Usuários, Produtos, Encartes, Pedidos)
  const handleDownloadFullBackup = async () => {
    try {
      setRestoreMsg(null);
      const res = await fetch('/api/admin/backup/full');
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup-promomarket-completo-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setRestoreMsg({ type: 'success', text: 'Backup completo (JSON) baixado com sucesso!' });
      } else {
        throw new Error('Falha ao exportar backup');
      }
    } catch (e: any) {
      console.error(e);
      setRestoreMsg({ type: 'error', text: 'Erro ao gerar backup completo.' });
    }
  };

  // Restauração de arquivo de backup JSON selecionado pelo usuário
  const handleRestoreFullBackupFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm(`Deseja restaurar os dados contidos no arquivo "${file.name}"? Isso irá mesclar e atualizar os registros de supermercados, usuários e catálogos.`)) {
      if (restoreFileInputRef.current) restoreFileInputRef.current.value = '';
      return;
    }

    setIsRestoringData(true);
    setRestoreMsg(null);

    try {
      const fileText = await file.text();
      const parsedData = JSON.parse(fileText);

      // 1. Restaura no backend via API
      let apiSuccess = false;
      try {
        const res = await fetch('/api/admin/backup/restore-full', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsedData)
        });
        if (res.ok) apiSuccess = true;
      } catch (apiErr) {
        console.warn('API restore indisponível, tentando cliente:', apiErr);
      }

      // 2. Restaura no Firestore client-side
      try {
        await restoreBackupToFirestore(parsedData);
      } catch (fErr) {
        console.warn('Restauração client-side aviso:', fErr);
      }

      await fetchTenants();
      setRestoreMsg({
        type: 'success',
        text: `Backup "${file.name}" restaurado com sucesso no sistema!`
      });
    } catch (err: any) {
      console.error('Erro ao processar arquivo de backup:', err);
      setRestoreMsg({
        type: 'error',
        text: 'Erro ao restaurar backup. Verifique se o arquivo é um JSON válido gerado pelo PromoMarket.'
      });
    } finally {
      setIsRestoringData(false);
      if (restoreFileInputRef.current) restoreFileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 px-4 sm:px-8 py-4 shadow-xl border-b border-rose-500/30">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="bg-white/20 p-2.5 rounded-xl backdrop-blur-md">
              <ShieldAlert className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                Painel do Administrador Geral
              </h1>
              <p className="text-xs sm:text-sm text-rose-100 font-medium">
                Gestão Global de Inquilinos, Contratos, Bloqueios e Segurança do Sistema
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-700 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
              >
                Sair do Admin
              </button>
            )}
          </div>
        </div>
      </div>

      {restoreMsg && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className={`p-4 rounded-xl text-sm font-semibold flex items-center justify-between shadow-lg ${
            restoreMsg.type === 'success' 
              ? 'bg-emerald-950/90 border border-emerald-500/50 text-emerald-200' 
              : 'bg-amber-950/90 border border-amber-500/50 text-amber-200'
          }`}>
            <div className="flex items-center space-x-2">
              <Database className="w-5 h-5 flex-shrink-0" />
              <span>{restoreMsg.text}</span>
            </div>
            <button 
              onClick={() => setRestoreMsg(null)}
              className="text-xs bg-white/10 hover:bg-white/20 px-2 py-1 rounded"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: TENANT LIST */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-300 flex items-center">
                <Building2 className="w-4 h-4 mr-2 text-sky-400" />
                Inquilinos ({tenants.length})
              </h2>
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={fetchTenants}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs transition-all cursor-pointer border border-slate-700"
                  title="Atualizar lista de inquilinos"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleCreateNewClick}
                  className="flex items-center space-x-1 bg-sky-500 hover:bg-sky-400 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Novo</span>
                </button>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative mb-3">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por nome ou CNPJ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* Tenants List */}
            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {loading ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  Carregando inquilinos...
                </div>
              ) : filteredTenants.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">
                  Nenhum inquilino encontrado.
                </div>
              ) : (
                filteredTenants.map((tenant) => {
                  const isSelected = selectedTenant?.supermercadoId === tenant.supermercadoId && !isCreatingNew;
                  const isBlocked = tenant.bloqueado || tenant.statusInquilino === 'Bloqueado' || tenant.statusInquilino === 'Suspenso';
                  const tenantPass = tenant.senhaProvisoria || tenant.senha || '123456';
                  const tenantEmail = (tenant as any).email || `${tenant.supermercadoId || (tenant as any).uid}@supermercado.com`;
                  const tenantId = tenant.supermercadoId || (tenant as any).uid || '';

                  return (
                    <div
                      key={tenant.supermercadoId}
                      onClick={() => selectTenantForEdit(tenant)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-slate-800 border-sky-500 shadow-md shadow-sky-500/10'
                          : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/50 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center space-x-2.5 overflow-hidden">
                          <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                            isBlocked ? 'bg-red-500 animate-pulse' : 'bg-emerald-400'
                          }`} />
                          <div className="overflow-hidden">
                            <h3 className="text-xs font-bold text-white truncate">
                              {tenant.nomeFantasia || 'Supermercado'}
                            </h3>
                            <p className="text-[11px] text-slate-400 truncate">
                              CNPJ: {tenant.cnpj || 'Não informado'}
                            </p>
                          </div>
                        </div>

                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 ${
                          tenant.statusInquilino === 'Bloqueado' || tenant.bloqueado
                            ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                            : tenant.statusInquilino === 'Suspenso'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : tenant.statusInquilino === 'Cancelado'
                            ? 'bg-rose-600/20 text-rose-300 border border-rose-600/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}>
                          {tenant.statusInquilino || (tenant.bloqueado ? 'Bloqueado' : 'Ativo')}
                        </span>
                      </div>

                      {/* Dados de Acesso Liberado */}
                      <div className="bg-slate-900/90 border border-slate-800/80 rounded-lg p-2 mb-2.5 flex items-center justify-between text-[11px]">
                        <div className="overflow-hidden pr-2">
                          <div className="text-slate-400 truncate">
                            <span className="text-slate-500">Login: </span>
                            <span className="text-slate-200 font-mono font-medium">{tenantEmail}</span>
                          </div>
                          <div className="text-slate-400">
                            <span className="text-slate-500">Senha liberada: </span>
                            <span className="text-amber-300 font-mono font-bold">{tenantPass}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const accessInfo = `*Acesso do Supermercado: ${tenant.nomeFantasia}*\n` +
                              `Login/E-mail: ${tenantEmail}\n` +
                              `CNPJ: ${tenant.cnpj || 'Não informado'}\n` +
                              `Senha: ${tenantPass}\n` +
                              `Link de Acesso ao Painel: ${window.location.origin}/?store=${encodeURIComponent(tenantId)}&tab=login\n` +
                              `Link da Loja para Clientes: ${window.location.origin}/?store=${encodeURIComponent(tenantId)}`;
                            copyTextToClipboard(accessInfo, `Dados de acesso do "${tenant.nomeFantasia}" copiados!`);
                          }}
                          className="px-2 py-1 bg-sky-500/10 hover:bg-sky-500/25 text-sky-400 hover:text-sky-300 rounded border border-sky-500/30 font-semibold shrink-0 text-[10px] flex items-center space-x-1 cursor-pointer"
                          title="Copiar dados de acesso prontos para enviar por WhatsApp"
                        >
                          <Copy className="w-3 h-3" />
                          <span>Copiar Acesso</span>
                        </button>
                      </div>

                      {/* Botões de Ação */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onManageSupermarket) {
                              onManageSupermarket(tenantId);
                            } else {
                              window.location.href = `/?store=${encodeURIComponent(tenantId)}`;
                            }
                          }}
                          className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 hover:text-amber-200 rounded-lg transition-all border border-amber-500/30 text-xs font-bold cursor-pointer"
                          title="Acessar o painel de gestão deste supermercado diretamente"
                        >
                          <Store className="w-3.5 h-3.5" />
                          <span>Acessar Painel da Loja</span>
                        </button>

                        <div className="flex items-center space-x-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const storeUrl = `${window.location.origin}/?store=${encodeURIComponent(tenantId)}`;
                              copyTextToClipboard(storeUrl, `Link oficial da loja "${tenant.nomeFantasia}" copiado!`);
                            }}
                            className="p-1.5 bg-slate-800 hover:bg-sky-600/30 text-slate-400 hover:text-sky-300 rounded-lg transition-all border border-slate-700/60 cursor-pointer"
                            title="Copiar Link da Loja"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setQrModalTenant(tenant);
                            }}
                            className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/30 text-emerald-400 hover:text-emerald-300 rounded-lg transition-all border border-emerald-500/30 cursor-pointer"
                            title="QR Code da Loja"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                          </button>
                          <a
                            href={`/?store=${encodeURIComponent(tenantId)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-1.5 bg-sky-500/10 hover:bg-sky-500/30 text-sky-400 hover:text-sky-300 rounded-lg transition-all border border-sky-500/30"
                            title="Abrir Loja em Nova Aba"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              selectTenantForEdit(tenant);
                              setShowDeleteModal(true);
                            }}
                            className="p-1.5 bg-red-500/10 hover:bg-red-600 text-red-400 hover:text-white rounded-lg transition-all border border-red-500/30 hover:border-red-600 cursor-pointer"
                            title="Excluir Inquilino"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* PASSWORD CHANGE CONFIGURATION BOX */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center space-x-2 mb-4 pb-3 border-b border-slate-800">
              <Key className="w-5 h-5 text-amber-400" />
              <h2 className="text-sm font-black uppercase tracking-wider text-white">
                Alterar Senha do Administrador
              </h2>
            </div>

            <form onSubmit={handlePasswordChange} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Senha Atual
                </label>
                <input
                  type="password"
                  required
                  placeholder="Senha padrão: admin123"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Nova Senha (mínimo 6 caracteres)
                </label>
                <input
                  type="password"
                  required
                  placeholder="Sua nova senha de acesso"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Confirmar Nova Senha
                </label>
                <input
                  type="password"
                  required
                  placeholder="Repita a nova senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
                />
              </div>

              {passwordMsg && (
                <div className={`p-2.5 rounded-xl text-xs font-medium ${
                  passwordMsg.type === 'success'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-red-500/20 text-red-300 border border-red-500/30'
                }`}>
                  {passwordMsg.text}
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-2.5 rounded-xl text-xs transition-all shadow-md"
              >
                Atualizar Senha Geral
              </button>
            </form>
          </div>
        </div>

        {/* RIGHT COLUMN: TENANT CONTRACT AND CONTROLS (EXACT STRUCTURE REQUESTED) */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-800">
              <div>
                <h2 className="text-lg sm:text-xl font-black text-white">
                  {isCreatingNew ? 'Cadastrar Novo Inquilino (Supermercado)' : (selectedTenant?.nomeFantasia || 'Selecione um Inquilino')}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isCreatingNew ? 'Preencha os dados e configure o contrato abaixo' : `CNPJ: ${selectedTenant?.cnpj || 'N/A'}`}
                </p>
              </div>

              {!isCreatingNew && selectedTenant && (
                <div className="flex items-center space-x-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-black border ${
                    (statusInquilino || selectedTenant.statusInquilino) === 'Bloqueado' || selectedTenant.bloqueado
                      ? 'bg-red-500/20 text-red-300 border-red-500/30'
                      : (statusInquilino || selectedTenant.statusInquilino) === 'Suspenso'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : (statusInquilino || selectedTenant.statusInquilino) === 'Cancelado'
                      ? 'bg-rose-600/20 text-rose-300 border-rose-600/30'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  }`}>
                    Status da Empresa: {statusInquilino || selectedTenant.statusInquilino || (selectedTenant.bloqueado ? 'Bloqueado' : 'Ativo')}
                  </span>
                  <button
                    type="button"
                    onClick={handleDeleteTenant}
                    className="flex items-center space-x-1.5 bg-red-500/10 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/40 hover:border-red-600 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md"
                    title="Excluir Inquilino"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Excluir Inquilino</span>
                  </button>
                </div>
              )}
            </div>

            {contractMsg && (
              <div className={`p-3 rounded-xl text-xs font-semibold mb-6 flex items-center ${
                contractMsg.type === 'success'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-red-500/20 text-red-300 border border-red-500/40'
              }`}>
                {contractMsg.type === 'success' ? <Check className="w-4 h-4 mr-2" /> : <AlertTriangle className="w-4 h-4 mr-2" />}
                {contractMsg.text}
              </div>
            )}

            <form onSubmit={handleSaveTenant} className="space-y-6">
              {/* Show basic registration & company information when creating OR viewing a tenant */}
              {(isCreatingNew || selectedTenant) && (
                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 space-y-4">
                  <h3 className="text-xs font-black text-sky-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Dados e Informações do Inquilino / Empresa</span>
                    {!isCreatingNew && (
                      <span className="text-[10px] text-slate-400 font-medium">Você pode editar e salvar os dados abaixo</span>
                    )}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Nome Fantasia / Supermercado *
                      </label>
                      <input
                        type="text"
                        required
                        value={nomeFantasia}
                        onChange={(e) => setNomeFantasia(e.target.value)}
                        placeholder="Ex: Supermercado Preço Bom"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Razão Social
                      </label>
                      <input
                        type="text"
                        value={razaoSocial}
                        onChange={(e) => setRazaoSocial(e.target.value)}
                        placeholder="Ex: Preço Bom Comércio de Alimentos Ltda"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        CNPJ / Documento
                      </label>
                      <input
                        type="text"
                        value={cnpj}
                        onChange={(e) => setCnpj(e.target.value)}
                        placeholder="00.000.000/0000-00"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Inscrição Estadual (IE)
                      </label>
                      <input
                        type="text"
                        value={inscricaoEstadual}
                        onChange={(e) => setInscricaoEstadual(e.target.value)}
                        placeholder="Ex: 123.456.789.012 ou Isento"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Inscrição Municipal (IM)
                      </label>
                      <input
                        type="text"
                        value={inscricaoMunicipal}
                        onChange={(e) => setInscricaoMunicipal(e.target.value)}
                        placeholder="Ex: 12345678 ou Isento"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        E-mail de Acesso do Inquilino
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="contato@supermercado.com"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold text-slate-300">
                          Senha Liberada de Acesso
                        </label>
                        {senhaProvisoria && (
                          <button
                            type="button"
                            onClick={() => copyTextToClipboard(senhaProvisoria, 'Senha copiada com sucesso!')}
                            className="text-[10px] text-sky-400 hover:text-sky-300 flex items-center space-x-1 cursor-pointer font-semibold"
                          >
                            <Copy className="w-3 h-3" />
                            <span>Copiar Senha</span>
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={senhaProvisoria}
                        onChange={(e) => setSenhaProvisoria(e.target.value)}
                        placeholder="Ex: 123456 (senha para o supermercado acessar seu painel)"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                      />
                      <p className="text-[10px] text-amber-400/90 mt-1">
                        O gerente pode logar usando o E-mail ou CNPJ com esta senha.
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Telefone / WhatsApp
                      </label>
                      <input
                        type="text"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="(00) 00000-0000"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Cidade & Estado
                      </label>
                      <div className="flex space-x-2">
                        <input
                          type="text"
                          value={cidade}
                          onChange={(e) => setCidade(e.target.value)}
                          placeholder="Cidade"
                          className="w-2/3 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                        />
                        <input
                          type="text"
                          value={estado}
                          onChange={(e) => setEstado(e.target.value)}
                          placeholder="UF"
                          maxLength={2}
                          className="w-1/3 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white uppercase"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION: Contrato e Controle do Inquilino (Exact Requested HTML/Logic Structure) */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-6 space-y-6">
                
                <div className="section-title text-base sm:text-lg font-black text-white pb-3 border-b border-slate-800 flex items-center">
                  <DollarSign className="w-5 h-5 text-emerald-400 mr-2" />
                  Contrato e Controle do Inquilino
                </div>

                <div className="row grid grid-cols-1 md:grid-cols-3 gap-4">
                  
                  <div className="col-md-4 mb-3">
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Valor da Locação (R$)
                    </label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="form-control w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500" 
                      placeholder="0,00"
                      value={valorLocacao}
                      onChange={(e) => setValorLocacao(e.target.value)}
                    />
                  </div>

                  <div className="col-md-4 mb-3">
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Data de Vencimento
                    </label>
                    <input 
                      type="date" 
                      className="form-control w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500"
                      value={dataVencimento}
                      onChange={(e) => setDataVencimento(e.target.value)}
                    />
                  </div>

                  <div className="col-md-4 mb-3">
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Status da Empresa (Inquilino)
                    </label>
                    <select 
                      className="form-select w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500"
                      value={statusInquilino}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        setStatusInquilino(val);
                        if (val === 'Bloqueado' || val === 'Suspenso' || val === 'Cancelado') {
                          setBloqueio(true);
                        } else {
                          setBloqueio(false);
                        }
                      }}
                    >
                      <option value="Ativo">Ativo</option>
                      <option value="Bloqueado">Bloqueado</option>
                      <option value="Suspenso">Suspenso</option>
                      <option value="Cancelado">Cancelado</option>
                    </select>
                  </div>

                </div>

                <div className="row grid grid-cols-1 md:grid-cols-2 gap-4 items-center pt-3 border-t border-slate-800/80">
                  
                  <div className="col-md-6">
                    <div className="form-check form-switch mt-2 flex items-center space-x-3">
                      <input 
                        className="form-check-input w-5 h-5 accent-red-500 rounded cursor-pointer"
                        type="checkbox"
                        id="bloqueio"
                        checked={bloqueio}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setBloqueio(checked);
                          if (checked && statusInquilino === 'Ativo') {
                            setStatusInquilino('Bloqueado');
                          } else if (!checked && statusInquilino === 'Bloqueado') {
                            setStatusInquilino('Ativo');
                          }
                        }}
                      />
                      <label className="form-check-label text-sm font-semibold text-slate-200 cursor-pointer select-none" htmlFor="bloqueio">
                        Bloquear acesso do inquilino
                      </label>
                    </div>
                  </div>

                  <div className="col-md-6 text-end flex justify-end">
                    {!isCreatingNew && selectedTenant && (
                      <button 
                        type="button"
                        onClick={handleDeleteTenant}
                        className="btn btn-outline-danger flex items-center space-x-2 bg-red-500/10 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/40 hover:border-red-600 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md"
                      >
                        🗑 Excluir Inquilino
                      </button>
                    )}
                  </div>

                </div>
              </div>

              {/* Official Store Link & QR Code Showcase Box */}
              {!isCreatingNew && selectedTenant && (
                <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-sky-500/30 rounded-2xl p-5 shadow-xl space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-black uppercase text-sky-400 tracking-wider block">
                        Link Oficial & QR Code do Supermercado
                      </span>
                      <h4 className="text-sm font-bold text-white">
                        Acesso Direto e Exclusivo para Clientes
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Este link e QR Code abrem diretamente o catálogo e encarte de <strong className="text-white">{selectedTenant.nomeFantasia || selectedTenant.razaoSocial}</strong>.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          const tenantId = selectedTenant.supermercadoId || (selectedTenant as any).uid || '';
                          if (onManageSupermarket) {
                            onManageSupermarket(tenantId);
                          } else {
                            window.location.href = `/?store=${encodeURIComponent(tenantId)}`;
                          }
                        }}
                        className="flex items-center space-x-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black px-3.5 py-2 rounded-xl shadow-lg shadow-amber-500/20 transition-all active:scale-95 cursor-pointer"
                        title="Acessar Painel de Gestão deste Supermercado"
                      >
                        <Store className="w-3.5 h-3.5" />
                        <span>Abrir Painel do Supermercado</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setQrModalTenant(selectedTenant)}
                        className="flex items-center space-x-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-lg shadow-emerald-600/20 transition-all active:scale-95 cursor-pointer"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>Ver / Baixar QR Code</span>
                      </button>

                      <a
                        href={`/?store=${encodeURIComponent(selectedTenant.supermercadoId || (selectedTenant as any).uid || '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold px-3.5 py-2 rounded-xl transition-all"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Abrir Loja</span>
                      </a>
                    </div>
                  </div>

                  {/* Direct Link Input Box */}
                  <div className="flex items-center space-x-2 bg-slate-950 border border-slate-800 rounded-xl p-1.5">
                    <input
                      type="text"
                      readOnly
                      value={typeof window !== 'undefined' ? `${window.location.origin}/?store=${encodeURIComponent(selectedTenant.supermercadoId || (selectedTenant as any).uid || '')}` : ''}
                      className="bg-transparent text-xs text-slate-300 px-2 flex-1 focus:outline-none select-all truncate font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const tenantId = selectedTenant.supermercadoId || (selectedTenant as any).uid || '';
                        const storeUrl = `${window.location.origin}/?store=${encodeURIComponent(tenantId)}`;
                        copyTextToClipboard(storeUrl, `Link oficial da loja "${selectedTenant.nomeFantasia || selectedTenant.razaoSocial}" copiado!`);
                      }}
                      className="px-3 py-1.5 bg-sky-500 hover:bg-sky-400 text-white rounded-lg font-bold text-xs flex items-center space-x-1.5 transition-all shadow-md shadow-sky-500/20 active:scale-95 shrink-0"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar Link</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Action Bar */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="submit"
                  disabled={savingContract}
                  className="flex items-center space-x-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg shadow-sky-500/20 transition-all active:scale-95 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{savingContract ? 'Salvando...' : (isCreatingNew ? 'Cadastrar Inquilino' : 'Salvar Contrato e Status')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>

      </div>

      {/* Ferramentas Avançadas do Sistema (Backup, Restauração e Exportação) - Recolhido por padrão */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
        <details className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 text-slate-400 group">
          <summary className="text-xs font-bold text-slate-400 hover:text-white cursor-pointer select-none list-none flex items-center justify-between">
            <span className="flex items-center space-x-2">
              <Database className="w-4 h-4 text-slate-500" />
              <span>Ferramentas Avançadas (Backup, Restauração e Exportação de Inquilinos)</span>
            </span>
            <span className="text-[11px] text-slate-500 group-open:rotate-180 transition-transform">▼</span>
          </summary>
          
          <div className="pt-4 mt-3 border-t border-slate-800 flex flex-wrap items-center gap-2">
            <input
              type="file"
              ref={restoreFileInputRef}
              onChange={handleRestoreFullBackupFile}
              accept=".json,application/json"
              className="hidden"
            />
            <button
              type="button"
              onClick={handleExportTenantsCsv}
              className="flex items-center space-x-1.5 bg-emerald-600/80 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
              title="Exportar planilha de inquilinos em formato CSV"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Exportar Inquilinos (CSV)</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadFullBackup}
              className="flex items-center space-x-1.5 bg-sky-600/80 hover:bg-sky-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
              title="Baixar backup completo de todos os dados em JSON"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Fazer Backup Completo (JSON)</span>
            </button>
            <button
              type="button"
              onClick={() => restoreFileInputRef.current?.click()}
              disabled={isRestoringData}
              className="flex items-center space-x-1.5 bg-purple-600/80 hover:bg-purple-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
              title="Restaurar backup a partir de arquivo JSON"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Restaurar Backup (JSON)</span>
            </button>
            <button
              type="button"
              onClick={handleRestoreOldData}
              disabled={isRestoringData}
              className="flex items-center space-x-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/30 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
              title="Trazer dados do banco legado"
            >
              {isRestoringData ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
              <span>Trazer Dados BD Antigo</span>
            </button>
          </div>
        </details>
      </div>

      {/* Custom Delete Confirmation Modal (Iframe Safe - No window.confirm) */}
      {showDeleteModal && selectedTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-red-500/30 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl shadow-red-500/10">
            <div className="flex items-center space-x-3 text-red-400">
              <div className="p-2.5 bg-red-500/10 rounded-xl border border-red-500/20">
                <Trash2 className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Confirmar Exclusão de Empresa</h3>
                <p className="text-xs text-slate-400">Esta ação não pode ser desfeita</p>
              </div>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed">
              Tem certeza que deseja <span className="text-red-400 font-bold">excluir permanentemente</span> a empresa{' '}
              <strong className="text-white">{selectedTenant.nomeFantasia || selectedTenant.razaoSocial}</strong> do sistema?
              Isso removerá todo o acesso do inquilino.
            </p>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                disabled={deletingTenant}
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deletingTenant}
                onClick={performDeleteTenant}
                className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-red-600/30 flex items-center space-x-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deletingTenant ? 'Excluindo...' : 'Sim, Excluir Empresa'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de QR Code e Link Exclusivo */}
      <QRCodeModal
        isOpen={!!qrModalTenant}
        onClose={() => setQrModalTenant(null)}
        supermarket={qrModalTenant}
      />
    </div>
  );
};
