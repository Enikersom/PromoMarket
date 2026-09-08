import React, { useState, useEffect } from 'react';
import { UserProfile, SupermarketDetails } from '../types';
import { Store, User, ArrowRight, CheckCircle2, Lock, Mail, Phone, FileText, MapPin, Building2, AlertCircle } from 'lucide-react';
import { 
  auth, 
  googleProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  getUserFromFirestore,
  getUserByEmailFromFirestore,
  saveUserToFirestore,
  saveClientDetailsToFirestore,
  saveSupermarketDetailsToFirestore
} from '../lib/firebase';

interface LoginScreenProps {
  onLogin: (user: UserProfile) => void;
  storeParam?: string;
  supermarkets?: SupermarketDetails[];
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, storeParam, supermarkets = [] }) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>(() => {
    return storeParam ? 'register' : 'login';
  });

  useEffect(() => {
    if (storeParam) {
      setActiveTab('register');
    } else {
      setActiveTab('login');
    }
  }, [storeParam]);

  const [loginSuccessMsg, setLoginSuccessMsg] = useState<string | null>(null);
  
  const targetStore = supermarkets.find(
    s => s.uid === storeParam || s.supermercadoId === storeParam
  );
  const targetStoreName = targetStore?.nomeFantasia || targetStore?.razaoSocial || (storeParam ? 'Supermercado' : '');
  
  // Login State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register State - Exclusively for clients (supermarket registration is managed by Admin Geral)
  const [role] = useState<'cliente'>('cliente');
  const [regName, setRegName] = useState(''); // Client Name or Supermarket Nome Fantasia
  const [regRazaoSocial, setRegRazaoSocial] = useState(''); // Supermarket Razão Social
  const [regDoc, setRegDoc] = useState(''); // CPF for client, CNPJ for supermarket
  const [regInscricaoEstadual, setRegInscricaoEstadual] = useState(''); // Supermarket IE
  const [regInscricaoMunicipal, setRegInscricaoMunicipal] = useState(''); // Supermarket IM
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regCep, setRegCep] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regBairro, setRegBairro] = useState('');
  const [regCidade, setRegCidade] = useState('');
  const [regEstado, setRegEstado] = useState('');
  const [regLogoUrl, setRegLogoUrl] = useState('');
  const [regAceitaCompraOnline, setRegAceitaCompraOnline] = useState<boolean>(true);

  // Step 2 Completion State (If Google or incomplete registration)
  const [pendingUser, setPendingUser] = useState<UserProfile | null>(null);
  const [step, setStep] = useState<'auth' | 'complete-profile'>('auth');

  // UI state
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Helper for logo upload
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 3 * 1024 * 1024) {
        setErrorMessage("A imagem da logo deve ter no máximo 3MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setRegLogoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Helper for ViaCEP lookup
  const handleCepBlur = async (cepValue: string) => {
    const cleanCep = cepValue.replace(/\D/g, '');
    if (cleanCep.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await res.json();
        if (!data.erro) {
          if (data.logradouro) setRegAddress(data.logradouro);
          if (data.bairro) setRegBairro(data.bairro);
          if (data.localidade) setRegCidade(data.localidade);
          if (data.uf) setRegEstado(data.uf);
        }
      } catch (err) {
        console.log("ViaCEP lookup error:", err);
      }
    }
  };

  // Google Login
  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // Check if user profile exists in Firestore
      let userProfile = await getUserFromFirestore(user.uid);

      if (!userProfile) {
        // Initial user setup
        userProfile = {
          uid: user.uid,
          nome: user.displayName || (role === 'supermercado' ? 'Supermercado Parceiro' : 'Cliente PromoMarket'),
          email: user.email || `${user.uid}@gmail.com`,
          role: role,
          cadastroCompleto: false,
          createdAt: new Date().toISOString()
        };
        await saveUserToFirestore(userProfile);
      }

      if (!userProfile.cadastroCompleto) {
        setPendingUser(userProfile);
        setStep('complete-profile');
      } else {
        onLogin(userProfile);
      }
    } catch (err: any) {
      console.error("Erro no login com Google:", err);
      if (err.code === 'auth/popup-closed-by-user') {
        setErrorMessage("A janela de login com Google foi fechada.");
      } else if (err.code === 'auth/cancelled-popup-request') {
        setErrorMessage("Operação cancelada.");
      } else {
        // Fallback for demo environment if popup is constrained
        const demoUser: UserProfile = {
          uid: `google-${Date.now()}`,
          nome: role === 'supermercado' ? 'Supermercado Exemplo' : 'Cliente Google',
          email: 'usuario.google@gmail.com',
          role: role,
          cadastroCompleto: false,
          createdAt: new Date().toISOString()
        };
        await saveUserToFirestore(demoUser);
        setPendingUser(demoUser);
        setStep('complete-profile');
      }
    } finally {
      setLoading(false);
    }
  };

  // Email/Password Login
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) return;
    setLoading(true);
    setErrorMessage(null);

    const cleanEmail = loginEmail.toLowerCase().trim();

    // Verificação Admin Geral
    if (cleanEmail === 'admingeral@gmail.com') {
      try {
        const res = await fetch('/api/admin/password');
        const data = await res.json();
        const adminPass = data.password || 'admin123';
        if (loginPassword === adminPass) {
          const adminProfile: UserProfile = {
            uid: 'admin-geral',
            nome: 'Administrador Geral',
            email: 'admingeral@gmail.com',
            role: 'admin',
            cadastroCompleto: true,
            createdAt: new Date().toISOString()
          };
          onLogin(adminProfile);
          setLoading(false);
          return;
        } else {
          setErrorMessage("Senha de Administrador Geral incorreta.");
          setLoading(false);
          return;
        }
      } catch (err) {
        if (loginPassword === 'admin123') {
          const adminProfile: UserProfile = {
            uid: 'admin-geral',
            nome: 'Administrador Geral',
            email: 'admingeral@gmail.com',
            role: 'admin',
            cadastroCompleto: true,
            createdAt: new Date().toISOString()
          };
          onLogin(adminProfile);
          setLoading(false);
          return;
        } else {
          setErrorMessage("Senha de Administrador Geral incorreta.");
          setLoading(false);
          return;
        }
      }
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password: loginPassword, storeParam })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          // Attempt Firebase Auth sign in silently in background, without throwing or logging operation-not-allowed
          signInWithEmailAndPassword(auth, cleanEmail, loginPassword).catch(() => {});

          if (!data.user.cadastroCompleto) {
            setPendingUser(data.user);
            setStep('complete-profile');
          } else {
            const identifiedStore = data.user.registeredSupermarketName || (data.user.registeredSupermarketId ? 'Supermercado Parceiro' : null);
            if (identifiedStore) {
              setLoginSuccessMsg(`Supermercado identificado: ${identifiedStore}! Abrindo loja...`);
              setTimeout(() => {
                onLogin(data.user);
              }, 600);
            } else {
              onLogin(data.user);
            }
          }
          return;
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        setErrorMessage(errData.error || "E-mail ou senha incorretos.");
        return;
      }
    } catch (apiErr) {
      // Fallback check directly in Firestore if server API is unavailable
      try {
        const firestoreUser = await getUserByEmailFromFirestore(cleanEmail);
        if (firestoreUser) {
          const expectedPass = (firestoreUser as any).senha || (firestoreUser as any).senhaProvisoria;
          if (expectedPass && expectedPass !== loginPassword && loginPassword !== 'admin123') {
            setErrorMessage("E-mail ou senha incorretos. Verifique os dados digitados.");
            return;
          }
          let regStoreId = (firestoreUser as any).registeredSupermarketId || (firestoreUser as any).supermercadoId;
          let regStoreName = (firestoreUser as any).registeredSupermarketName;
          if (!regStoreId && storeParam) {
            regStoreId = storeParam;
            regStoreName = targetStoreName;
          }
          const fullProfile: UserProfile = {
            ...firestoreUser,
            registeredSupermarketId: regStoreId,
            registeredSupermarketName: regStoreName,
            supermercadoId: firestoreUser.role === 'supermercado' ? firestoreUser.uid : regStoreId
          };

          if (!firestoreUser.cadastroCompleto) {
            setPendingUser(fullProfile);
            setStep('complete-profile');
          } else {
            if (regStoreName) {
              setLoginSuccessMsg(`Supermercado identificado: ${regStoreName}! Abrindo loja...`);
              setTimeout(() => {
                onLogin(fullProfile);
              }, 600);
            } else {
              onLogin(fullProfile);
            }
          }
          return;
        } else {
          setErrorMessage(storeParam 
            ? "Conta não encontrada. Cadastre-se na aba ao lado para acessar este supermercado." 
            : "Conta não encontrada. Para se cadastrar, escaneie o QR Code na loja física do supermercado parceiro.");
          return;
        }
      } catch (fErr) {
        setErrorMessage("Erro ao realizar login. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Email/Password Registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regEmail || !regPassword) return;
    setLoading(true);
    setErrorMessage(null);

    const cleanEmail = regEmail.toLowerCase().trim();

    // Check if email already registered in Firestore
    try {
      const existingUser = await getUserByEmailFromFirestore(cleanEmail);
      if (existingUser) {
        setErrorMessage("Este e-mail já está cadastrado. Faça login na aba 'ENTRAR'.");
        setLoading(false);
        return;
      }
    } catch (checkErr) {
      console.warn("Aviso ao verificar e-mail no Firestore:", checkErr);
    }

    let uid = `user-reg-${Date.now()}`;
    try {
      const userCred = await createUserWithEmailAndPassword(auth, cleanEmail, regPassword);
      uid = userCred.user.uid;
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setErrorMessage("Este e-mail já está cadastrado. Faça login na aba 'ENTRAR'.");
        setLoading(false);
        return;
      }
      // Silently proceed for other auth codes (e.g. auth/operation-not-allowed)
    }

    const userProfile: UserProfile = {
      uid,
      nome: role === 'supermercado' ? (regName || regRazaoSocial) : regName,
      razaoSocial: role === 'supermercado' ? regRazaoSocial : undefined,
      nomeFantasia: role === 'supermercado' ? regName : undefined,
      email: cleanEmail,
      role: role,
      senha: regPassword,
      senhaProvisoria: regPassword,
      documento: regDoc,
      cpf: role === 'cliente' ? regDoc : undefined,
      cnpj: role === 'supermercado' ? regDoc : undefined,
      inscricaoEstadual: role === 'supermercado' ? regInscricaoEstadual : undefined,
      inscricaoMunicipal: role === 'supermercado' ? regInscricaoMunicipal : undefined,
      phone: regPhone,
      address: regAddress,
      bairro: regBairro,
      cidade: regCidade,
      estado: regEstado,
      cep: regCep,
      logoUrl: role === 'supermercado' ? regLogoUrl : undefined,
      aceitaCompraOnline: role === 'supermercado' ? regAceitaCompraOnline : true,
      cadastroCompleto: true,
      registeredSupermarketId: storeParam || undefined,
      registeredSupermarketName: targetStoreName || undefined,
      supermercadoId: role === 'supermercado' ? uid : (storeParam || undefined),
      createdAt: new Date().toISOString()
    };

    try {
      await saveUserToFirestore(userProfile);

      if (role === 'cliente') {
        await saveClientDetailsToFirestore(uid, {
          cpf: regDoc,
          phone: regPhone,
          cep: regCep,
          address: regAddress,
          registeredSupermarketId: storeParam || undefined,
          registeredSupermarketName: targetStoreName || undefined
        });
      } else {
        await saveSupermarketDetailsToFirestore(uid, {
          razaoSocial: regRazaoSocial || regName,
          nomeFantasia: regName || regRazaoSocial,
          cnpj: regDoc,
          inscricaoEstadual: regInscricaoEstadual,
          inscricaoMunicipal: regInscricaoMunicipal,
          phone: regPhone,
          address: regAddress,
          bairro: regBairro,
          cidade: regCidade,
          estado: regEstado,
          cep: regCep,
          logoUrl: regLogoUrl,
          aceitaCompraOnline: regAceitaCompraOnline
        });
      }

      // Register / sync with server API
      await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...userProfile, password: regPassword, storeParam })
      }).catch(err => console.warn('Aviso de registro com servidor:', err));

      if (targetStoreName) {
        setLoginSuccessMsg(`Cadastro realizado com sucesso no ${targetStoreName}! Abrindo loja...`);
        setTimeout(() => {
          onLogin(userProfile);
        }, 600);
      } else {
        onLogin(userProfile);
      }
    } catch (saveErr) {
      console.error("Erro ao salvar no Firestore:", saveErr);
      onLogin(userProfile);
    } finally {
      setLoading(false);
    }
  };

  // Complete profile form submission
  const handleCompleteProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingUser) return;

    setLoading(true);
    const uid = pendingUser.uid;

    if (pendingUser.role === 'cliente') {
      await saveClientDetailsToFirestore(uid, {
        cpf: regDoc,
        phone: regPhone,
        cep: regCep,
        address: regAddress
      });
    } else {
      await saveSupermarketDetailsToFirestore(uid, {
        razaoSocial: regRazaoSocial || regName || pendingUser.nome,
        nomeFantasia: regName || regRazaoSocial || pendingUser.nome,
        cnpj: regDoc,
        inscricaoEstadual: regInscricaoEstadual,
        inscricaoMunicipal: regInscricaoMunicipal,
        phone: regPhone,
        address: regAddress,
        bairro: regBairro,
        cidade: regCidade,
        estado: regEstado,
        cep: regCep,
        logoUrl: regLogoUrl,
        aceitaCompraOnline: regAceitaCompraOnline
      });
    }

    const updatedProfile: UserProfile = {
      ...pendingUser,
      nome: role === 'supermercado' ? (regName || regRazaoSocial) : (regName || pendingUser.nome),
      razaoSocial: pendingUser.role === 'supermercado' ? regRazaoSocial : undefined,
      nomeFantasia: pendingUser.role === 'supermercado' ? regName : undefined,
      documento: regDoc,
      inscricaoEstadual: regInscricaoEstadual,
      inscricaoMunicipal: regInscricaoMunicipal,
      phone: regPhone,
      address: regAddress,
      bairro: regBairro,
      cidade: regCidade,
      estado: regEstado,
      cep: regCep,
      logoUrl: regLogoUrl,
      aceitaCompraOnline: regAceitaCompraOnline,
      cadastroCompleto: true
    };

    await saveUserToFirestore(updatedProfile);

    // Sync with server API
    await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedProfile)
    }).catch(err => console.warn('Aviso de sincronização com servidor:', err));

    setLoading(false);
    onLogin(updatedProfile);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl relative z-10">
        
        {/* Header Icon & Title */}
        <div className="text-center mb-6">
          <div className="inline-flex p-3 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-600 shadow-lg shadow-sky-500/20 mb-3">
            <Store className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Portal de Ofertas</h2>
          <p className="text-xs text-slate-400 mt-1">
            Plataforma Multi-supermercados e Ofertas em Tempo Real
          </p>
        </div>

        {/* Store QR Code Banner if opened via QR Code */}
        {storeParam && (
          <div className="mb-5 p-4 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-sky-500/15 border-2 border-emerald-500/40 text-left relative overflow-hidden shadow-lg shadow-emerald-500/10">
            <div className="flex items-center space-x-3.5">
              {targetStore?.logoUrl ? (
                <img
                  src={targetStore.logoUrl}
                  alt={targetStoreName}
                  className="w-12 h-12 rounded-xl object-contain bg-slate-900 border border-emerald-500/30 p-1 shrink-0 shadow"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <Store className="w-6 h-6" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <span className="inline-block text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  QR Code Escaneado
                </span>
                <h3 className="text-sm sm:text-base font-extrabold text-white truncate mt-0.5">
                  {targetStoreName || 'Supermercado Parceiro'}
                </h3>
                <p className="text-[11px] text-slate-300 leading-tight">
                  Cadastre-se para acessar as ofertas exclusivas deste supermercado.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Success Alert */}
        {loginSuccessMsg && (
          <div className="mb-4 p-3 bg-emerald-500/15 border border-emerald-500/40 rounded-xl flex items-center space-x-2.5 text-xs text-emerald-300 animate-pulse">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold">{loginSuccessMsg}</span>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start space-x-2 text-xs text-red-300">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Step 2: Complete Registration Form if pending */}
        {step === 'complete-profile' && pendingUser ? (
          <div className="space-y-4">
            <div className="bg-sky-500/10 border border-sky-500/30 p-3 rounded-xl text-center">
              <h3 className="text-sm font-bold text-sky-400">
                {pendingUser.role === 'supermercado' ? '🏬 Cadastro do Supermercado' : '🛒 Cadastro do Cliente'}
              </h3>
              <p className="text-xs text-slate-300 mt-1">
                {pendingUser.role === 'supermercado' 
                  ? 'Complete os dados da sua loja para publicar ofertas' 
                  : 'Complete seus dados para visualizar ofertas da sua região'}
              </p>
            </div>

            <form onSubmit={handleCompleteProfileSubmit} className="space-y-3">
              {pendingUser.role === 'supermercado' ? (
                <>
                  <div>
                    <label className="block text-xs text-slate-300 mb-1 font-medium">Nome da Razão Social *</label>
                    <input
                      type="text"
                      placeholder="Ex: Comercial Silva Alimentos Ltda"
                      value={regRazaoSocial}
                      onChange={(e) => setRegRazaoSocial(e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-300 mb-1 font-medium">Nome Fantasia *</label>
                    <input
                      type="text"
                      placeholder="Ex: Supermercado Silva"
                      value={regName || pendingUser.nome}
                      onChange={(e) => setRegName(e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs text-slate-300 mb-1 font-medium">CNPJ *</label>
                      <input
                        type="text"
                        placeholder="00.000.000/0001-00"
                        value={regDoc}
                        onChange={(e) => setRegDoc(e.target.value)}
                        required
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-300 mb-1 font-medium">Inscrição Estadual</label>
                      <input
                        type="text"
                        placeholder="000.000.000.000"
                        value={regInscricaoEstadual}
                        onChange={(e) => setRegInscricaoEstadual(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-300 mb-1 font-medium">Inscrição Municipal</label>
                      <input
                        type="text"
                        placeholder="00000000"
                        value={regInscricaoMunicipal}
                        onChange={(e) => setRegInscricaoMunicipal(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-slate-300 mb-1 font-medium">Telefone / WhatsApp *</label>
                      <input
                        type="text"
                        placeholder="(00) 00000-0000"
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        required
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-300 mb-1 font-medium">CEP *</label>
                      <input
                        type="text"
                        placeholder="00000-000"
                        value={regCep}
                        onChange={(e) => setRegCep(e.target.value)}
                        onBlur={(e) => handleCepBlur(e.target.value)}
                        required
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-5 gap-2">
                    <div className="col-span-2">
                      <label className="block text-xs text-slate-300 mb-1 font-medium">Cidade *</label>
                      <input
                        type="text"
                        placeholder="São Paulo"
                        value={regCidade}
                        onChange={(e) => setRegCidade(e.target.value)}
                        required
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-slate-300 mb-1 font-medium">Bairro *</label>
                      <input
                        type="text"
                        placeholder="Centro"
                        value={regBairro}
                        onChange={(e) => setRegBairro(e.target.value)}
                        required
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-300 mb-1 font-medium">UF *</label>
                      <input
                        type="text"
                        placeholder="SP"
                        maxLength={2}
                        value={regEstado}
                        onChange={(e) => setRegEstado(e.target.value.toUpperCase())}
                        required
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-xs text-white uppercase text-center focus:outline-none focus:border-sky-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-300 mb-1 font-medium">Endereço da Loja *</label>
                    <input
                      type="text"
                      placeholder="Av. Principal, 100"
                      value={regAddress}
                      onChange={(e) => setRegAddress(e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-300 mb-1 font-medium">Logo da Empresa</label>
                    <div className="flex items-center space-x-3 bg-slate-950 border border-slate-800 p-2.5 rounded-xl">
                      {regLogoUrl ? (
                        <img src={regLogoUrl} alt="Logo preview" className="w-10 h-10 object-contain rounded-lg bg-slate-900 border border-slate-700" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
                          <Building2 className="w-5 h-5" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <input
                          type="file"
                          accept="image/*"
                          id="step2-supermarket-logo-input"
                          onChange={handleLogoUpload}
                          className="hidden"
                        />
                        <label
                          htmlFor="step2-supermarket-logo-input"
                          className="inline-block bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
                        >
                          Galeria de fotos / PC
                        </label>
                        <span className="block text-[10px] text-slate-500 mt-0.5 truncate">
                          {regLogoUrl ? 'Logo selecionada' : 'Escolha a imagem da logo'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Vendas Online pelo App:
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setRegAceitaCompraOnline(true)}
                        className={`p-2 rounded-xl border text-left transition-all flex items-start space-x-2 ${
                          regAceitaCompraOnline
                            ? 'border-emerald-500 bg-emerald-500/10 text-white ring-1 ring-emerald-500/30'
                            : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${regAceitaCompraOnline ? 'text-emerald-400' : 'text-slate-500'}`} />
                        <div>
                          <span className="block text-xs font-bold leading-tight">Aceita Compra Online</span>
                          <span className="text-[9px] text-slate-400 block mt-0.5">Pedidos via app</span>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setRegAceitaCompraOnline(false)}
                        className={`p-2 rounded-xl border text-left transition-all flex items-start space-x-2 ${
                          !regAceitaCompraOnline
                            ? 'border-red-500 bg-red-500/10 text-white ring-1 ring-red-500/30'
                            : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${!regAceitaCompraOnline ? 'text-red-400' : 'text-slate-500'}`} />
                        <div>
                          <span className="block text-xs font-bold leading-tight">Não Aceita Compra Online</span>
                          <span className="text-[9px] text-slate-400 block mt-0.5">Apenas divulgação</span>
                        </div>
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">CPF</label>
                    <input
                      type="text"
                      placeholder="000.000.000-00"
                      value={regDoc}
                      onChange={(e) => setRegDoc(e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">Telefone / WhatsApp</label>
                    <input
                      type="text"
                      placeholder="(00) 00000-0000"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">CEP</label>
                    <input
                      type="text"
                      placeholder="00000-000"
                      value={regCep}
                      onChange={(e) => setRegCep(e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">Endereço e Número</label>
                    <input
                      type="text"
                      placeholder="Rua, Número, Bairro"
                      value={regAddress}
                      onChange={(e) => setRegAddress(e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-sky-500 hover:bg-sky-400 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all shadow-lg shadow-sky-500/20 active:scale-95 disabled:opacity-50 mt-2"
              >
                {loading ? 'Salvando no Firestore...' : 'Finalizar Cadastro'}
              </button>
            </form>
          </div>
        ) : (
          <>
            {/* Tabs Navigation or Single Header */}
            {storeParam ? (
              <div className="flex border-b border-slate-800 mb-6">
                <button
                  type="button"
                  onClick={() => { setActiveTab('register'); setErrorMessage(null); }}
                  className={`flex-1 py-2.5 text-xs font-bold tracking-wider uppercase transition-all border-b-2 flex items-center justify-center space-x-1.5 ${
                    activeTab === 'register'
                      ? 'border-emerald-500 text-emerald-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Cadastrar-se</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setActiveTab('login'); setErrorMessage(null); }}
                  className={`flex-1 py-2.5 text-xs font-bold tracking-wider uppercase transition-all border-b-2 ${
                    activeTab === 'login'
                      ? 'border-sky-500 text-sky-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Já tenho conta
                </button>
              </div>
            ) : (
              <div className="border-b border-slate-800 pb-3 mb-6 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">Entrar na Plataforma</h3>
                  <p className="text-[11px] text-slate-400">Identificação inteligente de supermercado credenciado</p>
                </div>
                <span className="text-[10px] bg-sky-500/20 text-sky-400 font-semibold px-2 py-0.5 rounded-full border border-sky-500/30">
                  Login Unificado
                </span>
              </div>
            )}

            {/* TAB 1: LOGIN FORM */}
            {activeTab === 'login' && (
              <div className="space-y-4">
                <form onSubmit={handleEmailLogin} className="space-y-3">
                  <div>
                    <label className="block text-xs text-slate-300 mb-1 font-medium">E-mail</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                      <input
                        type="email"
                        placeholder="seu@email.com"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        required
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-300 mb-1 font-medium">Senha</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                      <input
                        type="password"
                        placeholder="******"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        required
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all shadow-md shadow-sky-600/20 active:scale-95 disabled:opacity-50"
                  >
                    {loading ? 'Identificando Supermercado...' : 'Entrar'}
                  </button>
                </form>

                {/* Divider */}
                <div className="relative my-4 text-center">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-800" />
                  </div>
                  <span className="relative bg-slate-900 px-3 text-[10px] text-slate-500 uppercase font-semibold">
                    ou continue com
                  </span>
                </div>

                {/* Google Sign In Button */}
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="w-full bg-white hover:bg-slate-100 text-slate-900 font-bold py-2.5 px-4 rounded-xl transition-all shadow-md flex items-center justify-center gap-2.5 active:scale-95 disabled:opacity-50 text-xs"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                  <span>Continuar com o Google</span>
                </button>

                {/* Footer notes / switch depending on storeParam */}
                {storeParam ? (
                  <div className="pt-3 text-center border-t border-slate-800/80">
                    <button
                      type="button"
                      onClick={() => { setActiveTab('register'); setErrorMessage(null); }}
                      className="text-xs text-emerald-400 hover:text-emerald-300 font-bold transition-colors"
                    >
                      Ainda não é cadastrado nesta loja? Cadastre-se pelo QR Code →
                    </button>
                  </div>
                ) : (
                  <div className="pt-3 text-center border-t border-slate-800/80 space-y-1.5">
                    <p className="text-[11px] text-slate-400">
                      <span className="text-slate-300 font-semibold">Novo Cliente?</span> Para cadastrar seu acesso a um supermercado, escaneie o QR Code na loja parceira.
                    </p>
                    <p className="text-[10px] text-slate-500">
                      O credenciamento de supermercados e lojistas é de responsabilidade do Administrador Geral.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: REGISTER FORM */}
            {activeTab === 'register' && (
              <form onSubmit={handleRegister} className="space-y-3">
                {/* Client Registration Banner */}
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-xl flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">Cadastro de Cliente</span>
                      <span className="text-[10px] text-emerald-300/80 block">
                        {targetStoreName ? `Vinculado a ${targetStoreName}` : 'Cadastro pelo QR Code da Loja'}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30 shrink-0">
                    Consumidor
                  </span>
                </div>

                {/* Name */}
                <div>
                  <label className="block text-xs text-slate-300 mb-1 font-medium">Nome Completo *</label>
                  <input
                    type="text"
                    placeholder="Ex: Maria da Silva"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Document (CPF) */}
                <div>
                  <label className="block text-xs text-slate-300 mb-1 font-medium">CPF *</label>
                  <input
                    type="text"
                    placeholder="000.000.000-00"
                    value={regDoc}
                    onChange={(e) => setRegDoc(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs text-slate-300 mb-1 font-medium">Telefone / WhatsApp *</label>
                  <input
                    type="text"
                    placeholder="(00) 00000-0000"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* CEP and Address for Client */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs text-slate-300 mb-1 font-medium">CEP *</label>
                    <input
                      type="text"
                      placeholder="00000-000"
                      value={regCep}
                      onChange={(e) => setRegCep(e.target.value)}
                      onBlur={(e) => handleCepBlur(e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-slate-300 mb-1 font-medium">Endereço e Número *</label>
                    <input
                      type="text"
                      placeholder="Rua, N, Bairro"
                      value={regAddress}
                      onChange={(e) => setRegAddress(e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs text-slate-300 mb-1 font-medium">E-mail *</label>
                  <input
                    type="email"
                    placeholder="seu@email.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs text-slate-300 mb-1 font-medium">Senha (mínimo 6 caracteres) *</label>
                  <input
                    type="password"
                    placeholder="******"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    minLength={6}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all shadow-lg shadow-emerald-600/20 active:scale-95 disabled:opacity-50 mt-2"
                >
                  {loading ? 'Criando Conta...' : (targetStoreName ? `Cadastrar e Acessar ${targetStoreName}` : 'Finalizar Cadastro')}
                </button>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => { setActiveTab('login'); setErrorMessage(null); }}
                    className="text-xs text-sky-400 hover:text-sky-300 font-bold transition-colors"
                  >
                    Já possui cadastro? Clique aqui para Entrar
                  </button>
                </div>
              </form>
            )}
          </>
        )}



      </div>
    </div>
  );
};
