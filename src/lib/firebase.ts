import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
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
import { PromotionItem, Order, OrderStatus, UserProfile } from "../types";
import { INITIAL_PROMOTIONS, INITIAL_ORDERS } from "../initialData";
import { extractDirectImageUrl, getCategoryFallbackImage } from "../utils/image";

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore using configured database ID
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || "(default)");

// Initialize Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

const PROMOTIONS_COLLECTION = "promotions";
const ORDERS_COLLECTION = "orders";
const USERS_COLLECTION = "users";

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
    (err) => {
      console.error("Error subscribing to promotions:", err);
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
    (err) => {
      console.error("Error subscribing to orders:", err);
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
  await deleteDoc(doc(db, PROMOTIONS_COLLECTION, id));
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
  } catch (err) {
    console.error("Error getting user from Firestore:", err);
  }
  return null;
}

/**
 * Get user profile from Firestore by email
 */
export async function getUserByEmailFromFirestore(email: string): Promise<UserProfile | null> {
  if (!email) return null;
  const cleanEmail = email.toLowerCase().trim();
  try {
    const q = query(collection(db, USERS_COLLECTION), where("email", "==", cleanEmail));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs[0].data() as UserProfile;
    }
    // Fallback: try raw trimmed email if lowercasing didn't match
    if (cleanEmail !== email.trim()) {
      const qRaw = query(collection(db, USERS_COLLECTION), where("email", "==", email.trim()));
      const snapRaw = await getDocs(qRaw);
      if (!snapRaw.empty) {
        return snapRaw.docs[0].data() as UserProfile;
      }
    }
  } catch (err) {
    console.error("Error getting user by email from Firestore:", err);
  }
  return null;
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
  details: { 
    razaoSocial: string;
    nomeFantasia: string; 
    cnpj: string; 
    inscricaoEstadual?: string;
    inscricaoMunicipal?: string;
    phone: string; 
    address: string;
    bairro?: string;
    cidade?: string;
    estado?: string;
    cep?: string;
    logoUrl?: string;
    aceitaCompraOnline: boolean;
  }
): Promise<void> {
  await setDoc(doc(db, "supermercados", uid), {
    supermercadoId: uid,
    razaoSocial: details.razaoSocial,
    nomeFantasia: details.nomeFantasia,
    cnpj: details.cnpj,
    inscricaoEstadual: details.inscricaoEstadual || '',
    inscricaoMunicipal: details.inscricaoMunicipal || '',
    phone: details.phone,
    address: details.address,
    bairro: details.bairro || '',
    cidade: details.cidade || '',
    estado: details.estado || '',
    cep: details.cep || '',
    logoUrl: details.logoUrl || '',
    aceitaCompraOnline: details.aceitaCompraOnline,
    updatedAt: new Date().toISOString()
  }, { merge: true });

  await setDoc(doc(db, USERS_COLLECTION, uid), {
    nome: details.nomeFantasia,
    razaoSocial: details.razaoSocial,
    nomeFantasia: details.nomeFantasia,
    documento: details.cnpj,
    inscricaoEstadual: details.inscricaoEstadual || '',
    inscricaoMunicipal: details.inscricaoMunicipal || '',
    phone: details.phone,
    address: details.address,
    bairro: details.bairro || '',
    cidade: details.cidade || '',
    estado: details.estado || '',
    cep: details.cep || '',
    logoUrl: details.logoUrl || '',
    aceitaCompraOnline: details.aceitaCompraOnline,
    cadastroCompleto: true
  }, { merge: true });
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
    (err) => {
      console.error("Error subscribing to users:", err);
    }
  );
}

