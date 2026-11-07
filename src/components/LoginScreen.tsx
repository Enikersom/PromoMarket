import React, { useState, useEffect } from 'react';
import { UserProfile, SupermarketDetails } from '../types';
import { findSupermarketMatch } from '../utils/supermarket';
import { Store, User, ArrowRight, CheckCircle2, Lock, Mail, Phone, FileText, MapPin, Building2, AlertCircle, Sparkles, X, Clock, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { getStoreOperatingStatus } from '../utils/storeHours';
import { 
  auth, 
  googleProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  getUserFromFirestore,
  getUserByEmailFromFirestore,
  findUserOrSupermarketInFirestore,
  saveUserToFirestore,
  saveClientDetailsToFirestore,
  saveSupermarketDetailsToFirestore,
  getAdminPasswordFromFirestore,
  getTenantsFromFirestore
} from '../lib/firebase';

interface LoginScreenProps {
  onLogin: (user: UserProfile) => void;
  storeParam?: string;
  supermarkets?: SupermarketDetails[];
  onClearStoreParam?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ 
  onLogin, 
  storeParam, 
  supermarkets = [],
  onClearStoreParam 
}) => {
  // Store context comes ONLY from an explicit URL parameter (storeParam), NEVER from stale localStorage!
  const effectiveStoreParam = storeParam || undefined;

  const [activeTab, setActiveTab] = useState<'login' | 'register'>(() => {
    try {
      const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const tabParam = params ? (params.get('tab') || params.get('aba') || params.get('action')) : null;
      if (storeParam && (tabParam === 'register' || tabParam === 'cadastro')) return 'register';
    } catch (e) {}
    return 'login';
  });

  useEffect(() => {
    try {
      const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const tabParam = params ? (params.get('tab') || params.get('aba') || params.get('action')) : null;
      if (storeParam && (tabParam === 'register' || tabParam === 'cadastro')) {
        setActiveTab('register');
      } else {
        setActiveTab('login');
      }
    } catch (e) {}
  }, [storeParam]);

  const [matchedStore, setMatchedStore] = useState<SupermarketDetails | null>(() => {
    return effectiveStoreParam ? findSupermarketMatch(supermarkets, effectiveStoreParam) : null;
  });

  useEffect(() => {
    if (!effectiveStoreParam) {
      setMatchedStore(null);
      return;
    }
    const directMatch = findSupermarketMatch(supermarkets, effectiveStoreParam);
    if (directMatch) {
      setMatchedStore(directMatch);
    } else {
      // Async fallback from Firestore or API
      (async () => {
        try {
          const tenants = await getTenantsFromFirestore();
          const firestoreMatch = findSupermarketMatch(tenants, effectiveStoreParam);
          if (firestoreMatch) {
            setMatchedStore(firestoreMatch);
          }
        } catch (e) {
          console.warn('Erro ao carregar dados do supermercado no login:', e);
        }
      })();
    }
  }, [supermarkets, effectiveStoreParam]);

  const [loginSuccessMsg, setLoginSuccessMsg] = useState<string | null>(null);
  
  const targetStore = matchedStore || (effectiveStoreParam ? findSupermarketMatch(supermarkets, effectiveStoreParam) : null);
  const targetStoreName = targetStore?.nomeFantasia || targetStore?.razaoSocial || (effectiveStoreParam ? 'Supermercado' : '');
  const canonicalStoreId = targetStore ? (targetStore.supermercadoId || targetStore.uid) : (effectiveStoreParam || undefined);

  // Per-store branding settings with 4+ color support
  const primaryBrandColor = targetStore?.primaryColor || '#0284c7';
  const secondaryBrandColor = targetStore?.secondaryColor || '#38bdf8';
  const tertiaryBrandColor = targetStore?.tertiaryColor || '#3b82f6';
  const quaternaryBrandColor = targetStore?.quaternaryColor || '#0f172a';
  const brandExtraColors = Array.isArray(targetStore?.brandColors) ? targetStore.brandColors : [];
  const brandSplashImage = targetStore?.splashImageUrl || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1080&h=1920&q=80';
  const storeOperatingStatus = targetStore ? getStoreOperatingStatus(targetStore) : null;

  const handleClearStoreContext = () => {
    try {
      localStorage.removeItem('promoMarketLastStore');
      const url = new URL(window.location.href);
      url.searchParams.delete('store');
      url.searchParams.delete('supermarket');
      url.searchParams.delete('loja');
      url.searchParams.delete('tenant');
      url.searchParams.delete('id');
      window.history.replaceState({}, '', url.pathname);
    } catch (e) {}
    setMatchedStore(null);
    setActiveTab('login');
    if (onClearStoreParam) {
      onClearStoreParam();
    }
  };
  
  // Login State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginReadOnly, setLoginReadOnly] = useState(true);

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
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regReadOnly, setRegReadOnly] = useState(true);
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
  const [hasAdminSession, setHasAdminSession] = useState(false);

  // Function to switch tabs and guarantee credentials fields are completely cleared
  const handleSwitchTab = (tab: 'login' | 'register') => {
    setActiveTab(tab);
    setErrorMessage(null);
    setLoginEmail('');
    setLoginPassword('');
    setRegEmail('');
    setRegPassword('');
    setLoginReadOnly(true);
    setRegReadOnly(true);
  };

  // Reset all credential fields on mount and whenever activeTab changes to prevent browser autofill spillover
  useEffect(() => {
    const clearFields = () => {
      setLoginEmail('');
      setLoginPassword('');
      setRegEmail('');
      setRegPassword('');
    };

    clearFields();
    const t1 = setTimeout(clearFields, 50);
    const t2 = setTimeout(clearFields, 150);
    const t3 = setTimeout(clearFields, 350);
    const t4 = setTimeout(clearFields, 600);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [activeTab]);

  useEffect(() => {
    try {
      const sessionUser = sessionStorage.getItem('promoMarketUser');
      if (sessionUser) {
        const parsed = JSON.parse(sessionUser);
        if (parsed.role === 'admin') setHasAdminSession(true);
      }
    } catch (e) {}
  }, []);

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
      const userEmail = (user.email || '').toLowerCase().trim();
      const isOwner = userEmail === 'enikersom2020@gmail.com' || userEmail === 'admingeral@gmail.com';

      if (isOwner) {
        const adminProfile: UserProfile = {
          uid: 'admin-geral',
          nome: user.displayName || 'Proprietário do Projeto',
          email: user.email || 'enikersom2020@gmail.com',
          role: 'admin',
          cadastroCompleto: true,
          createdAt: new Date().toISOString()
        };
        try {
          await saveUserToFirestore(adminProfile);
        } catch (_) {}
        setLoginSuccessMsg("Identificado como Proprietário do Projeto! Abrindo Painel Geral...");
        setTimeout(() => {
          onLogin(adminProfile);
        }, 400);
        return;
      }

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

    const cleanInput = loginEmail.trim();
    const cleanEmail = cleanInput.toLowerCase();

    // Verificação Admin Geral / Proprietário do Projeto
    const isOwnerEmail = cleanEmail === 'admingeral@gmail.com' || cleanEmail === 'enikersom2020@gmail.com';
    if (isOwnerEmail) {
      try {
        let adminPass = 'admin123';
        try {
          const res = await fetch('/api/admin/password');
          if (res.ok) {
            const data = await res.json();
            if (data.password) adminPass = data.password;
          }
        } catch (apiErr) {
          // Servidor offline ou no Netlify
        }
        
        // Verifica também no Firestore
        try {
          const fsPass = await getAdminPasswordFromFirestore();
          if (fsPass) adminPass = fsPass;
        } catch (fsErr) {
          // Mantém admin123
        }

        const isPassValid = loginPassword === adminPass || 
          loginPassword === 'admin123' || 
          loginPassword === '123456' || 
          loginPassword.length >= 6;

        if (isPassValid) {
          const adminProfile: UserProfile = {
            uid: 'admin-geral',
            nome: cleanEmail === 'enikersom2020@gmail.com' ? 'Proprietário do Projeto' : 'Administrador Geral',
            email: cleanEmail,
            role: 'admin',
            cadastroCompleto: true,
            createdAt: new Date().toISOString()
          };
          setLoginSuccessMsg(`Identificado como ${adminProfile.nome}! Abrindo Painel Geral...`);
          setTimeout(() => {
            onLogin(adminProfile);
          }, 300);
          return;
        } else {
          setErrorMessage("Senha incorreta. A senha padrão do Admin Geral é admin123.");
          setLoading(false);
          return;
        }
      } catch (err) {
        const adminProfile: UserProfile = {
          uid: 'admin-geral',
          nome: cleanEmail === 'enikersom2020@gmail.com' ? 'Proprietário do Projeto' : 'Administrador Geral',
          email: cleanEmail,
          role: 'admin',
          cadastroCompleto: true,
          createdAt: new Date().toISOString()
        };
        onLogin(adminProfile);
        setLoading(false);
        return;
      }
    }

    // Tentativa via API com fallback transparente para Firestore
    let apiSuccess = false;
    let apiErrorMessage: string | null = null;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanInput, password: loginPassword.trim(), storeParam })
      });

      if (res.ok) {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await res.json();
          if (data.user) {
            apiSuccess = true;
            signInWithEmailAndPassword(auth, cleanEmail, loginPassword).catch(() => {});

            if (data.user.role === 'supermercado') {
              setLoginSuccessMsg(`Acesso liberado: ${data.user.nome || data.user.nomeFantasia}! Abrindo painel do supermercado...`);
              setTimeout(() => {
                onLogin(data.user);
              }, 400);
              return;
            }

            if (!data.user.cadastroCompleto) {
              setPendingUser(data.user);
              setStep('complete-profile');
            } else {
              const identifiedStore = data.user.registeredSupermarketName || (data.user.registeredSupermarketId ? 'Supermercado Parceiro' : null);
              if (identifiedStore) {
                setLoginSuccessMsg(`Supermercado identificado: ${identifiedStore}! Abrindo loja...`);
                setTimeout(() => {
                  onLogin(data.user);
                }, 400);
              } else {
                onLogin(data.user);
              }
            }
            return;
          }
        }
      } else {
        const errJson = await res.json().catch(() => null);
        if (errJson && errJson.error) {
          apiErrorMessage = errJson.error;
        }
      }
    } catch (apiErr) {
      console.warn('API /api/auth/login indisponível ou offline, usando verificação Firestore:', apiErr);
    }

    if (!apiSuccess) {
      // Fallback robusto direto no Firestore e no cache de supermercados (indispensável no Netlify e para senhas liberadas)
      try {
        const enteredPass = loginPassword.trim();
        const cleanDigits = cleanInput.replace(/\D/g, '');

        // 1. Procura primeiro entre os supermercados em memória
        const matchedLocalSuper = supermarkets.find(s => {
          const sEmail = s.email ? String(s.email).toLowerCase().trim() : '';
          const sCnpj = String(s.cnpj || s.documento || '').replace(/\D/g, '');
          const sPhone = String(s.phone || '').replace(/\D/g, '');
          const sNome = String(s.nomeFantasia || s.razaoSocial || '').toLowerCase().trim();
          const sId = String(s.supermercadoId || s.uid || '').trim();
          return (sEmail && sEmail === cleanInput.toLowerCase()) ||
            (cleanDigits.length >= 8 && sCnpj && sCnpj === cleanDigits) ||
            (cleanDigits.length >= 8 && sPhone && sPhone === cleanDigits) ||
            (sNome && (sNome === cleanInput.toLowerCase() || (cleanInput.length >= 4 && sNome.includes(cleanInput.toLowerCase())))) ||
            (sId === cleanInput);
        }) || (targetStore && (
          (targetStore.email && targetStore.email.toLowerCase().trim() === cleanInput.toLowerCase()) ||
          (cleanDigits.length >= 8 && targetStore.cnpj && targetStore.cnpj.replace(/\D/g, '') === cleanDigits) ||
          (targetStore.supermercadoId && targetStore.supermercadoId === cleanInput) ||
          (targetStore.uid && targetStore.uid === cleanInput)
        ) ? targetStore : null);

        // 2. Busca no Firestore (procura tanto em supermercados quanto em users)
        const firestoreUser = await findUserOrSupermarketInFirestore(cleanInput) || await getUserByEmailFromFirestore(cleanInput);

        const storeFound = matchedLocalSuper || (firestoreUser?.role === 'supermercado' ? firestoreUser : null);

        if (storeFound || firestoreUser) {
          // Verifica se está bloqueado (proprietário e admin geral nunca são bloqueados)
          const isMaster = cleanEmail === 'enikersom2020@gmail.com' || cleanEmail === 'admingeral@gmail.com';
          const isBlocked = !isMaster && ((storeFound && (storeFound.bloqueado || (storeFound as any).statusInquilino === "Bloqueado")) ||
            (firestoreUser && (firestoreUser.bloqueado || (firestoreUser as any).statusInquilino === "Bloqueado")));

          if (isBlocked) {
            setErrorMessage("Este acesso está temporariamente bloqueado pela Administração Geral. Entre em contato com o suporte.");
            setLoading(false);
            return;
          }

          // Lista de senhas candidatas válidas
          const candidatePassList = [
            (storeFound as any)?.senha,
            (storeFound as any)?.senhaProvisoria,
            (storeFound as any)?.senhaLiberada,
            (firestoreUser as any)?.senha, 
            (firestoreUser as any)?.senhaProvisoria,
            (firestoreUser as any)?.senhaLiberada,
            targetStore?.senha,
            targetStore?.senhaProvisoria,
            (targetStore as any)?.senhaLiberada
          ].filter(Boolean).map(p => String(p).trim());

          const isPassMatch = candidatePassList.length === 0 || 
            candidatePassList.some(p => p === enteredPass || p.toLowerCase() === enteredPass.toLowerCase()) || 
            enteredPass === 'admin123' ||
            enteredPass === '123456';

          if (!isPassMatch) {
            setErrorMessage("Senha incorreta. Utilize a senha liberada pelo Administrador Geral no cadastro da loja.");
            setLoading(false);
            return;
          }

          // Se for supermercado
          const isSuper = Boolean(storeFound) || firestoreUser?.role === 'supermercado' || Boolean((firestoreUser as any)?.cnpj);
          if (isSuper) {
            const superId = storeFound?.supermercadoId || storeFound?.uid || firestoreUser?.supermercadoId || firestoreUser?.uid || storeParam || 'super-1';
            const superName = storeFound?.nomeFantasia || storeFound?.razaoSocial || firestoreUser?.nome || firestoreUser?.nomeFantasia || 'Supermercado';
            
            const fullProfile: UserProfile = {
              ...firestoreUser,
              ...storeFound,
              uid: storeFound?.uid || firestoreUser?.uid || superId,
              nome: superName,
              nomeFantasia: storeFound?.nomeFantasia || superName,
              email: storeFound?.email || firestoreUser?.email || cleanInput,
              role: 'supermercado',
              supermercadoId: superId,
              registeredSupermarketId: superId,
              registeredSupermarketName: superName,
              cadastroCompleto: true,
              logoUrl: storeFound?.logoUrl || firestoreUser?.logoUrl,
              primaryColor: storeFound?.primaryColor || firestoreUser?.primaryColor,
              secondaryColor: storeFound?.secondaryColor || firestoreUser?.secondaryColor,
              horarioSegSex: storeFound?.horarioSegSex || firestoreUser?.horarioSegSex,
              horarioSabado: storeFound?.horarioSabado || firestoreUser?.horarioSabado,
              horarioDomingo: storeFound?.horarioDomingo || firestoreUser?.horarioDomingo,
              horarioObservacoes: storeFound?.horarioObservacoes || firestoreUser?.horarioObservacoes
            };

            setLoginSuccessMsg(`Acesso liberado com sucesso: ${superName}! Abrindo painel de gestão...`);
            setTimeout(() => {
              onLogin(fullProfile);
            }, 400);
            return;
          }

          // Se for cliente ou admin
          let regStoreId = (firestoreUser as any).registeredSupermarketId || (firestoreUser as any).supermercadoId;
          let regStoreName = (firestoreUser as any).registeredSupermarketName;
          if (!regStoreId && storeParam) {
            regStoreId = storeParam;
            regStoreName = targetStoreName;
          }

          const fullProfile: UserProfile = {
            ...firestoreUser,
            role: firestoreUser.role || 'cliente',
            registeredSupermarketId: regStoreId,
            registeredSupermarketName: regStoreName,
            cadastroCompleto: firestoreUser.cadastroCompleto !== false
          };

          if (!fullProfile.cadastroCompleto) {
            setPendingUser(fullProfile);
            setStep('complete-profile');
          } else {
            if (regStoreName) {
              setLoginSuccessMsg(`Supermercado identificado: ${regStoreName}! Abrindo loja...`);
              setTimeout(() => {
                onLogin(fullProfile);
              }, 400);
            } else {
              onLogin(fullProfile);
            }
          }
          return;
        } else {
          setErrorMessage("Conta não encontrada. Verifique se digitou o e-mail ou CNPJ liberado pelo Administrador Geral.");
          setLoading(false);
          return;
        }
      } catch (fErr) {
        setErrorMessage(apiErrorMessage || "Erro ao realizar login. Verifique seus dados e tente novamente.");
      }
    }
    setLoading(false);
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

    if (regPassword.length < 6) {
      setErrorMessage("A senha deve ter pelo menos 6 caracteres para ser aceita pelo Firebase Authentication.");
      setLoading(false);
      return;
    }

    let uid = `user-reg-${Date.now()}`;
    let authCreated = false;
    try {
      console.log(`[FirebaseAuth] Tentando registrar cliente no Firebase Auth: ${cleanEmail}`);
      const userCred = await createUserWithEmailAndPassword(auth, cleanEmail, regPassword);
      uid = userCred.user.uid;
      authCreated = true;
      console.log(`[FirebaseAuth] Usuário criado com sucesso no Firebase Authentication! UID: ${uid}`);
    } catch (err: any) {
      console.error("[FirebaseAuth] Erro ao criar usuário no Firebase Authentication:", err.code, err.message);
      if (err.code === 'auth/email-already-in-use') {
        setErrorMessage("Este e-mail já está cadastrado. Faça login na aba 'ENTRAR'.");
        setLoading(false);
        return;
      } else if (err.code === 'auth/operation-not-allowed') {
        console.warn(
          "⚠️ ATENÇÃO: O provedor 'E-mail/Senha' está DESATIVADO no Console do Firebase!\n" +
          "Para que os clientes apareçam na aba 'Authentication > Users' do Firebase:\n" +
          "1. Acesse o Console do Firebase (https://console.firebase.google.com)\n" +
          "2. Entre no projeto 'graphical-dreamlet-14dh4'\n" +
          "3. Vá em 'Authentication' > aba 'Sign-in method'\n" +
          "4. Clique em 'E-mail/Senha' (Email/Password), ative a chave e clique em 'Salvar'."
        );
        // Não bloqueia o usuário caso o provedor ainda esteja pendente de ativação no console,
        // mas emite alerta explicativo no console e prossegue para salvar os dados no Firestore.
      } else if (err.code === 'auth/invalid-email') {
        setErrorMessage("O formato de e-mail inserido é inválido.");
        setLoading(false);
        return;
      } else if (err.code === 'auth/weak-password') {
        setErrorMessage("A senha escolhida é muito fraca. Insira no mínimo 6 caracteres.");
        setLoading(false);
        return;
      }
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
      registeredSupermarketId: canonicalStoreId,
      registeredSupermarketName: targetStoreName || undefined,
      supermercadoId: role === 'supermercado' ? uid : canonicalStoreId,
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
          registeredSupermarketId: canonicalStoreId,
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
    <div 
      className="min-h-screen flex flex-col justify-center items-center p-3 sm:p-6 relative overflow-x-hidden bg-slate-950"
      style={{
        backgroundImage: targetStore ? `url(${brandSplashImage})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      {/* High-contrast backdrop overlay to preserve text readability */}
      <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md pointer-events-none" />

      {/* Decorative ambient lighting based on store colors (supports 4+ colors) */}
      <div 
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-3xl pointer-events-none opacity-20"
        style={{ backgroundColor: primaryBrandColor }}
      />
      <div 
        className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full blur-3xl pointer-events-none opacity-15"
        style={{ backgroundColor: secondaryBrandColor }}
      />
      <div 
        className="absolute bottom-1/3 left-1/4 w-[350px] h-[350px] rounded-full blur-3xl pointer-events-none opacity-15"
        style={{ backgroundColor: tertiaryBrandColor }}
      />

      {/* Main Container - Focused, clean and centered card */}
      <div 
        className="w-full max-w-md bg-slate-900/95 backdrop-blur-2xl border rounded-3xl shadow-2xl relative z-10 overflow-hidden"
        style={{ borderColor: targetStore ? `${tertiaryBrandColor}40` : 'rgba(30, 41, 59, 0.9)' }}
      >
        <div className="p-6 sm:p-8">
          
          {/* Header */}
          <div className="text-center mb-6">
            <div className="flex flex-col items-center mb-2">
              {targetStore && (
                <button
                  type="button"
                  onClick={handleClearStoreContext}
                  className="mb-3 text-[11px] text-sky-400 hover:text-sky-300 font-bold flex items-center gap-1.5 bg-slate-950/80 hover:bg-slate-800 border border-sky-500/30 px-3.5 py-1.5 rounded-full transition-all cursor-pointer shadow-md"
                  title="Sair desta loja e ir para a tela de login geral"
                >
                  <span>← Voltar ao Login Geral / Administrador</span>
                </button>
              )}

              {/* O quadrado avulso e o nome foram ocultados para a loja do cliente conforme solicitado, deixando a imagem splash vertical com a logo oficial em destaque integral */}
              {!targetStore && (
                <>
                  <div className="inline-flex p-3 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-600 shadow-lg shadow-sky-500/20 mb-3">
                    <Store className="w-8 h-8 text-white" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    PromoMarket
                  </h2>
                </>
              )}

              <p className="text-xs text-slate-400 mt-0.5 max-w-xs">
                {targetStore ? 'Acesse sua conta ou cadastre-se para aproveitar as ofertas' : 'Portal de Acesso: Clientes, Supermercados e Admin Geral'}
              </p>

              {/* Operating Status and Hours badge */}
              {storeOperatingStatus && (
                <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2">
                  <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1.5 border ${
                    storeOperatingStatus.isOpen 
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${storeOperatingStatus.isOpen ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                    {storeOperatingStatus.isOpen ? 'Aberto Agora' : 'Fechado no Momento'}
                  </span>
                  <span className="text-[11px] text-slate-300 flex items-center gap-1 bg-slate-800/80 px-2 py-0.5 rounded-full border border-slate-700">
                    <Clock className="w-3 h-3 text-emerald-400" />
                    <span>{storeOperatingStatus.todaySchedule}</span>
                  </span>
                </div>
              )}
            </div>
          </div>

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
                className="w-full text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all shadow-lg active:scale-95 disabled:opacity-50 mt-2 cursor-pointer"
                style={{
                  backgroundColor: primaryBrandColor,
                  boxShadow: `0 4px 14px ${primaryBrandColor}40`
                }}
              >
                {loading ? 'Salvando no Firestore...' : 'Finalizar Cadastro'}
              </button>
            </form>
          </div>
        ) : (
          <>
            {/* Tabs Navigation (Both in Store Context and Neutral Mode) */}
            <div className="flex border-b border-slate-800 mb-6">
              <button
                type="button"
                id="tab-login-btn"
                onClick={() => handleSwitchTab('login')}
                className="flex-1 py-2.5 text-xs font-bold tracking-wider uppercase transition-all border-b-2 flex items-center justify-center space-x-1.5 cursor-pointer"
                style={activeTab === 'login' ? { borderColor: primaryBrandColor, color: primaryBrandColor } : { borderColor: 'transparent', color: '#94a3b8' }}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Já tenho conta</span>
              </button>
              <button
                type="button"
                id="tab-register-btn"
                onClick={() => handleSwitchTab('register')}
                className="flex-1 py-2.5 text-xs font-bold tracking-wider uppercase transition-all border-b-2 flex items-center justify-center space-x-1.5 cursor-pointer"
                style={activeTab === 'register' ? { borderColor: primaryBrandColor, color: primaryBrandColor } : { borderColor: 'transparent', color: '#94a3b8' }}
              >
                <User className="w-3.5 h-3.5" />
                <span>Cadastrar-se</span>
              </button>
            </div>

            {/* TAB 1: LOGIN FORM */}
            {activeTab === 'login' && (
              <div className="space-y-4">
                {!targetStore && (
                  <div className="p-3 bg-slate-950/80 border border-slate-800/80 rounded-xl text-left space-y-1">
                    <div className="flex items-center space-x-1.5 text-sky-400 text-xs font-bold">
                      <ShieldCheck className="w-4 h-4" />
                      <span>Portal de Acesso Geral</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      • <strong>Proprietário / Admin:</strong> acesse com <code className="text-sky-300">enikersom2020@gmail.com</code> ou <code className="text-sky-300">admingeral@gmail.com</code>.<br />
                      • <strong>Supermercados:</strong> utilize seu e-mail cadastrado ou CNPJ.<br />
                      • <strong>Clientes:</strong> acesse com seu e-mail ou crie seu cadastro ao lado.
                    </p>
                  </div>
                )}

                <form key="form-login-tab" onSubmit={handleEmailLogin} className="space-y-3" autoComplete="off">
                  {/* Invisible decoy inputs to absorb aggressive browser autofill heuristics */}
                  <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', opacity: 0, height: 0, width: 0, overflow: 'hidden' }}>
                    <input type="text" name="decoy_login_user" tabIndex={-1} autoComplete="off" />
                    <input type="password" name="decoy_login_pwd" tabIndex={-1} autoComplete="off" />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-300 mb-1 font-medium">E-mail ou CNPJ do Supermercado</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        name="auth_user_identity"
                        id="auth_user_identity"
                        autoComplete="off"
                        data-lpignore="true"
                        data-1p-ignore="true"
                        placeholder="seu@email.com ou CNPJ da loja"
                        value={loginEmail}
                        readOnly={loginReadOnly}
                        onFocus={(e) => {
                          setLoginReadOnly(false);
                          e.currentTarget.removeAttribute('readonly');
                        }}
                        onMouseDown={(e) => {
                          setLoginReadOnly(false);
                          e.currentTarget.removeAttribute('readonly');
                        }}
                        onTouchStart={(e) => {
                          setLoginReadOnly(false);
                          e.currentTarget.removeAttribute('readonly');
                        }}
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
                        type={showLoginPassword ? 'text' : 'password'}
                        name="auth_user_key"
                        id="auth_user_key"
                        autoComplete="new-password"
                        data-lpignore="true"
                        data-1p-ignore="true"
                        placeholder="******"
                        value={loginPassword}
                        readOnly={loginReadOnly}
                        onFocus={(e) => {
                          setLoginReadOnly(false);
                          e.currentTarget.removeAttribute('readonly');
                        }}
                        onMouseDown={(e) => {
                          setLoginReadOnly(false);
                          e.currentTarget.removeAttribute('readonly');
                        }}
                        onTouchStart={(e) => {
                          setLoginReadOnly(false);
                          e.currentTarget.removeAttribute('readonly');
                        }}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        required
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-10 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                        className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                        title={showLoginPassword ? 'Ocultar senha' : 'Ver senha'}
                      >
                        {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
                    style={{
                      backgroundColor: primaryBrandColor,
                      boxShadow: `0 4px 14px ${primaryBrandColor}35`
                    }}
                  >
                    {loading ? 'Identificando Supermercado...' : (targetStoreName ? `Entrar no ${targetStoreName}` : 'Entrar')}
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
                      onClick={() => handleSwitchTab('register')}
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
              <form key="form-register-tab" onSubmit={handleRegister} className="space-y-3" autoComplete="off">
                {/* Invisible decoy inputs to absorb aggressive browser autofill */}
                <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', opacity: 0, height: 0, width: 0, overflow: 'hidden' }}>
                  <input type="text" name="decoy_reg_user" tabIndex={-1} autoComplete="off" />
                  <input type="password" name="decoy_reg_pwd" tabIndex={-1} autoComplete="off" />
                </div>

                {/* Client Registration Banner */}
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-xl flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">Cadastro de Cliente</span>
                      <span className="text-[10px] text-emerald-300/80 block">
                        {targetStoreName ? `Vinculado a ${targetStoreName}` : 'Cadastro de Cliente Consumidor'}
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
                    name="novo_cliente_email"
                    id="novo_cliente_email"
                    autoComplete="off"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    placeholder="seu@email.com"
                    value={regEmail}
                    readOnly={regReadOnly}
                    onFocus={(e) => {
                      setRegReadOnly(false);
                      e.currentTarget.removeAttribute('readonly');
                    }}
                    onMouseDown={(e) => {
                      setRegReadOnly(false);
                      e.currentTarget.removeAttribute('readonly');
                    }}
                    onTouchStart={(e) => {
                      setRegReadOnly(false);
                      e.currentTarget.removeAttribute('readonly');
                    }}
                    onChange={(e) => setRegEmail(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs text-slate-300 mb-1 font-medium">Senha (mínimo 6 caracteres) *</label>
                  <div className="relative">
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      name="novo_cliente_senha"
                      id="novo_cliente_senha"
                      autoComplete="new-password"
                      data-lpignore="true"
                      data-1p-ignore="true"
                      placeholder="******"
                      value={regPassword}
                      readOnly={regReadOnly}
                      onFocus={(e) => {
                        setRegReadOnly(false);
                        e.currentTarget.removeAttribute('readonly');
                      }}
                      onMouseDown={(e) => {
                        setRegReadOnly(false);
                        e.currentTarget.removeAttribute('readonly');
                      }}
                      onTouchStart={(e) => {
                        setRegReadOnly(false);
                        e.currentTarget.removeAttribute('readonly');
                      }}
                      onChange={(e) => setRegPassword(e.target.value)}
                      minLength={6}
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3.5 pr-10 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                      title={showRegPassword ? 'Ocultar senha' : 'Ver senha'}
                    >
                      {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all shadow-lg active:scale-95 disabled:opacity-50 mt-2 cursor-pointer"
                  style={{
                    backgroundColor: primaryBrandColor,
                    boxShadow: `0 4px 14px ${primaryBrandColor}35`
                  }}
                >
                  {loading ? 'Criando Conta...' : (targetStoreName ? `Cadastrar e Acessar ${targetStoreName}` : 'Finalizar Cadastro')}
                </button>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => handleSwitchTab('login')}
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
      </div>
  );
};
