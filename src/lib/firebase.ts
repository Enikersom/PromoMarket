import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  initializeFirestore,
  setLogLevel,
  collection,
  getDocs,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  where
} from "firebase/firestore";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";
import { PromotionItem, Order, OrderStatus, UserProfile, SupermarketDetails, Encarte } from "../types";
import { INITIAL_PROMOTIONS, INITIAL_ORDERS } from "../initialData";
import { extractDirectImageUrl, getCategoryFallbackImage } from "../utils/image";

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Configure Firestore log level to silent to prevent benign gRPC idle disconnect warnings
try {
  setLogLevel('silent');
} catch (_) {}

// Initialize Firestore using configured database ID and auto-detect long polling to prevent GrpcConnection stream ECONNRESET
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true
}, firebaseConfig.firestoreDatabaseId || "(default)");

// Initialize Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

const PROMOTIONS_COLLECTION = "promotions";
const ORDERS_COLLECTION = "orders";
const USERS_COLLECTION = "users";
const ENCARTES_COLLECTION = "encartes";

export {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
};

/**
 * Seed initial products and orders into Firestore if collections are empty.
 */
export async function seedFirestoreIfEmpty(): Promise<void> {
  // Empty seed - no mock items
}

/**
 * Realtime listener for Promotions
 */
export function subscribeToPromotions(callback: (promotions: PromotionItem[]) => void): () => void {
  const q = query(collection(db, PROMOTIONS_COLLECTION));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: PromotionItem[] = snapshot.docs.map((d) => d.data() as PromotionItem);
      // Sort newest first
      items.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      callback(items);
    },
    (err: any) => {
      if (err?.code === 'permission-denied') {
        console.warn("⚠️ [Firestore] Permissão pendente para 'promotions'.");
      } else {
        console.error("Error subscribing to promotions:", err);
      }
    }
  );
}

/**
 * Realtime listener for Orders
 */
export function subscribeToOrders(callback: (orders: Order[]) => void): () => void {
  const q = query(collection(db, ORDERS_COLLECTION));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: Order[] = snapshot.docs.map((d) => d.data() as Order);
      items.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      callback(items);
    },
    (err: any) => {
      if (err?.code === 'permission-denied') {
        console.warn("⚠️ [Firestore] Permissão pendente para 'orders'.");
      } else {
        console.error("Error subscribing to orders:", err);
      }
    }
  );
}

/**
 * Add a new promotion product to Firestore
 */
export async function savePromotionToFirestore(promo: Omit<PromotionItem, 'id'>): Promise<PromotionItem> {
  const id = `promo-${Date.now()}`;
  const cleanImg = extractDirectImageUrl(promo.imageUrl) || getCategoryFallbackImage(promo.category);
  const newPromo: PromotionItem = {
    ...promo,
    id,
    imageUrl: cleanImg,
    createdAt: new Date().toISOString()
  };

  await setDoc(doc(db, PROMOTIONS_COLLECTION, id), newPromo);
  return newPromo;
}

/**
 * Update an existing promotion product in Firestore
 */
export async function updatePromotionInFirestore(id: string, updates: Partial<PromotionItem>): Promise<void> {
  if (updates.imageUrl) {
    updates.imageUrl = extractDirectImageUrl(updates.imageUrl);
  }
  await updateDoc(doc(db, PROMOTIONS_COLLECTION, id), updates);
}

/**
 * Delete a promotion product from Firestore
 */
export async function deletePromotionFromFirestore(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, PROMOTIONS_COLLECTION, id));
  } catch (err: any) {
    if (err?.code === 'permission-denied') {
      console.warn("⚠️ [Firestore] Permissão pendente ao excluir produto:", id);
    } else {
      console.error("Erro ao excluir promoção do Firestore:", err);
    }
  }
}

/**
 * Add a new customer order to Firestore
 */
export async function saveOrderToFirestore(orderData: Omit<Order, 'id' | 'status' | 'createdAt'>): Promise<Order> {
  const id = `PED-${Math.floor(1000 + Math.random() * 9000)}`;
  const newOrder: Order = {
    ...orderData,
    id,
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  await setDoc(doc(db, ORDERS_COLLECTION, id), newOrder);
  return newOrder;
}

/**
 * Update order status in Firestore
 */
export async function updateOrderStatusInFirestore(id: string, status: OrderStatus): Promise<void> {
  await updateDoc(doc(db, ORDERS_COLLECTION, id), { status });
}

/**
 * Save or update user profile in Firestore (collection: users / doc: {uid})
 */
export async function saveUserToFirestore(user: UserProfile): Promise<UserProfile> {
  const cleanEmail = (user.email || '').toLowerCase().trim();
  const userDoc: UserProfile = {
    ...user,
    email: cleanEmail,
    createdAt: user.createdAt || new Date().toISOString()
  };
  await setDoc(doc(db, USERS_COLLECTION, user.uid), userDoc, { merge: true });
  return userDoc;
}

/**
 * Get user profile from Firestore by UID
 */
export async function getUserFromFirestore(uid: string): Promise<UserProfile | null> {
  try {
    const snap = await getDoc(doc(db, USERS_COLLECTION, uid));
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }
  } catch (err: any) {
    if (err?.code === 'permission-denied') {
      console.warn("⚠️ [Firestore] Permissão pendente para ler perfil do usuário.");
    } else {
      console.error("Error getting user from Firestore:", err);
    }
  }
  return null;
}

/**
 * Find user or supermarket manager by email, CNPJ, document, phone, or name directly in Firestore
 */
export async function findUserOrSupermarketInFirestore(identifier: string): Promise<UserProfile | null> {
  if (!identifier) return null;
  const cleanInput = String(identifier).trim();
  const cleanEmail = cleanInput.toLowerCase();
  const cleanDigits = cleanInput.replace(/\D/g, '');

  try {
    // 1. PRIORIDADE MÁXIMA: Buscar na coleção "supermercados" (garante que gestores usem as credenciais e senhas liberadas pelo Admin Geral)
    const superSnap = await getDocs(collection(db, "supermercados"));
    for (const d of superSnap.docs) {
      const s = d.data() as any;
      const sEmail = s.email ? String(s.email).toLowerCase().trim() : '';
      const sCnpj = String(s.cnpj || s.documento || '').trim();
      const sCnpjDigits = sCnpj.replace(/\D/g, '');
      const sPhoneDigits = String(s.phone || '').replace(/\D/g, '');
      const sNome = String(s.nomeFantasia || s.razaoSocial || s.nome || '').toLowerCase().trim();
      const sId = String(s.supermercadoId || s.uid || d.id).trim();

      const matched = (sEmail && sEmail === cleanEmail) ||
        (sCnpj && (sCnpj.toLowerCase() === cleanEmail || sCnpj === cleanInput)) ||
        (cleanDigits.length >= 8 && sCnpjDigits && (sCnpjDigits === cleanDigits || sCnpjDigits.includes(cleanDigits) || cleanDigits.includes(sCnpjDigits))) ||
        (cleanDigits.length >= 8 && sPhoneDigits && sPhoneDigits === cleanDigits) ||
        (sNome && (sNome === cleanEmail || (cleanEmail.length >= 4 && sNome.includes(cleanEmail)))) ||
        (sId === cleanInput);

      if (matched) {
        const finalPass = s.senha || s.senhaProvisoria || s.senhaLiberada || '123456';
        return {
          uid: s.uid || d.id,
          nome: s.nomeFantasia || s.razaoSocial || 'Supermercado',
          email: s.email || (cleanEmail.includes('@') ? cleanEmail : `${d.id}@supermercado.com`),
          role: 'supermercado',
          supermercadoId: s.supermercadoId || s.uid || d.id,
          registeredSupermarketId: s.supermercadoId || s.uid || d.id,
          registeredSupermarketName: s.nomeFantasia || s.razaoSocial,
          cadastroCompleto: true,
          senha: String(finalPass).trim(),
          senhaProvisoria: String(finalPass).trim(),
          senhaLiberada: String(finalPass).trim(),
          cnpj: s.cnpj || s.documento,
          documento: s.cnpj || s.documento,
          razaoSocial: s.razaoSocial,
          nomeFantasia: s.nomeFantasia,
          inscricaoEstadual: s.inscricaoEstadual,
          inscricaoMunicipal: s.inscricaoMunicipal,
          phone: s.phone,
          address: s.address,
          bairro: s.bairro,
          cidade: s.cidade,
          estado: s.estado,
          cep: s.cep,
          logoUrl: s.logoUrl,
          splashImageUrl: s.splashImageUrl,
          primaryColor: s.primaryColor,
          secondaryColor: s.secondaryColor,
          tertiaryColor: s.tertiaryColor,
          quaternaryColor: s.quaternaryColor,
          brandColors: Array.isArray(s.brandColors) ? s.brandColors : [],
          aceitaCompraOnline: s.aceitaCompraOnline !== false,
          valorLocacao: s.valorLocacao,
          dataVencimento: s.dataVencimento,
          statusInquilino: s.statusInquilino || 'Ativo',
          bloqueado: Boolean(s.bloqueado),
          horarioFuncionamento: s.horarioFuncionamento,
          horarioSegSex: s.horarioSegSex,
          horarioSab: s.horarioSab || s.horarioSabado,
          horarioSabado: s.horarioSabado || s.horarioSab,
          horarioDom: s.horarioDom || s.horarioDomingo,
          horarioDomingo: s.horarioDomingo || s.horarioDom,
          horarioObservacoes: s.horarioObservacoes
        } as UserProfile;
      }
    }

    // 2. Busca na coleção USERS_COLLECTION
    const qEmail = query(collection(db, USERS_COLLECTION), where("email", "==", cleanEmail));
    const snapEmail = await getDocs(qEmail);
    if (!snapEmail.empty) {
      const uData = snapEmail.docs[0].data() as any;
      const targetSuperId = uData.supermercadoId || (uData.role === 'supermercado' ? (uData.uid || snapEmail.docs[0].id) : null);
      
      // Se for um usuário com perfil de supermercado, mescla os dados mais recentes de "supermercados"
      let mergedPass = uData.senha || uData.senhaProvisoria;
      if (targetSuperId) {
        for (const d of superSnap.docs) {
          const s = d.data() as any;
          if (d.id === targetSuperId || s.uid === targetSuperId || s.supermercadoId === targetSuperId) {
            mergedPass = s.senha || s.senhaProvisoria || mergedPass || '123456';
            return {
              ...s,
              ...uData,
              primaryColor: s.primaryColor || uData.primaryColor,
              secondaryColor: s.secondaryColor || uData.secondaryColor,
              tertiaryColor: s.tertiaryColor || uData.tertiaryColor,
              quaternaryColor: s.quaternaryColor || uData.quaternaryColor,
              brandColors: Array.isArray(s.brandColors) ? s.brandColors : (Array.isArray(uData.brandColors) ? uData.brandColors : []),
              splashImageUrl: s.splashImageUrl || uData.splashImageUrl,
              logoUrl: s.logoUrl || uData.logoUrl,
              horarioFuncionamento: s.horarioFuncionamento || uData.horarioFuncionamento,
              horarioSegSex: s.horarioSegSex || uData.horarioSegSex,
              horarioSab: s.horarioSab || s.horarioSabado || uData.horarioSab || uData.horarioSabado,
              horarioSabado: s.horarioSabado || s.horarioSab || uData.horarioSabado || uData.horarioSab,
              horarioDom: s.horarioDom || s.horarioDomingo || uData.horarioDom || uData.horarioDomingo,
              horarioDomingo: s.horarioDomingo || s.horarioDom || uData.horarioDomingo || uData.horarioDom,
              horarioObservacoes: s.horarioObservacoes || uData.horarioObservacoes,
              role: 'supermercado',
              uid: uData.uid || snapEmail.docs[0].id,
              supermercadoId: targetSuperId,
              senha: String(mergedPass).trim(),
              senhaProvisoria: String(mergedPass).trim(),
              senhaLiberada: String(mergedPass).trim(),
              cadastroCompleto: true
            };
          }
        }
      }

      return {
        ...uData,
        uid: uData.uid || snapEmail.docs[0].id,
        supermercadoId: uData.role === 'supermercado' ? (uData.supermercadoId || uData.uid || snapEmail.docs[0].id) : uData.supermercadoId,
        senha: mergedPass ? String(mergedPass).trim() : undefined,
        senhaProvisoria: mergedPass ? String(mergedPass).trim() : undefined
      };
    }

    // 3. Fallback scan all users collection (por documento/CNPJ ou telefone)
    const usersSnap = await getDocs(collection(db, USERS_COLLECTION));
    for (const d of usersSnap.docs) {
      const u = d.data() as any;
      const uEmail = u.email ? String(u.email).toLowerCase().trim() : '';
      const uDoc = String(u.documento || u.cnpj || u.cpf || '').trim();
      const uDocDigits = uDoc.replace(/\D/g, '');
      const uPhoneDigits = String(u.phone || '').replace(/\D/g, '');
      const uNome = String(u.nome || u.nomeFantasia || '').toLowerCase().trim();
      const uId = String(u.uid || d.id).trim();

      const matched = (uEmail && uEmail === cleanEmail) ||
        (uDoc && uDoc.toLowerCase() === cleanEmail) ||
        (cleanDigits.length >= 8 && uDocDigits && uDocDigits === cleanDigits) ||
        (cleanDigits.length >= 8 && uPhoneDigits && uPhoneDigits === cleanDigits) ||
        (uNome && uNome === cleanEmail) ||
        (uId === cleanInput);

      if (matched) {
        const isSuper = u.role === 'supermercado' || Boolean(u.supermercadoId && !u.cpf);
        return {
          ...u,
          uid: u.uid || d.id,
          role: isSuper ? 'supermercado' : (u.role || 'cliente'),
          supermercadoId: isSuper ? (u.supermercadoId || u.uid || d.id) : u.supermercadoId,
          cadastroCompleto: isSuper ? true : (u.cadastroCompleto !== false)
        } as UserProfile;
      }
    }
  } catch (err: any) {
    if (err?.code === 'permission-denied') {
      console.warn("⚠️ [Firestore] Permissão pendente ao buscar usuário/supermercado.");
    } else {
      console.error("Error in findUserOrSupermarketInFirestore:", err);
    }
  }
  return null;
}

/**
 * Get user profile from Firestore by email
 */
export async function getUserByEmailFromFirestore(email: string): Promise<UserProfile | null> {
  return findUserOrSupermarketInFirestore(email);
}

/**
 * Save client registration details in "clientes" and update "users"
 */
export async function saveClientDetailsToFirestore(
  uid: string, 
  details: { 
    cpf: string; 
    phone: string; 
    cep: string; 
    address: string;
    registeredSupermarketId?: string;
    registeredSupermarketName?: string;
  }
): Promise<void> {
  await setDoc(doc(db, "clientes", uid), {
    uid,
    cpf: details.cpf,
    phone: details.phone,
    cep: details.cep,
    address: details.address,
    ...(details.registeredSupermarketId ? { registeredSupermarketId: details.registeredSupermarketId } : {}),
    ...(details.registeredSupermarketName ? { registeredSupermarketName: details.registeredSupermarketName } : {}),
    ...(details.registeredSupermarketId ? { supermercadoId: details.registeredSupermarketId } : {})
  }, { merge: true });

  await setDoc(doc(db, USERS_COLLECTION, uid), {
    documento: details.cpf,
    phone: details.phone,
    cep: details.cep,
    address: details.address,
    cadastroCompleto: true,
    ...(details.registeredSupermarketId ? { registeredSupermarketId: details.registeredSupermarketId } : {}),
    ...(details.registeredSupermarketName ? { registeredSupermarketName: details.registeredSupermarketName } : {}),
    ...(details.registeredSupermarketId ? { supermercadoId: details.registeredSupermarketId } : {})
  }, { merge: true });
}

/**
 * Save supermarket registration details in "supermercados" and update "users"
 */
export async function saveSupermarketDetailsToFirestore(
  uid: string, 
  details: Partial<SupermarketDetails> & {
    razaoSocial?: string;
    nomeFantasia?: string; 
    cnpj?: string; 
    inscricaoEstadual?: string;
    inscricaoMunicipal?: string;
    phone?: string; 
    address?: string;
    bairro?: string;
    cidade?: string;
    estado?: string;
    cep?: string;
    logoUrl?: string;
    splashImageUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
    tertiaryColor?: string;
    quaternaryColor?: string;
    brandColors?: string[];
    horarioFuncionamento?: string;
    horarioSegSex?: string;
    horarioSab?: string;
    horarioSabado?: string;
    horarioDom?: string;
    horarioDomingo?: string;
    horarioObservacoes?: string;
    aceitaCompraOnline?: boolean;
  }
): Promise<void> {
  const payload: any = {
    supermercadoId: uid,
    uid: uid,
    updatedAt: new Date().toISOString()
  };

  if (details.razaoSocial !== undefined) payload.razaoSocial = details.razaoSocial;
  if (details.nomeFantasia !== undefined) {
    payload.nomeFantasia = details.nomeFantasia;
    payload.nome = details.nomeFantasia;
  }
  if (details.cnpj !== undefined) {
    payload.cnpj = details.cnpj;
    payload.documento = details.cnpj;
  }
  if (details.inscricaoEstadual !== undefined) payload.inscricaoEstadual = details.inscricaoEstadual;
  if (details.inscricaoMunicipal !== undefined) payload.inscricaoMunicipal = details.inscricaoMunicipal;
  if (details.phone !== undefined) payload.phone = details.phone;
  if (details.address !== undefined) payload.address = details.address;
  if (details.bairro !== undefined) payload.bairro = details.bairro;
  if (details.cidade !== undefined) payload.cidade = details.cidade;
  if (details.estado !== undefined) payload.estado = details.estado;
  if (details.cep !== undefined) payload.cep = details.cep;
  if (details.logoUrl !== undefined) payload.logoUrl = details.logoUrl;
  if (details.splashImageUrl !== undefined) payload.splashImageUrl = details.splashImageUrl;
  if (details.primaryColor !== undefined) payload.primaryColor = details.primaryColor;
  if (details.secondaryColor !== undefined) payload.secondaryColor = details.secondaryColor;
  if (details.tertiaryColor !== undefined) payload.tertiaryColor = details.tertiaryColor;
  if (details.quaternaryColor !== undefined) payload.quaternaryColor = details.quaternaryColor;
  if (details.brandColors !== undefined) payload.brandColors = details.brandColors;
  if (details.horarioFuncionamento !== undefined) payload.horarioFuncionamento = details.horarioFuncionamento;
  if (details.horarioSegSex !== undefined) payload.horarioSegSex = details.horarioSegSex;
  if (details.horarioSab !== undefined) {
    payload.horarioSab = details.horarioSab;
    payload.horarioSabado = details.horarioSab;
  }
  if (details.horarioSabado !== undefined) {
    payload.horarioSabado = details.horarioSabado;
    payload.horarioSab = details.horarioSabado;
  }
  if (details.horarioDom !== undefined) {
    payload.horarioDom = details.horarioDom;
    payload.horarioDomingo = details.horarioDom;
  }
  if (details.horarioDomingo !== undefined) {
    payload.horarioDomingo = details.horarioDomingo;
    payload.horarioDom = details.horarioDomingo;
  }
  if (details.horarioObservacoes !== undefined) payload.horarioObservacoes = details.horarioObservacoes;
  if (details.aceitaCompraOnline !== undefined) payload.aceitaCompraOnline = details.aceitaCompraOnline;

  // Sanitizar payload removendo quaisquer chaves com valor undefined
  const sanitizedPayload: any = {};
  Object.keys(payload).forEach((k) => {
    if (payload[k] !== undefined) {
      sanitizedPayload[k] = payload[k];
    }
  });

  try {
    await Promise.all([
      setDoc(doc(db, "supermercados", uid), sanitizedPayload, { merge: true }),
      setDoc(doc(db, USERS_COLLECTION, uid), {
        ...sanitizedPayload,
        role: 'supermercado',
        cadastroCompleto: true
      }, { merge: true })
    ]);

    // Atualizar documentos correspondentes por nomeFantasia, cnpj ou supermercadoId
    try {
      const superSnap = await getDocs(collection(db, "supermercados"));
      const matchedUpdates: Promise<any>[] = [];
      superSnap.forEach((d) => {
        const s = d.data();
        const matches = d.id === uid || 
          s.supermercadoId === uid || 
          s.uid === uid ||
          (details.cnpj && s.cnpj && s.cnpj.replace(/\D/g, '') === String(details.cnpj).replace(/\D/g, '')) ||
          (details.nomeFantasia && s.nomeFantasia && s.nomeFantasia.toLowerCase().trim() === details.nomeFantasia.toLowerCase().trim());

        if (matches && d.id !== uid) {
          matchedUpdates.push(setDoc(doc(db, "supermercados", d.id), sanitizedPayload, { merge: true }));
        }
      });
      if (matchedUpdates.length > 0) await Promise.all(matchedUpdates);
    } catch (e) {
      console.warn("Aviso ao sincronizar documentos correlatos de supermercados:", e);
    }
  } catch (err: any) {
    if (err?.code === 'permission-denied') {
      console.warn("⚠️ [Firestore] Permissão pendente ao salvar detalhes do supermercado.");
    } else {
      console.error("Erro ao salvar detalhes do supermercado no Firestore:", err);
    }
    throw err;
  }
}

/**
 * Realtime listener for Users
 */
export function subscribeToUsers(callback: (users: UserProfile[]) => void): () => void {
  const q = query(collection(db, USERS_COLLECTION));
  return onSnapshot(
    q,
    (snapshot) => {
      const users: UserProfile[] = snapshot.docs.map((d) => d.data() as UserProfile);
      callback(users);
    },
    (err: any) => {
      if (err?.code === 'permission-denied') {
        console.warn("⚠️ [Firestore] Permissão pendente para 'users'.");
      } else {
        console.error("Error subscribing to users:", err);
      }
    }
  );
}

/**
 * Fetch all tenants/supermarkets directly from Firestore
 */
export async function getTenantsFromFirestore(): Promise<SupermarketDetails[]> {
  try {
    const listMap = new Map<string, SupermarketDetails>();

    const snap = await getDocs(collection(db, "supermercados"));
    snap.forEach((d) => {
      const item = d.data() as SupermarketDetails;
      const key = item.supermercadoId || item.uid || d.id;
      if (key) {
        listMap.set(key, {
          ...item,
          uid: item.uid || d.id,
          supermercadoId: item.supermercadoId || d.id
        });
      }
    });

    // Also check users with role === 'supermercado' and merge
    try {
      const usersSnap = await getDocs(query(collection(db, USERS_COLLECTION), where("role", "==", "supermercado")));
      usersSnap.forEach((d) => {
        const u = d.data() as any;
        const key = u.supermercadoId || u.uid || d.id;
        if (key) {
          const existing = listMap.get(key);
          const merged: SupermarketDetails = {
            ...(existing || {}),
            uid: u.uid || existing?.uid || d.id,
            supermercadoId: u.supermercadoId || u.uid || existing?.supermercadoId || d.id,
            nomeFantasia: u.nomeFantasia || u.nome || existing?.nomeFantasia || 'Supermercado',
            razaoSocial: u.razaoSocial || u.nome || existing?.razaoSocial || 'Supermercado',
            cnpj: u.cnpj || u.documento || existing?.cnpj || '',
            inscricaoEstadual: u.inscricaoEstadual || existing?.inscricaoEstadual || '',
            inscricaoMunicipal: u.inscricaoMunicipal || existing?.inscricaoMunicipal || '',
            phone: u.phone || existing?.phone || '',
            address: u.address || existing?.address || '',
            bairro: u.bairro || existing?.bairro || '',
            cidade: u.cidade || existing?.cidade || '',
            estado: u.estado || existing?.estado || '',
            cep: u.cep || existing?.cep || '',
            logoUrl: u.logoUrl || existing?.logoUrl || '',
            splashImageUrl: u.splashImageUrl || existing?.splashImageUrl || '',
            primaryColor: u.primaryColor || existing?.primaryColor || '',
            secondaryColor: u.secondaryColor || existing?.secondaryColor || '',
            tertiaryColor: u.tertiaryColor || existing?.tertiaryColor || '',
            quaternaryColor: u.quaternaryColor || existing?.quaternaryColor || '',
            brandColors: Array.isArray(u.brandColors) && u.brandColors.length > 0 ? u.brandColors : (existing?.brandColors || []),
            horarioFuncionamento: u.horarioFuncionamento || existing?.horarioFuncionamento || '',
            horarioSegSex: u.horarioSegSex || existing?.horarioSegSex || '',
            horarioSab: u.horarioSab || u.horarioSabado || existing?.horarioSab || '',
            horarioSabado: u.horarioSabado || u.horarioSab || existing?.horarioSabado || '',
            horarioDom: u.horarioDom || u.horarioDomingo || existing?.horarioDom || '',
            horarioDomingo: u.horarioDomingo || u.horarioDom || existing?.horarioDomingo || '',
            horarioObservacoes: u.horarioObservacoes || existing?.horarioObservacoes || '',
            aceitaCompraOnline: u.aceitaCompraOnline !== undefined ? u.aceitaCompraOnline : (existing?.aceitaCompraOnline !== false),
            valorLocacao: u.valorLocacao || existing?.valorLocacao || 0,
            dataVencimento: u.dataVencimento || existing?.dataVencimento || '',
            statusInquilino: u.statusInquilino || existing?.statusInquilino || 'Ativo',
            bloqueado: Boolean(u.bloqueado ?? existing?.bloqueado),
            senhaProvisoria: u.senhaProvisoria || u.senha || existing?.senhaProvisoria || '123456',
            senha: u.senha || u.senhaProvisoria || existing?.senha || '123456'
          };
          listMap.set(key, merged);
        }
      });
    } catch (e) {
      console.warn("Could not fetch user supermarkets:", e);
    }

    return Array.from(listMap.values());
  } catch (err: any) {
    if (err?.code === 'permission-denied') {
      console.warn("⚠️ [Firestore] Permissão pendente para carregar supermercados/tenants.");
    } else {
      console.error("Error fetching tenants from Firestore:", err);
    }
    return [];
  }
}

/**
 * Subscribe in real-time to tenants/supermarkets in Firestore
 */
export function subscribeToTenants(callback: (tenants: SupermarketDetails[]) => void): () => void {
  try {
    // Initial fetch immediately
    getTenantsFromFirestore().then((list) => {
      if (Array.isArray(list)) callback(list);
    }).catch(() => {});

    const unsubSuper = onSnapshot(
      collection(db, "supermercados"),
      () => {
        getTenantsFromFirestore().then((list) => {
          if (Array.isArray(list)) callback(list);
        }).catch(() => {});
      },
      (error) => {
        console.warn("Error subscribing to supermarkets snapshot:", error);
      }
    );

    const unsubUsers = onSnapshot(
      query(collection(db, USERS_COLLECTION), where("role", "==", "supermercado")),
      () => {
        getTenantsFromFirestore().then((list) => {
          if (Array.isArray(list)) callback(list);
        }).catch(() => {});
      },
      (error) => {
        console.warn("Error subscribing to users supermarkets snapshot:", error);
      }
    );

    return () => {
      unsubSuper();
      unsubUsers();
    };
  } catch (err) {
    console.warn("Could not setup subscribeToTenants:", err);
    return () => {};
  }
}

/**
 * Save new tenant in Firestore directly
 */
export async function saveTenantToFirestore(data: Partial<SupermarketDetails> & { uid?: string; email?: string }): Promise<SupermarketDetails> {
  const id = data.uid || data.supermercadoId || `supermercado-${Date.now()}`;
  const newTenant: any = {
    uid: id,
    supermercadoId: id,
    nome: data.nomeFantasia || 'Supermercado',
    nomeFantasia: data.nomeFantasia || 'Supermercado',
    razaoSocial: data.razaoSocial || data.nomeFantasia || 'Supermercado',
    documento: data.cnpj || '',
    cnpj: data.cnpj || '',
    inscricaoEstadual: data.inscricaoEstadual || '',
    inscricaoMunicipal: data.inscricaoMunicipal || '',
    phone: data.phone || '',
    email: data.email || `${id}@supermercado.com`,
    senhaProvisoria: data.senhaProvisoria || '123456',
    senha: data.senhaProvisoria || data.senha || '123456',
    address: data.address || '',
    bairro: data.bairro || '',
    cidade: data.cidade || '',
    estado: data.estado || '',
    cep: data.cep || '',
    logoUrl: data.logoUrl || '',
    splashImageUrl: data.splashImageUrl || '',
    primaryColor: data.primaryColor || '#2563eb',
    secondaryColor: data.secondaryColor || '#f59e0b',
    role: 'supermercado',
    aceitaCompraOnline: data.aceitaCompraOnline !== false,
    cadastroCompleto: true,
    valorLocacao: Number(data.valorLocacao || 0),
    dataVencimento: data.dataVencimento || '',
    statusInquilino: data.statusInquilino || 'Ativo',
    bloqueado: Boolean(data.bloqueado),
    createdAt: (data as any).createdAt || new Date().toISOString()
  };

  await setDoc(doc(db, "users", id), newTenant, { merge: true });
  await setDoc(doc(db, "supermercados", id), newTenant, { merge: true });
  return newTenant;
}

/**
 * Update tenant details in Firestore
 */
export async function updateTenantInFirestore(targetId: string, updates: Partial<SupermarketDetails>): Promise<void> {
  const finalPassword = updates.senhaProvisoria || (updates as any).senha || (updates as any).senhaLiberada;
  const rawUpdates: any = {
    ...updates,
    role: 'supermercado',
    cadastroCompleto: true,
    updatedAt: new Date().toISOString()
  };
  if (updates.nomeFantasia) rawUpdates.nome = updates.nomeFantasia;
  if (updates.cnpj) rawUpdates.documento = updates.cnpj;
  if (finalPassword) {
    const trimmedPass = String(finalPassword).trim();
    rawUpdates.senhaProvisoria = trimmedPass;
    rawUpdates.senha = trimmedPass;
    rawUpdates.senhaLiberada = trimmedPass;
  }

  // Sanitizar para remover qualquer chave undefined
  const cleanUpdates: any = {};
  Object.keys(rawUpdates).forEach((k) => {
    if (rawUpdates[k] !== undefined) {
      cleanUpdates[k] = rawUpdates[k];
    }
  });

  // 1. Target direct IDs in both collections
  await Promise.all([
    setDoc(doc(db, "supermercados", targetId), cleanUpdates, { merge: true }).catch((err) => {
      console.warn("Aviso ao atualizar doc direto supermercados:", err);
    }),
    setDoc(doc(db, USERS_COLLECTION, targetId), cleanUpdates, { merge: true }).catch((err) => {
      console.warn("Aviso ao atualizar doc direto users:", err);
    })
  ]);

  // 2. Update any records in "supermercados" matching targetId, uid, cnpj ou nomeFantasia
  try {
    const superSnap = await getDocs(collection(db, "supermercados"));
    const superUpdates: Promise<any>[] = [];
    superSnap.forEach((d) => {
      const s = d.data();
      const matches = d.id === targetId || 
        s.supermercadoId === targetId || 
        s.uid === targetId || 
        (updates.cnpj && s.cnpj && s.cnpj.replace(/\D/g, '') === String(updates.cnpj).replace(/\D/g, '')) ||
        (updates.nomeFantasia && s.nomeFantasia && s.nomeFantasia.toLowerCase().trim() === updates.nomeFantasia.toLowerCase().trim()) ||
        (updates.email && s.email && String(s.email).toLowerCase().trim() === String(updates.email).toLowerCase().trim());

      if (matches) {
        superUpdates.push(setDoc(doc(db, "supermercados", d.id), cleanUpdates, { merge: true }));
      }
    });
    if (superUpdates.length > 0) await Promise.all(superUpdates);
  } catch (err) {
    console.warn("Aviso ao sincronizar coleção supermercados:", err);
  }

  // 3. Update any linked records in "users" matching this supermarket
  try {
    const userUpdates: Promise<any>[] = [];
    const qSuper = query(collection(db, USERS_COLLECTION), where("supermercadoId", "==", targetId));
    const snapSuper = await getDocs(qSuper);
    snapSuper.forEach((d) => {
      userUpdates.push(setDoc(doc(db, USERS_COLLECTION, d.id), cleanUpdates, { merge: true }).catch(() => {}));
    });

    const emailToUpdate = (updates as any).email;
    if (emailToUpdate) {
      const qEmail = query(collection(db, USERS_COLLECTION), where("email", "==", String(emailToUpdate).toLowerCase().trim()));
      const snapEmail = await getDocs(qEmail);
      snapEmail.forEach((d) => {
        userUpdates.push(setDoc(doc(db, USERS_COLLECTION, d.id), cleanUpdates, { merge: true }).catch(() => {}));
      });
    }

    if (userUpdates.length > 0) await Promise.all(userUpdates);
  } catch (_) {}
}

/**
 * Delete tenant from Firestore (both collections) and purge associated records
 */
export async function deleteTenantFromFirestore(
  targetId: string,
  altUid?: string,
  altSuperId?: string,
  docId?: string,
  tenantName?: string
): Promise<void> {
  const idsToDelete = Array.from(new Set([targetId, altUid, altSuperId, docId].filter(Boolean) as string[]));
  const cleanName = (tenantName || '').trim().toLowerCase();

  // 1. Direct delete by ID in both "supermercados" and "users"
  for (const id of idsToDelete) {
    try {
      await deleteDoc(doc(db, "supermercados", id));
    } catch (e) {
      console.warn("Could not delete from supermercados by id:", id, e);
    }
    try {
      await deleteDoc(doc(db, "users", id));
    } catch (e) {
      console.warn("Could not delete from users by id:", id, e);
    }
  }

  // 2. Query any documents in "supermercados" that match any ID or name
  try {
    const snapSuper = await getDocs(collection(db, "supermercados"));
    for (const d of snapSuper.docs) {
      const data = d.data() as any;
      const sName = (data?.nomeFantasia || data?.razaoSocial || data?.nome || '').trim().toLowerCase();
      if (
        idsToDelete.includes(d.id) ||
        (data?.supermercadoId && idsToDelete.includes(data.supermercadoId)) ||
        (data?.uid && idsToDelete.includes(data.uid)) ||
        (cleanName && sName === cleanName)
      ) {
        await deleteDoc(doc(db, "supermercados", d.id)).catch(() => {});
      }
    }
  } catch (e) {
    console.warn("Could not scan/delete matching supermercados:", e);
  }

  // 3. Query any documents in "users" (with role === 'supermercado') that match any ID or name
  try {
    const snapUsers = await getDocs(query(collection(db, USERS_COLLECTION), where("role", "==", "supermercado")));
    for (const d of snapUsers.docs) {
      const data = d.data() as any;
      const uName = (data?.nomeFantasia || data?.razaoSocial || data?.nome || '').trim().toLowerCase();
      if (
        idsToDelete.includes(d.id) ||
        (data?.supermercadoId && idsToDelete.includes(data.supermercadoId)) ||
        (data?.uid && idsToDelete.includes(data.uid)) ||
        (cleanName && uName === cleanName)
      ) {
        await deleteDoc(doc(db, "users", d.id)).catch(() => {});
      }
    }
  } catch (e) {
    console.warn("Could not scan/delete matching users:", e);
  }

  // 4. Also delete associated promotions from Firestore
  try {
    const snapPromo = await getDocs(collection(db, PROMOTIONS_COLLECTION));
    for (const d of snapPromo.docs) {
      const data = d.data() as any;
      const pSuper = (data?.supermarketName || '').trim().toLowerCase();
      if (
        idsToDelete.includes(data?.supermarketId) ||
        idsToDelete.includes(data?.tenantId) ||
        (cleanName && pSuper === cleanName)
      ) {
        await deleteDoc(doc(db, PROMOTIONS_COLLECTION, d.id)).catch(() => {});
      }
    }
  } catch (e) {
    console.warn("Could not delete promotions for deleted tenant:", e);
  }

  // 5. Also delete associated encartes from Firestore
  try {
    const snapEncartes = await getDocs(collection(db, ENCARTES_COLLECTION));
    for (const d of snapEncartes.docs) {
      const data = d.data() as any;
      const eSuper = (data?.supermarketName || '').trim().toLowerCase();
      if (
        idsToDelete.includes(data?.supermarketId) ||
        (cleanName && eSuper === cleanName)
      ) {
        await deleteDoc(doc(db, ENCARTES_COLLECTION, d.id)).catch(() => {});
      }
    }
  } catch (e) {
    console.warn("Could not delete encartes for deleted tenant:", e);
  }
}

/**
 * Get Admin password from Firestore
 */
export async function getAdminPasswordFromFirestore(): Promise<string> {
  try {
    const snap = await getDoc(doc(db, "admin", "credentials"));
    if (snap.exists() && snap.data()?.password) {
      return snap.data().password;
    }
  } catch (err) {
    console.warn("Could not load admin password from Firestore:", err);
  }
  return "admin123";
}

/**
 * Update Admin password in Firestore
 */
export async function setAdminPasswordInFirestore(password: string): Promise<void> {
  await setDoc(doc(db, "admin", "credentials"), {
    password,
    updatedAt: new Date().toISOString()
  }, { merge: true });
}

/**
 * Fetch Encartes from Firestore
 */
export async function getEncartesFromFirestore(): Promise<Encarte[]> {
  try {
    const snap = await getDocs(collection(db, "encartes"));
    return snap.docs.map(d => d.data() as Encarte);
  } catch (err: any) {
    if (err?.code === 'permission-denied') {
      console.warn("⚠️ [Firestore] Permissão pendente para carregar encartes.");
    } else {
      console.error("Error fetching encartes from Firestore:", err);
    }
    return [];
  }
}

/**
 * Save Encarte to Firestore
 */
export async function saveEncarteToFirestore(encarte: Encarte): Promise<Encarte> {
  await setDoc(doc(db, "encartes", encarte.id), encarte, { merge: true });
  return encarte;
}

/**
 * Restore data exported from old database to new Firestore
 */
export async function restoreBackupToFirestore(backupData: any) {
  if (!backupData) return { success: false, message: "Nenhum dado fornecido." };
  const counts = { supermarkets: 0, promotions: 0, encartes: 0, users: 0 };
  
  if (Array.isArray(backupData.supermercados)) {
    for (const item of backupData.supermercados) {
      const docId = item.id || item.supermercadoId || item.uid;
      if (docId) {
        await setDoc(doc(db, "supermercados", docId), item, { merge: true });
        counts.supermarkets++;
      }
    }
  }

  if (Array.isArray(backupData.promotions)) {
    for (const item of backupData.promotions) {
      if (item.id) {
        await setDoc(doc(db, PROMOTIONS_COLLECTION, item.id), item, { merge: true });
        counts.promotions++;
      }
    }
  }

  if (Array.isArray(backupData.encartes)) {
    for (const item of backupData.encartes) {
      if (item.id) {
        await setDoc(doc(db, "encartes", item.id), item, { merge: true });
        counts.encartes++;
      }
    }
  }

  if (Array.isArray(backupData.users)) {
    for (const item of backupData.users) {
      const docId = item.id || item.uid;
      if (docId) {
        await setDoc(doc(db, USERS_COLLECTION, docId), item, { merge: true });
        counts.users++;
      }
    }
  }

  return { success: true, counts };
}

/**
 * Update tenant/supermarket password in Firestore
 */
export async function changeTenantPasswordInFirestore(tenantId: string, newPassword: string): Promise<boolean> {
  const updates = {
    senha: newPassword,
    senhaProvisoria: newPassword,
    updatedAt: new Date().toISOString()
  };

  let success = false;
  try {
    await updateDoc(doc(db, "supermercados", tenantId), updates);
    success = true;
  } catch (_) {
    try {
      await setDoc(doc(db, "supermercados", tenantId), updates, { merge: true });
      success = true;
    } catch (e) {
      console.warn("Could not update password in supermercados:", tenantId, e);
    }
  }

  try {
    await updateDoc(doc(db, USERS_COLLECTION, tenantId), updates);
    success = true;
  } catch (_) {
    try {
      await setDoc(doc(db, USERS_COLLECTION, tenantId), updates, { merge: true });
      success = true;
    } catch (e) {
      console.warn("Could not update password in users:", tenantId, e);
    }
  }

  return success;
}


