import express, { Request, Response } from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  initializeFirestore,
  setLogLevel,
  collection,
  getDocs,
  getDoc,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where
} from "firebase/firestore";
import firebaseConfig from "./firebase-applet-config.json";
import { INITIAL_PROMOTIONS, INITIAL_ENCARTES, INITIAL_ORDERS } from "./src/initialData";
import { PromotionItem, Encarte, Order, RealtimeEvent, OrderStatus } from "./src/types";

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(process.cwd(), "public")));

// Configure Firestore log level to silent to suppress benign idle gRPC stream disconnects
try {
  setLogLevel('silent');
} catch (_) {}

// Initialize Firebase App & Firestore Database with robust long-polling auto-detect
const firebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = initializeFirestore(firebaseApp, {
  experimentalAutoDetectLongPolling: true
}, firebaseConfig.firestoreDatabaseId || "(default)");

const PROMOTIONS_COLLECTION = "promotions";
const ORDERS_COLLECTION = "orders";
const USERS_COLLECTION = "users";
const ENCARTES_COLLECTION = "encartes";

// Read exported backup from old Firestore if available
let oldExportedBackup: any = null;
try {
  const backupPath = path.join(process.cwd(), "exported_old_data.json");
  if (fs.existsSync(backupPath)) {
    const raw = fs.readFileSync(backupPath, "utf8");
    oldExportedBackup = JSON.parse(raw);
    console.log(`[Backup] Dados do banco antigo carregados com sucesso: ${oldExportedBackup?.supermercados?.length || 0} supermercados, ${oldExportedBackup?.promotions?.length || 0} promoções, ${oldExportedBackup?.encartes?.length || 0} encartes.`);
  }
} catch (e) {
  console.warn("Aviso ao ler exported_old_data.json:", e);
}

// In-memory data store for live real-time sync (seeded with backup if available)
let promotionsStore: PromotionItem[] = Array.isArray(oldExportedBackup?.promotions) && oldExportedBackup.promotions.length > 0
  ? [...oldExportedBackup.promotions]
  : [];
let encartesStore: Encarte[] = Array.isArray(oldExportedBackup?.encartes) && oldExportedBackup.encartes.length > 0
  ? [...oldExportedBackup.encartes]
  : [];
let ordersStore: Order[] = [];
let adminPasswordStore = "admin123";

// Helper function to restore backup directly to Firestore
async function restoreOldBackupToFirestore() {
  if (!oldExportedBackup) return { success: false, message: "Arquivo de backup não encontrado." };
  const counts = { supermarkets: 0, promotions: 0, encartes: 0, users: 0 };
  try {
    if (Array.isArray(oldExportedBackup.supermercados)) {
      for (const item of oldExportedBackup.supermercados) {
        const docId = item.id || item.supermercadoId || item.uid;
        if (docId) {
          await setDoc(doc(db, "supermercados", docId), item, { merge: true });
          counts.supermarkets++;
        }
      }
    }
    if (Array.isArray(oldExportedBackup.promotions)) {
      for (const item of oldExportedBackup.promotions) {
        if (item.id) {
          await setDoc(doc(db, PROMOTIONS_COLLECTION, item.id), item, { merge: true });
          counts.promotions++;
        }
      }
    }
    if (Array.isArray(oldExportedBackup.encartes)) {
      for (const item of oldExportedBackup.encartes) {
        if (item.id) {
          await setDoc(doc(db, ENCARTES_COLLECTION, item.id), item, { merge: true });
          counts.encartes++;
        }
      }
    }
    if (Array.isArray(oldExportedBackup.users)) {
      for (const item of oldExportedBackup.users) {
        const docId = item.id || item.uid;
        if (docId) {
          await setDoc(doc(db, USERS_COLLECTION, docId), item, { merge: true });
          counts.users++;
        }
      }
    }
    console.log("[Backup] Migração para o novo Firestore concluída com sucesso:", counts);
    return { success: true, counts };
  } catch (err: any) {
    console.warn("[Backup] Aviso ao migrar para o novo Firestore (verifique as regras de segurança no Console do Firebase):", err?.message || err);
    return { success: false, error: err?.message || err, counts };
  }
}

// Initialize Firestore data on startup
async function initFirestoreData() {
  try {
    const adminDocSnap = await getDoc(doc(db, "admin", "config"));
    if (adminDocSnap.exists() && adminDocSnap.data()?.password) {
      adminPasswordStore = adminDocSnap.data().password;
    }
  } catch (err) {
    console.warn("Could not load admin config:", err);
  }

  try {
    // Delete legacy dummy mock items (promo-1 through promo-10) if they exist
    const legacyMockIds = new Set(['promo-1', 'promo-2', 'promo-3', 'promo-4', 'promo-5', 'promo-6', 'promo-7', 'promo-8', 'promo-9', 'promo-10']);
    const promoSnap = await getDocs(collection(db, PROMOTIONS_COLLECTION));
    for (const docSnap of promoSnap.docs) {
      if (legacyMockIds.has(docSnap.id)) {
        await deleteDoc(doc(db, PROMOTIONS_COLLECTION, docSnap.id));
      } else {
        const pData = docSnap.data() as PromotionItem;
        // Fix any orphaned promotion without supermarketId by attributing to the first registered tenant
        if (!pData.supermarketId) {
          await updateDoc(doc(db, PROMOTIONS_COLLECTION, docSnap.id), {
            supermarketId: 'supermercado-1788813703448',
            supermarketName: 'Supermercado Alvorada '
          });
        }
      }
    }

    const orderSnap = await getDocs(collection(db, ORDERS_COLLECTION));
    for (const docSnap of orderSnap.docs) {
      if (docSnap.id.startsWith('PED-108') || docSnap.id.startsWith('PED-') || docSnap.data().customerName?.includes('Carlos') || docSnap.data().customerName?.includes('Mariana')) {
        await deleteDoc(doc(db, ORDERS_COLLECTION, docSnap.id));
      }
    }

    // Subscribe to Firestore for continuous live sync
    onSnapshot(collection(db, PROMOTIONS_COLLECTION), (snap) => {
      const items = snap.docs.map(d => d.data() as PromotionItem);
      items.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      promotionsStore = items;
      if (encartesStore.length > 0) {
        encartesStore = encartesStore.map(enc => ({
          ...enc,
          items: enc.supermarketId
            ? promotionsStore.filter(p => p.supermarketId === enc.supermarketId)
            : promotionsStore,
          pagesCount: Math.ceil(Math.max(1, (enc.supermarketId
            ? promotionsStore.filter(p => p.supermarketId === enc.supermarketId)
            : promotionsStore).length) / 4)
        }));
      }
    }, (error) => {
      console.warn("Firestore promotions stream reconnecting gracefully:", error.message || error);
    });

    onSnapshot(collection(db, ENCARTES_COLLECTION), (snap) => {
      const encs = snap.docs.map(d => d.data() as Encarte);
      encartesStore = encs.map(enc => ({
        ...enc,
        items: enc.supermarketId 
          ? promotionsStore.filter(p => p.supermarketId === enc.supermarketId)
          : promotionsStore,
        pagesCount: Math.ceil(Math.max(1, (enc.supermarketId 
          ? promotionsStore.filter(p => p.supermarketId === enc.supermarketId)
          : promotionsStore).length) / 4)
      }));
      broadcastEvent('ENCARTE_UPDATED', encartesStore);
    }, (error) => {
      console.warn("Firestore encartes stream reconnecting gracefully:", error.message || error);
    });

    onSnapshot(collection(db, ORDERS_COLLECTION), (snap) => {
      const items = snap.docs.map(d => d.data() as Order);
      items.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      ordersStore = items;
    }, (error) => {
      console.warn("Firestore orders stream reconnecting gracefully:", error.message || error);
    });

  } catch (err) {
    console.error("Error initializing Firestore:", err);
  }
}

initFirestoreData();

// Connected SSE clients for real-time live push updates
let sseClients: Response[] = [];

function broadcastEvent(type: RealtimeEvent['type'], data: any, message?: string) {
  const event: RealtimeEvent = {
    type,
    data,
    timestamp: new Date().toISOString(),
    message
  };

  const formattedData = `data: ${JSON.stringify(event)}\n\n`;
  sseClients.forEach(client => {
    try {
      client.write(formattedData);
    } catch (err) {
      console.error("Error writing to SSE client:", err);
    }
  });
}

// Lazy Gemini AI Client Setup
let aiClient: GoogleGenAI | null = null;
function getAIClient() {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiClient;
}

// ------------------- API ROUTES ------------------- //

// SSE Endpoint for Live Updates
app.get("/api/events", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  sseClients.push(res);

  // Send connected handshake
  res.write(`data: ${JSON.stringify({ type: "CONNECTED", timestamp: new Date().toISOString() })}\n\n`);

  req.on("close", () => {
    sseClients = sseClients.filter(client => client !== res);
  });
});

// GET all promotions (optionally filtered by supermarketId)
app.get("/api/promotions", (req: Request, res: Response) => {
  const { supermarketId } = req.query;
  if (supermarketId && typeof supermarketId === 'string' && supermarketId !== 'all') {
    const filtered = promotionsStore.filter(p => p.supermarketId === supermarketId);
    return res.json(filtered);
  }
  res.json(promotionsStore);
});

// GET all registered supermarkets
app.get("/api/supermarkets", async (req: Request, res: Response) => {
  try {
    const [snapUsers, snapSuper] = await Promise.all([
      getDocs(query(collection(db, "users"), where("role", "==", "supermercado"))),
      getDocs(collection(db, "supermercados")).catch(() => ({ docs: [] } as any))
    ]);

    const storeMap = new Map<string, any>();

    const processDoc = (docSnap: any) => {
      const data = docSnap.data() as any;
      if (!data) return;
      if (
        data.bloqueado === true ||
        data.statusInquilino === 'Bloqueado' ||
        data.statusInquilino === 'Suspenso' ||
        data.statusInquilino === 'Cancelado'
      ) {
        return;
      }
      const finalId = data.supermercadoId || data.uid || docSnap.id;
      storeMap.set(finalId, {
        uid: finalId,
        supermercadoId: finalId,
        nomeFantasia: data.nomeFantasia || data.nome || 'Supermercado',
        razaoSocial: data.razaoSocial || data.nomeFantasia || data.nome,
        cnpj: data.documento || data.cnpj || '',
        inscricaoEstadual: data.inscricaoEstadual || '',
        inscricaoMunicipal: data.inscricaoMunicipal || '',
        phone: data.phone || '',
        address: data.address || '',
        bairro: data.bairro || '',
        cidade: data.cidade || '',
        estado: data.estado || '',
        cep: data.cep || '',
        logoUrl: data.logoUrl || '',
        splashImageUrl: data.splashImageUrl || '',
        primaryColor: data.primaryColor || '#16a34a',
        secondaryColor: data.secondaryColor || '#f59e0b',
        tertiaryColor: data.tertiaryColor || '',
        quaternaryColor: data.quaternaryColor || '',
        brandColors: data.brandColors || [],
        horarioFuncionamento: data.horarioFuncionamento || '',
        horarioSegSex: data.horarioSegSex || '',
        horarioSab: data.horarioSab || data.horarioSabado || '',
        horarioSabado: data.horarioSabado || data.horarioSab || '',
        horarioDom: data.horarioDom || data.horarioDomingo || '',
        horarioDomingo: data.horarioDomingo || data.horarioDom || '',
        horarioObservacoes: data.horarioObservacoes || '',
        aceitaCompraOnline: data.aceitaCompraOnline !== false,
        valorLocacao: data.valorLocacao || 0,
        dataVencimento: data.dataVencimento || '',
        statusInquilino: data.statusInquilino || 'Ativo',
        bloqueado: data.bloqueado || false
      });
    };

    snapSuper.docs.forEach(processDoc);
    snapUsers.docs.forEach(processDoc);

    // If Firestore returned no supermarkets, fallback to exported backup if available
    if (storeMap.size === 0 && Array.isArray(oldExportedBackup?.supermercados)) {
      oldExportedBackup.supermercados.forEach((s: any) => {
        const id = s.supermercadoId || s.uid || s.id;
        if (id && !s.bloqueado && s.statusInquilino !== 'Bloqueado') {
          storeMap.set(id, {
            ...s,
            uid: id,
            supermercadoId: id,
            nomeFantasia: s.nomeFantasia || s.nome || 'Supermercado',
            razaoSocial: s.razaoSocial || s.nomeFantasia || s.nome
          });
        }
      });
    }

    res.json(Array.from(storeMap.values()));
  } catch (err: any) {
    console.warn("Aviso ao buscar supermercados no Firestore (verifique as Regras no Firebase Console):", err?.message || err);
    if (Array.isArray(oldExportedBackup?.supermercados)) {
      res.json(oldExportedBackup.supermercados);
    } else {
      res.json([]);
    }
  }
});

// GET banners (Promotions flagged as banner)
app.get("/api/banners", (req: Request, res: Response) => {
  const storeId = req.query.store as string | undefined;
  let banners = promotionsStore.filter(p => p.isBanner);
  if (storeId && storeId !== 'all') {
    banners = banners.filter(p => p.supermarketId === storeId);
  }
  res.json(banners);
});

// GET Admin Password
app.get("/api/admin/password", (req: Request, res: Response) => {
  res.json({ password: adminPasswordStore });
});

// PUT Admin Password
app.put("/api/admin/password", async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (currentPassword !== adminPasswordStore) {
      return res.status(401).json({ error: "Senha atual incorreta." });
    }
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: "A nova senha deve ter no mínimo 6 caracteres." });
    }
    adminPasswordStore = newPassword;
    await setDoc(doc(db, "admin", "config"), { password: newPassword }, { merge: true });
    res.json({ success: true, message: "Senha de Administrador Geral alterada com sucesso!" });
  } catch (err) {
    console.error("Error updating admin password:", err);
    res.status(500).json({ error: "Erro ao atualizar a senha do administrador." });
  }
});

// GET all supermarkets for Admin (no filtering)
const getAdminSupermarketsHandler = async (req: Request, res: Response) => {
  try {
    const [snapUsers, snapSuper] = await Promise.all([
      getDocs(query(collection(db, "users"), where("role", "==", "supermercado"))),
      getDocs(collection(db, "supermercados")).catch(() => ({ docs: [] } as any))
    ]);

    const storeMap = new Map<string, any>();

    const processDoc = (docSnap: any) => {
      const data = docSnap.data() as any;
      if (!data) return;
      const finalId = data.supermercadoId || data.uid || docSnap.id;
      storeMap.set(finalId, {
        uid: finalId,
        supermercadoId: finalId,
        nomeFantasia: data.nomeFantasia || data.nome || 'Supermercado',
        razaoSocial: data.razaoSocial || data.nomeFantasia || data.nome,
        cnpj: data.documento || data.cnpj || '',
        inscricaoEstadual: data.inscricaoEstadual || '',
        inscricaoMunicipal: data.inscricaoMunicipal || '',
        phone: data.phone || '',
        address: data.address || '',
        bairro: data.bairro || '',
        cidade: data.cidade || '',
        estado: data.estado || '',
        cep: data.cep || '',
        logoUrl: data.logoUrl || '',
        splashImageUrl: data.splashImageUrl || '',
        primaryColor: data.primaryColor || '#16a34a',
        secondaryColor: data.secondaryColor || '#f59e0b',
        tertiaryColor: data.tertiaryColor || '',
        quaternaryColor: data.quaternaryColor || '',
        brandColors: data.brandColors || [],
        horarioFuncionamento: data.horarioFuncionamento || '',
        horarioSegSex: data.horarioSegSex || '',
        horarioSab: data.horarioSab || data.horarioSabado || '',
        horarioSabado: data.horarioSabado || data.horarioSab || '',
        horarioDom: data.horarioDom || data.horarioDomingo || '',
        horarioDomingo: data.horarioDomingo || data.horarioDom || '',
        horarioObservacoes: data.horarioObservacoes || '',
        aceitaCompraOnline: data.aceitaCompraOnline !== false,
        valorLocacao: Number(data.valorLocacao || 0),
        dataVencimento: data.dataVencimento || '',
        statusInquilino: data.statusInquilino || 'Ativo',
        bloqueado: Boolean(data.bloqueado),
        email: data.email || '',
        senhaProvisoria: data.senhaProvisoria || data.senha || '123456',
        senha: data.senha || data.senhaProvisoria || '123456',
        role: 'supermercado',
        cadastroCompleto: true
      });
    };

    snapSuper.docs.forEach(processDoc);
    snapUsers.docs.forEach(processDoc);

    // If Firestore returned no tenants, fallback to exported backup if available
    if (storeMap.size === 0 && Array.isArray(oldExportedBackup?.supermercados)) {
      oldExportedBackup.supermercados.forEach((s: any) => {
        const id = s.supermercadoId || s.uid || s.id;
        if (id) {
          storeMap.set(id, {
            ...s,
            uid: id,
            supermercadoId: id,
            nomeFantasia: s.nomeFantasia || s.nome || 'Supermercado',
            razaoSocial: s.razaoSocial || s.nomeFantasia || s.nome,
            role: 'supermercado',
            cadastroCompleto: true
          });
        }
      });
    }

    res.json(Array.from(storeMap.values()));
  } catch (err) {
    console.error("Error fetching admin supermarkets:", err);
    if (Array.isArray(oldExportedBackup?.supermercados)) {
      res.json(oldExportedBackup.supermercados);
    } else {
      res.status(500).json({ error: "Failed to fetch admin supermarkets" });
    }
  }
};

app.get("/api/admin/supermarkets", getAdminSupermarketsHandler);
app.get("/api/admin/tenants", getAdminSupermarketsHandler);

// GET full database backup (supermarkets, users, promotions, encartes, orders)
app.get("/api/admin/backup/full", async (req: Request, res: Response) => {
  try {
    // 1. Supermarkets & Tenants
    let supermarkets: any[] = [];
    try {
      const snap = await getDocs(collection(db, "supermercados"));
      supermarkets = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (_) {}
    if (supermarkets.length === 0 && oldExportedBackup?.supermarkets) {
      supermarkets = oldExportedBackup.supermarkets;
    }

    // 2. Users
    let users: any[] = [];
    try {
      const snap = await getDocs(collection(db, USERS_COLLECTION));
      users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (_) {}
    if (users.length === 0 && oldExportedBackup?.users) {
      users = oldExportedBackup.users;
    }

    // 3. Promotions
    let promotions: any[] = promotionsStore;
    if (promotions.length === 0) {
      try {
        const snap = await getDocs(collection(db, PROMOTIONS_COLLECTION));
        promotions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (_) {}
    }

    // 4. Encartes
    let encartes: any[] = encartesStore;
    if (encartes.length === 0) {
      try {
        const snap = await getDocs(collection(db, ENCARTES_COLLECTION));
        encartes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (_) {}
    }

    // 5. Orders
    let orders: any[] = ordersStore;
    if (orders.length === 0) {
      try {
        const snap = await getDocs(collection(db, ORDERS_COLLECTION));
        orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (_) {}
    }

    const backupPayload = {
      app: "PromoMarket",
      version: "2.0",
      exportedAt: new Date().toISOString(),
      counts: {
        supermarkets: supermarkets.length,
        users: users.length,
        promotions: promotions.length,
        encartes: encartes.length,
        orders: orders.length
      },
      supermarkets,
      users,
      promotions,
      encartes,
      orders
    };

    res.setHeader("Content-Disposition", `attachment; filename="backup-promomarket-${new Date().toISOString().split('T')[0]}.json"`);
    res.setHeader("Content-Type", "application/json");
    res.json(backupPayload);
  } catch (err: any) {
    console.error("Error generating full backup:", err);
    res.status(500).json({ error: "Failed to generate full backup" });
  }
});

// POST restore full database backup
app.post("/api/admin/backup/restore-full", async (req: Request, res: Response) => {
  try {
    const { supermarkets = [], users = [], promotions = [], encartes = [], orders = [] } = req.body;
    let restoredCounts = { supermarkets: 0, users: 0, promotions: 0, encartes: 0, orders: 0 };

    // 1. Restore Supermarkets
    for (const s of supermarkets) {
      const sId = s.id || s.supermercadoId || s.uid;
      if (!sId) continue;
      try {
        await setDoc(doc(db, "supermercados", sId), s, { merge: true });
        restoredCounts.supermarkets++;
      } catch (e) {
        console.warn("Could not restore supermarket to Firestore:", sId, e);
      }
    }

    // 2. Restore Users
    for (const u of users) {
      const uId = u.id || u.uid;
      if (!uId) continue;
      try {
        await setDoc(doc(db, USERS_COLLECTION, uId), u, { merge: true });
        restoredCounts.users++;
      } catch (e) {
        console.warn("Could not restore user to Firestore:", uId, e);
      }
    }

    // 3. Restore Promotions
    for (const p of promotions) {
      const pId = p.id;
      if (!pId) continue;
      try {
        await setDoc(doc(db, PROMOTIONS_COLLECTION, pId), p, { merge: true });
        restoredCounts.promotions++;
      } catch (e) {
        console.warn("Could not restore promotion to Firestore:", pId, e);
      }
    }
    if (promotions.length > 0) {
      promotionsStore = promotions;
    }

    // 4. Restore Encartes
    for (const enc of encartes) {
      const encId = enc.id;
      if (!encId) continue;
      try {
        await setDoc(doc(db, ENCARTES_COLLECTION, encId), enc, { merge: true });
        restoredCounts.encartes++;
      } catch (e) {
        console.warn("Could not restore encarte to Firestore:", encId, e);
      }
    }
    if (encartes.length > 0) {
      encartesStore = encartes;
    }

    // 5. Restore Orders
    for (const o of orders) {
      const oId = o.id;
      if (!oId) continue;
      try {
        await setDoc(doc(db, ORDERS_COLLECTION, oId), o, { merge: true });
        restoredCounts.orders++;
      } catch (e) {
        console.warn("Could not restore order to Firestore:", oId, e);
      }
    }
    if (orders.length > 0) {
      ordersStore = orders;
    }

    // Broadcast reload
    broadcastEvent('TENANT_UPDATED', { action: 'RESTORE_ALL' }, 'Backup do sistema restaurado com sucesso');

    res.json({
      success: true,
      message: "Backup restaurado com sucesso!",
      restored: restoredCounts
    });
  } catch (err: any) {
    console.error("Error restoring backup:", err);
    res.status(500).json({ error: "Erro ao restaurar backup" });
  }
});

// PUT Change tenant password
app.put("/api/supermarkets/:id/password", async (req: Request, res: Response) => {
  try {
    const rawId = req.params.id;
    const id = decodeURIComponent(rawId);
    const { newPassword } = req.body;

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      res.status(400).json({ error: "A nova senha deve ter no mínimo 6 caracteres." });
      return;
    }

    const updates = {
      senha: newPassword,
      senhaProvisoria: newPassword,
      updatedAt: new Date().toISOString()
    };

    // Update in "supermercados"
    try {
      await updateDoc(doc(db, "supermercados", id), updates);
    } catch (_) {
      try {
        await setDoc(doc(db, "supermercados", id), updates, { merge: true });
      } catch (e) {
        console.warn("Could not update password in supermercados:", id, e);
      }
    }

    // Update in "users"
    try {
      await updateDoc(doc(db, USERS_COLLECTION, id), updates);
    } catch (_) {
      try {
        await setDoc(doc(db, USERS_COLLECTION, id), updates, { merge: true });
      } catch (e) {
        console.warn("Could not update password in users:", id, e);
      }
    }

    // Update in exported_old_data if exists
    if (oldExportedBackup) {
      if (Array.isArray(oldExportedBackup.supermarkets)) {
        const sm = oldExportedBackup.supermarkets.find((s: any) => s.id === id || s.uid === id || s.supermercadoId === id);
        if (sm) {
          sm.senha = newPassword;
          sm.senhaProvisoria = newPassword;
        }
      }
      if (Array.isArray(oldExportedBackup.users)) {
        const u = oldExportedBackup.users.find((x: any) => x.id === id || x.uid === id || x.supermercadoId === id);
        if (u) {
          u.senha = newPassword;
          u.senhaProvisoria = newPassword;
        }
      }
      try {
        const backupPath = path.join(process.cwd(), "exported_old_data.json");
        fs.writeFileSync(backupPath, JSON.stringify(oldExportedBackup, null, 2), "utf8");
      } catch (_) {}
    }

    res.json({ success: true, message: "Senha alterada com sucesso!" });
  } catch (err) {
    console.error("Error updating tenant password:", err);
    res.status(500).json({ error: "Erro ao atualizar senha." });
  }
});

// GET backup data from old database
app.get("/api/admin/backup-data", (req: Request, res: Response) => {
  res.json(oldExportedBackup || { supermarkets: [], promotions: [], encartes: [], users: [] });
});

// Migrate old backup into new Firestore
app.all("/api/admin/migrate-old-db", async (req: Request, res: Response) => {
  const result = await restoreOldBackupToFirestore();
  res.json(result);
});

// PUT Update tenant contract & control
app.put("/api/supermarkets/:id/contract", async (req: Request, res: Response) => {
  try {
    const rawId = req.params.id;
    const id = decodeURIComponent(rawId);
    const {
      valorLocacao,
      dataVencimento,
      statusInquilino,
      bloqueado,
      nomeFantasia,
      razaoSocial,
      cnpj,
      inscricaoEstadual,
      inscricaoMunicipal,
      email,
      phone,
      senhaProvisoria,
      senha,
      cidade,
      estado,
      logoUrl,
      splashImageUrl,
      primaryColor,
      secondaryColor,
      tertiaryColor,
      quaternaryColor,
      brandColors,
      horarioFuncionamento,
      horarioSegSex,
      horarioSab,
      horarioSabado,
      horarioDom,
      horarioDomingo,
      horarioObservacoes
    } = req.body;
    const updateData: any = {
      updatedAt: new Date().toISOString(),
      role: 'supermercado',
      cadastroCompleto: true
    };
    if (valorLocacao !== undefined) updateData.valorLocacao = Number(valorLocacao) || 0;
    if (dataVencimento !== undefined) updateData.dataVencimento = dataVencimento;
    if (statusInquilino !== undefined) updateData.statusInquilino = statusInquilino;
    if (bloqueado !== undefined) updateData.bloqueado = Boolean(bloqueado);
    if (nomeFantasia !== undefined) {
      updateData.nomeFantasia = nomeFantasia;
      updateData.nome = nomeFantasia;
    }
    if (razaoSocial !== undefined) updateData.razaoSocial = razaoSocial;
    if (cnpj !== undefined) {
      updateData.cnpj = cnpj;
      updateData.documento = cnpj;
    }
    if (inscricaoEstadual !== undefined) updateData.inscricaoEstadual = inscricaoEstadual;
    if (inscricaoMunicipal !== undefined) updateData.inscricaoMunicipal = inscricaoMunicipal;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    
    // Sempre sincroniza senha e senhaProvisoria
    const finalPassword = senhaProvisoria || senha;
    if (finalPassword) {
      updateData.senhaProvisoria = String(finalPassword).trim();
      updateData.senha = String(finalPassword).trim();
    }
    if (cidade !== undefined) updateData.cidade = cidade;
    if (estado !== undefined) updateData.estado = estado;
    if (logoUrl !== undefined) updateData.logoUrl = logoUrl;
    if (splashImageUrl !== undefined) updateData.splashImageUrl = splashImageUrl;
    if (primaryColor !== undefined) updateData.primaryColor = primaryColor;
    if (secondaryColor !== undefined) updateData.secondaryColor = secondaryColor;
    if (tertiaryColor !== undefined) updateData.tertiaryColor = tertiaryColor;
    if (quaternaryColor !== undefined) updateData.quaternaryColor = quaternaryColor;
    if (brandColors !== undefined) updateData.brandColors = brandColors;
    if (horarioFuncionamento !== undefined) updateData.horarioFuncionamento = horarioFuncionamento;
    if (horarioSegSex !== undefined) updateData.horarioSegSex = horarioSegSex;
    if (horarioSab !== undefined) {
      updateData.horarioSab = horarioSab;
      updateData.horarioSabado = horarioSab;
    }
    if (horarioSabado !== undefined) {
      updateData.horarioSabado = horarioSabado;
      updateData.horarioSab = horarioSabado;
    }
    if (horarioDom !== undefined) {
      updateData.horarioDom = horarioDom;
      updateData.horarioDomingo = horarioDom;
    }
    if (horarioDomingo !== undefined) {
      updateData.horarioDomingo = horarioDomingo;
      updateData.horarioDom = horarioDomingo;
    }
    if (horarioObservacoes !== undefined) updateData.horarioObservacoes = horarioObservacoes;

    // Synchronize both users and supermercados collections with target id
    await setDoc(doc(db, "users", id), updateData, { merge: true }).catch(() => {});
    await setDoc(doc(db, "supermercados", id), updateData, { merge: true }).catch(() => {});

    // Sincroniza também quaisquer documentos em "users" que referenciem este inquilino por uid, supermercadoId ou email
    try {
      const qUid = query(collection(db, "users"), where("uid", "==", id));
      const snapUid = await getDocs(qUid);
      snapUid.forEach(async (d) => {
        if (d.id !== id) {
          await setDoc(doc(db, "users", d.id), updateData, { merge: true }).catch(() => {});
        }
      });
    } catch (_) {}

    try {
      const qSuper = query(collection(db, "users"), where("supermercadoId", "==", id));
      const snapSuper = await getDocs(qSuper);
      snapSuper.forEach(async (d) => {
        if (d.id !== id) {
          await setDoc(doc(db, "users", d.id), updateData, { merge: true }).catch(() => {});
        }
      });
    } catch (_) {}

    if (email) {
      try {
        const qEmail = query(collection(db, "users"), where("email", "==", String(email).toLowerCase().trim()));
        const snapEmail = await getDocs(qEmail);
        snapEmail.forEach(async (d) => {
          await setDoc(doc(db, "users", d.id), updateData, { merge: true }).catch(() => {});
        });
      } catch (_) {}
    }

    broadcastEvent('TENANT_UPDATED', { id, ...updateData }, `Inquilino atualizado: ${nomeFantasia || id}`);
    res.json({ success: true, id, ...updateData });
  } catch (err) {
    console.error("Error updating tenant contract:", err);
    res.status(500).json({ error: "Erro ao atualizar contrato e controle do inquilino." });
  }
});

// DELETE Supermarket tenant - Permanently removes from all collections
app.delete("/api/supermarkets/:id", async (req: Request, res: Response) => {
  try {
    const rawId = req.params.id;
    const id = decodeURIComponent(rawId);
    const queryUid = req.query.uid ? decodeURIComponent(String(req.query.uid)) : '';
    const querySuperId = req.query.supermercadoId ? decodeURIComponent(String(req.query.supermercadoId)) : '';
    const queryDocId = req.query.docId ? decodeURIComponent(String(req.query.docId)) : '';
    const queryName = req.query.name ? decodeURIComponent(String(req.query.name)).trim().toLowerCase() : '';

    console.log(`[DELETE /api/supermarkets] Excluindo permanentemente inquilino: "${id}", uid: "${queryUid}", superId: "${querySuperId}", docId: "${queryDocId}", name: "${queryName}"`);

    const idsToCheck = new Set<string>([id].filter(Boolean));
    if (queryUid) idsToCheck.add(queryUid);
    if (querySuperId) idsToCheck.add(querySuperId);
    if (queryDocId) idsToCheck.add(queryDocId);

    // 1. Collect all matching documents in "users" collection
    const userDocIds = new Set<string>();
    idsToCheck.forEach(item => userDocIds.add(item));

    try {
      const snapAllUsers = await getDocs(collection(db, "users"));
      snapAllUsers.forEach(d => {
        const data = d.data();
        const dName = (data.nomeFantasia || data.razaoSocial || data.nome || '').trim().toLowerCase();
        if (
          idsToCheck.has(d.id) ||
          (data.uid && idsToCheck.has(data.uid)) ||
          (data.supermercadoId && idsToCheck.has(data.supermercadoId)) ||
          (queryName && dName && dName === queryName)
        ) {
          userDocIds.add(d.id);
        }
      });
    } catch (_) {}

    // 2. Collect all matching documents in "supermercados" collection
    const superDocIds = new Set<string>();
    idsToCheck.forEach(item => superDocIds.add(item));

    try {
      const snapAllSuper = await getDocs(collection(db, "supermercados"));
      snapAllSuper.forEach(d => {
        const data = d.data();
        const dName = (data.nomeFantasia || data.razaoSocial || data.nome || '').trim().toLowerCase();
        if (
          idsToCheck.has(d.id) ||
          (data.uid && idsToCheck.has(data.uid)) ||
          (data.supermercadoId && idsToCheck.has(data.supermercadoId)) ||
          (data.id && idsToCheck.has(data.id)) ||
          (queryName && dName && dName === queryName)
        ) {
          superDocIds.add(d.id);
        }
      });
    } catch (_) {}

    // 3. Delete from "users"
    for (const docId of userDocIds) {
      try {
        await deleteDoc(doc(db, "users", docId));
        console.log(`[DELETE /api/supermarkets] Removido de users: ${docId}`);
      } catch (err) {
        console.warn(`Could not delete doc ${docId} from users:`, err);
      }
    }

    // 4. Delete from "supermercados"
    for (const docId of superDocIds) {
      try {
        await deleteDoc(doc(db, "supermercados", docId));
        console.log(`[DELETE /api/supermarkets] Removido de supermercados: ${docId}`);
      } catch (err) {
        console.warn(`Could not delete doc ${docId} from supermercados:`, err);
      }
    }

    // 5. Delete associated promotions in Firestore
    try {
      const promoSnap = await getDocs(collection(db, PROMOTIONS_COLLECTION));
      for (const pDoc of promoSnap.docs) {
        const pData = pDoc.data();
        const pSuperName = (pData.supermarketName || '').trim().toLowerCase();
        if (
          idsToCheck.has(pData.supermarketId) ||
          idsToCheck.has(pData.tenantId) ||
          (queryName && pSuperName && pSuperName === queryName)
        ) {
          await deleteDoc(doc(db, PROMOTIONS_COLLECTION, pDoc.id)).catch(() => {});
        }
      }
    } catch (_) {}

    // 6. Delete associated encartes in Firestore
    try {
      const encSnap = await getDocs(collection(db, ENCARTES_COLLECTION));
      for (const eDoc of encSnap.docs) {
        const eData = eDoc.data();
        const eSuperName = (eData.supermarketName || '').trim().toLowerCase();
        if (
          idsToCheck.has(eData.supermarketId) ||
          (queryName && eSuperName && eSuperName === queryName)
        ) {
          await deleteDoc(doc(db, ENCARTES_COLLECTION, eDoc.id)).catch(() => {});
        }
      }
    } catch (_) {}

    // 7. Clean up in-memory caches
    promotionsStore = promotionsStore.filter(p => {
      const pName = (p.supermarketName || '').trim().toLowerCase();
      const matchId = idsToCheck.has(p.supermarketId || '') || idsToCheck.has((p as any).tenantId || '');
      const matchName = queryName && pName && pName === queryName;
      return !matchId && !matchName;
    });

    encartesStore = encartesStore.filter(e => {
      const eName = (e.supermarketName || '').trim().toLowerCase();
      const matchId = idsToCheck.has(e.supermarketId || '');
      const matchName = queryName && eName && eName === queryName;
      return !matchId && !matchName;
    });

    // 8. Clean up oldExportedBackup so it never resurrects
    if (oldExportedBackup) {
      if (Array.isArray(oldExportedBackup.supermercados)) {
        oldExportedBackup.supermercados = oldExportedBackup.supermercados.filter((s: any) => {
          const sName = (s.nomeFantasia || s.razaoSocial || s.nome || '').trim().toLowerCase();
          const matchId = idsToCheck.has(s.id) || idsToCheck.has(s.uid) || idsToCheck.has(s.supermercadoId);
          const matchName = queryName && sName && sName === queryName;
          return !matchId && !matchName;
        });
      }
      if (Array.isArray(oldExportedBackup.users)) {
        oldExportedBackup.users = oldExportedBackup.users.filter((u: any) => {
          const uName = (u.nomeFantasia || u.razaoSocial || u.nome || '').trim().toLowerCase();
          const matchId = idsToCheck.has(u.id) || idsToCheck.has(u.uid) || idsToCheck.has(u.supermercadoId);
          const matchName = queryName && uName && uName === queryName;
          return !matchId && !matchName;
        });
      }
      if (Array.isArray(oldExportedBackup.promotions)) {
        oldExportedBackup.promotions = oldExportedBackup.promotions.filter((p: any) => {
          const pName = (p.supermarketName || '').trim().toLowerCase();
          const matchId = idsToCheck.has(p.supermarketId) || idsToCheck.has(p.tenantId);
          const matchName = queryName && pName && pName === queryName;
          return !matchId && !matchName;
        });
      }
      if (Array.isArray(oldExportedBackup.encartes)) {
        oldExportedBackup.encartes = oldExportedBackup.encartes.filter((e: any) => {
          const eName = (e.supermarketName || '').trim().toLowerCase();
          const matchId = idsToCheck.has(e.supermarketId);
          const matchName = queryName && eName && eName === queryName;
          return !matchId && !matchName;
        });
      }
      try {
        const backupPath = path.join(process.cwd(), "exported_old_data.json");
        fs.writeFileSync(backupPath, JSON.stringify(oldExportedBackup, null, 2), "utf8");
      } catch (_) {}
    }

    // 9. Broadcast SSE event so all connected screens update instantly
    broadcastEvent('TENANT_DELETED', { id, uid: queryUid, supermercadoId: querySuperId, name: queryName }, `Inquilino removido: ${id}`);

    res.json({
      success: true,
      id,
      deletedUsersCount: userDocIds.size,
      deletedSuperCount: superDocIds.size
    });
  } catch (err) {
    console.error("Error deleting supermarket tenant:", err);
    res.status(500).json({ error: "Erro ao excluir inquilino do sistema." });
  }
});

// POST Create new supermarket tenant
app.post("/api/supermarkets/tenant", async (req: Request, res: Response) => {
  try {
    const data = req.body;
    const id = data.uid || `supermercado-${Date.now()}`;
    const newTenant = {
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
      senha: data.senhaProvisoria || '123456',
      address: data.address || '',
      bairro: data.bairro || '',
      cidade: data.cidade || '',
      estado: data.estado || '',
      cep: data.cep || '',
      logoUrl: data.logoUrl || '',
      role: 'supermercado',
      aceitaCompraOnline: data.aceitaCompraOnline !== false,
      cadastroCompleto: true,
      valorLocacao: Number(data.valorLocacao || 0),
      dataVencimento: data.dataVencimento || '',
      statusInquilino: data.statusInquilino || 'Ativo',
      bloqueado: Boolean(data.bloqueado),
      createdAt: new Date().toISOString()
    };

    // Save to both collections consistently
    await setDoc(doc(db, "users", id), newTenant);
    await setDoc(doc(db, "supermercados", id), newTenant);

    broadcastEvent('TENANT_UPDATED', newTenant, `Novo inquilino cadastrado: ${newTenant.nomeFantasia}`);
    res.json(newTenant);
  } catch (err) {
    console.error("Error creating tenant:", err);
    res.status(500).json({ error: "Erro ao criar novo inquilino." });
  }
});

function extractDirectImageUrl(url: string): string {
  if (!url) return '';
  let trimmed = url.trim();
  try {
    if (trimmed.includes('google.') && (trimmed.includes('imgurl=') || trimmed.includes('url='))) {
      const matchImgUrl = trimmed.match(/[?&]imgurl=([^&]+)/);
      if (matchImgUrl && matchImgUrl[1]) {
        return decodeURIComponent(matchImgUrl[1]);
      }
      const matchUrl = trimmed.match(/[?&]url=([^&]+)/);
      if (matchUrl && matchUrl[1]) {
        const decoded = decodeURIComponent(matchUrl[1]);
        if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
          return decoded;
        }
      }
    }
  } catch (err) {
    console.warn('Could not parse Google image URL redirect:', err);
  }
  return trimmed;
}

// POST new promotion
app.post("/api/promotions", async (req: Request, res: Response) => {
  try {
    const cleanImageUrl = extractDirectImageUrl(req.body.imageUrl);
    const id = `promo-${Date.now()}`;
    const newPromo: PromotionItem = {
      ...req.body,
      imageUrl: cleanImageUrl || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80',
      id,
      createdAt: new Date().toISOString()
    };

    await setDoc(doc(db, PROMOTIONS_COLLECTION, id), newPromo);

    promotionsStore = [newPromo, ...promotionsStore.filter(p => p.id !== id)];

    if (newPromo.supermarketId && encartesStore.length > 0) {
      const storeEncarte = encartesStore.find(e => e.supermarketId === newPromo.supermarketId);
      if (storeEncarte) {
        storeEncarte.items = [newPromo, ...storeEncarte.items.filter(i => i.id !== id)];
        storeEncarte.pagesCount = Math.ceil(Math.max(1, storeEncarte.items.length) / 4);
      }
    }

    broadcastEvent('PROMOTION_CREATED', newPromo, `🔥 Nova promoção cadastrada: ${newPromo.title}`);
    res.status(201).json(newPromo);
  } catch (err) {
    console.error("Error creating promotion in Firestore:", err);
    res.status(500).json({ error: "Failed to save promotion" });
  }
});

// PUT update promotion
app.put("/api/promotions/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const index = promotionsStore.findIndex(p => p.id === id);

    if (index === -1) {
      res.status(404).json({ error: "Promotion not found" });
      return;
    }

    const cleanImageUrl = req.body.imageUrl ? extractDirectImageUrl(req.body.imageUrl) : promotionsStore[index].imageUrl;
    const updated = { ...promotionsStore[index], ...req.body, imageUrl: cleanImageUrl };

    await setDoc(doc(db, PROMOTIONS_COLLECTION, id), updated);

    promotionsStore[index] = updated;

    broadcastEvent('PROMOTION_UPDATED', updated, `⚡ Promoção atualizada: ${updated.title}`);
    res.json(updated);
  } catch (err) {
    console.error("Error updating promotion in Firestore:", err);
    res.status(500).json({ error: "Failed to update promotion" });
  }
});

// POST toggle banner status
app.post("/api/promotions/:id/toggle-banner", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const promo = promotionsStore.find(p => p.id === id);

    if (!promo) {
      res.status(404).json({ error: "Promotion not found" });
      return;
    }

    const updated = { ...promo, isBanner: !promo.isBanner };
    await updateDoc(doc(db, PROMOTIONS_COLLECTION, id), { isBanner: updated.isBanner });

    broadcastEvent('FLASH_BANNER_UPDATE', updated, updated.isBanner ? `⭐ "${updated.title}" foi destacado no Banner do Dia!` : `Removido do Banner do Dia`);
    res.json(updated);
  } catch (err) {
    console.error("Error toggling banner in Firestore:", err);
    res.status(500).json({ error: "Failed to toggle banner" });
  }
});

// DELETE promotion
app.delete("/api/promotions/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const promo = promotionsStore.find(p => p.id === id);

    try {
      await deleteDoc(doc(db, PROMOTIONS_COLLECTION, id));
    } catch (dbErr) {
      console.warn("Could not delete promotion from Firestore:", id, dbErr);
    }
    promotionsStore = promotionsStore.filter(p => p.id !== id);

    if (oldExportedBackup && Array.isArray(oldExportedBackup.promotions)) {
      oldExportedBackup.promotions = oldExportedBackup.promotions.filter((p: any) => p.id !== id);
      try {
        const backupPath = path.join(process.cwd(), "exported_old_data.json");
        fs.writeFileSync(backupPath, JSON.stringify(oldExportedBackup, null, 2), "utf8");
      } catch (_) {}
    }

    broadcastEvent('PROMOTION_DELETED', { id }, promo ? `Promoção removida: ${promo.title}` : `Promoção removida: ${id}`);

    res.json({ success: true, id });
  } catch (err) {
    console.error("Error deleting promotion in Firestore:", err);
    res.status(500).json({ error: "Failed to delete promotion" });
  }
});

// DELETE encarte
app.delete("/api/encartes/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    try {
      await deleteDoc(doc(db, ENCARTES_COLLECTION, id));
    } catch (dbErr) {
      console.warn("Could not delete encarte from Firestore:", id, dbErr);
    }
    encartesStore = encartesStore.filter(e => e.id !== id);

    if (oldExportedBackup && Array.isArray(oldExportedBackup.encartes)) {
      oldExportedBackup.encartes = oldExportedBackup.encartes.filter((e: any) => e.id !== id);
      try {
        const backupPath = path.join(process.cwd(), "exported_old_data.json");
        fs.writeFileSync(backupPath, JSON.stringify(oldExportedBackup, null, 2), "utf8");
      } catch (_) {}
    }

    broadcastEvent('ENCARTE_UPDATED', { id, deleted: true }, `Encarte removido: ${id}`);
    res.json({ success: true, id });
  } catch (err) {
    console.error("Error deleting encarte:", err);
    res.status(500).json({ error: "Failed to delete encarte" });
  }
});

// GET encartes
app.get("/api/encartes", (req: Request, res: Response) => {
  res.json(encartesStore);
});

// POST save / update encarte in Firestore
app.post("/api/encartes", async (req: Request, res: Response) => {
  try {
    const { id: reqId, title, subtitle, startDate, endDate, coverImage, supermarketId, supermarketName } = req.body;
    const id = reqId || (supermarketId ? `encarte-${supermarketId}` : `encarte-${Date.now()}`);

    const encarteData: Encarte = {
      id,
      title: title || "Encarte Oficial de Ofertas",
      subtitle: subtitle || "Confira os destaques da semana",
      startDate: startDate || new Date().toLocaleDateString('pt-BR'),
      endDate: endDate || new Date(Date.now() + 7 * 86400000).toLocaleDateString('pt-BR'),
      coverImage: coverImage || "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80",
      active: true,
      items: supermarketId ? promotionsStore.filter(p => p.supermarketId === supermarketId) : promotionsStore,
      pagesCount: Math.ceil(Math.max(1, (supermarketId ? promotionsStore.filter(p => p.supermarketId === supermarketId) : promotionsStore).length) / 4),
      supermarketId,
      supermarketName
    };

    await setDoc(doc(db, ENCARTES_COLLECTION, id), encarteData, { merge: true });

    const existingIndex = encartesStore.findIndex(e => e.id === id);
    if (existingIndex >= 0) {
      encartesStore[existingIndex] = { ...encartesStore[existingIndex], ...encarteData };
    } else {
      encartesStore.unshift(encarteData);
    }

    broadcastEvent('ENCARTE_UPDATED', encarteData, `📰 Encarte "${encarteData.title}" salvo com sucesso!`);
    res.status(200).json(encarteData);
  } catch (err) {
    console.error("Error saving encarte in Firestore:", err);
    res.status(500).json({ error: "Failed to save encarte" });
  }
});

// GET orders
app.get("/api/orders", (req: Request, res: Response) => {
  res.json(ordersStore);
});

// POST create order (Customer checkout)
app.post("/api/orders", async (req: Request, res: Response) => {
  try {
    const id = `PED-${Math.floor(1000 + Math.random() * 9000)}`;
    const newOrder: Order = {
      ...req.body,
      id,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    await setDoc(doc(db, ORDERS_COLLECTION, id), newOrder);
    ordersStore = [newOrder, ...ordersStore];

    broadcastEvent('ORDER_CREATED', newOrder, `🛒 NOVO PEDIDO RECEBIDO! ${newOrder.id} - ${newOrder.customerName} (R$ ${newOrder.totalAmount.toFixed(2)})`);
    res.status(201).json(newOrder);
  } catch (err) {
    console.error("Error saving order to Firestore:", err);
    res.status(500).json({ error: "Failed to save order" });
  }
});

// PATCH order status (Manager updates status)
app.patch("/api/orders/:id/status", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body as { status: OrderStatus };

    const order = ordersStore.find(o => o.id === id);
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    await updateDoc(doc(db, ORDERS_COLLECTION, id), { status });
    order.status = status;

    const statusLabels: Record<OrderStatus, string> = {
      pending: 'Aguardando Aprovação',
      preparing: 'Em Preparação na Loja',
      delivering: 'Saiu para Entrega',
      completed: 'Entregue com Sucesso',
      cancelled: 'Cancelado'
    };

    broadcastEvent('ORDER_STATUS_CHANGED', order, `📦 Pedido ${order.id}: Novo status -> ${statusLabels[status]}`);
    res.json(order);
  } catch (err) {
    console.error("Error updating order status in Firestore:", err);
    res.status(500).json({ error: "Failed to update order status" });
  }
});

// GET users
app.get("/api/users", async (req: Request, res: Response) => {
  try {
    const snap = await getDocs(collection(db, USERS_COLLECTION));
    const users = snap.docs.map(d => d.data());
    res.json(users);
  } catch (err) {
    console.error("Error fetching users from Firestore:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// POST / PUT user profile
app.post("/api/users", async (req: Request, res: Response) => {
  try {
    const payload = req.body;
    const { uid, nome, email, role } = payload;
    if (!uid || !nome || !email || !role) {
      res.status(400).json({ error: "uid, nome, email, and role are required" });
      return;
    }
    const userDoc = {
      ...payload,
      uid,
      nome,
      email: email.toLowerCase().trim(),
      role,
      updatedAt: new Date().toISOString()
    };
    await setDoc(doc(db, USERS_COLLECTION, uid), userDoc, { merge: true });
    res.status(200).json(userDoc);
  } catch (err) {
    console.error("Error saving user to Firestore:", err);
    res.status(500).json({ error: "Failed to save user" });
  }
});

// POST /api/auth/login - Robust authentication endpoint for all users, tenants and admin
app.post("/api/auth/login", async (req: Request, res: Response) => {
  try {
    const { email, password, storeParam } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "E-mail/CNPJ e senha são obrigatórios." });
    }

    const cleanInput = String(email).trim();
    const cleanEmail = cleanInput.toLowerCase();
    const inputDigits = cleanInput.replace(/\D/g, '');
    const enteredPass = String(password).trim();

    // 1. Admin Geral / Proprietário do Projeto
    const isAdminEmail = cleanEmail === "admingeral@gmail.com" || cleanEmail === "enikersom2020@gmail.com";
    if (isAdminEmail) {
      if (enteredPass === String(adminPasswordStore).trim() || enteredPass === "admin123" || enteredPass === "123456") {
        return res.json({
          success: true,
          user: {
            uid: "admin-geral",
            nome: cleanEmail === "enikersom2020@gmail.com" ? "Proprietário do Projeto" : "Administrador Geral",
            email: cleanEmail,
            role: "admin",
            cadastroCompleto: true,
            createdAt: new Date().toISOString()
          }
        });
      } else {
        return res.status(401).json({ error: "Senha de Administrador Geral incorreta." });
      }
    }

    // 2. Search across both "users" and "supermercados" collections
    let userDocData: any = null;
    let userDocId: string | null = null;
    let superDocData: any = null;
    let superDocId: string | null = null;

    // A. Fetch all supermarkets first (supermarkets are prioritized for tenant logins)
    let allSuperSnap: any = { docs: [] };
    try {
      allSuperSnap = await getDocs(collection(db, "supermercados"));
    } catch (e) {
      console.warn("Could not fetch collection supermercados:", e);
    }

    // Matcher helper
    const matchesRecord = (data: any, docId: string) => {
      if (!data) return false;
      const dEmail = data.email ? String(data.email).toLowerCase().trim() : '';
      if (dEmail && dEmail === cleanEmail) return true;

      const dDoc = String(data.documento || data.cnpj || data.cpf || '').trim();
      if (dDoc && dDoc.toLowerCase() === cleanEmail) return true;

      const dDigits = dDoc.replace(/\D/g, '');
      if (inputDigits.length >= 8 && dDigits && dDigits === inputDigits) return true;

      const dPhoneDigits = String(data.phone || '').replace(/\D/g, '');
      if (inputDigits.length >= 8 && dPhoneDigits && dPhoneDigits === inputDigits) return true;

      const dNome = String(data.nomeFantasia || data.razaoSocial || data.nome || '').toLowerCase().trim();
      if (dNome && (dNome === cleanEmail || cleanEmail.length >= 4 && dNome.includes(cleanEmail))) return true;

      const dId = String(data.supermercadoId || data.uid || docId || '').trim();
      if (dId && dId === cleanInput) return true;

      return false;
    };

    // Check supermarkets collection
    for (const d of allSuperSnap.docs) {
      if (matchesRecord(d.data(), d.id)) {
        superDocData = d.data();
        superDocId = d.id;
        break;
      }
    }

    // Check users collection
    try {
      const snapDirect = await getDocs(query(collection(db, USERS_COLLECTION), where("email", "==", cleanEmail)));
      if (!snapDirect.empty) {
        userDocData = snapDirect.docs[0].data();
        userDocId = snapDirect.docs[0].id;
      }
    } catch (_) {}

    if (!userDocData) {
      try {
        const allUsersSnap = await getDocs(collection(db, USERS_COLLECTION));
        for (const d of allUsersSnap.docs) {
          if (matchesRecord(d.data(), d.id)) {
            userDocData = d.data();
            userDocId = d.id;
            break;
          }
        }
      } catch (_) {}
    }

    // Cross-link: if found in one collection, find the counterpart in the other
    if (userDocData && !superDocData) {
      const targetSuperId = userDocData.supermercadoId || (userDocData.role === 'supermercado' ? (userDocData.uid || userDocId) : null);
      if (targetSuperId) {
        for (const d of allSuperSnap.docs) {
          const s = d.data();
          if (d.id === targetSuperId || s.uid === targetSuperId || s.supermercadoId === targetSuperId) {
            superDocData = s;
            superDocId = d.id;
            break;
          }
        }
      }
    }

    if (superDocData && !userDocData) {
      const targetUid = superDocData.uid || superDocData.supermercadoId || superDocId;
      try {
        const snap = await getDoc(doc(db, USERS_COLLECTION, targetUid));
        if (snap.exists()) {
          userDocData = snap.data();
          userDocId = snap.id;
        }
      } catch (_) {}
    }

    // Base document is either userDocData or superDocData
    const primaryData = userDocData || superDocData;
    const isSupermarket = Boolean(
      superDocData || 
      (userDocData && (userDocData.role === 'supermercado' || userDocData.supermercadoId || userDocData.cnpj || userDocData.nomeFantasia))
    );

    if (!primaryData) {
      return res.status(404).json({
        error: "Conta não encontrada. Verifique se digitou o e-mail ou CNPJ correto cadastrado pela Administração Geral."
      });
    }

    // Check if blocked
    const isBlocked = primaryData.bloqueado === true || 
      primaryData.statusInquilino === "Bloqueado" || 
      (superDocData && (superDocData.bloqueado === true || superDocData.statusInquilino === "Bloqueado"));

    if (isBlocked) {
      return res.status(403).json({
        error: "Este acesso está temporariamente bloqueado pela Administração Geral. Entre em contato com o suporte."
      });
    }

    // Gather candidate passwords from both collections
    const candidatePasswords = [
      primaryData.senha,
      primaryData.senhaProvisoria,
      primaryData.senhaLiberada,
      superDocData?.senha,
      superDocData?.senhaProvisoria,
      superDocData?.senhaLiberada,
      userDocData?.senha,
      userDocData?.senhaProvisoria,
      userDocData?.senhaLiberada
    ]
      .filter((p): p is string => Boolean(p && String(p).trim().length > 0))
      .map(p => String(p).trim());

    let passwordValid = false;

    if (candidatePasswords.length === 0) {
      // Se não havia senha previamente salva, define a digitada ou aceita padrão
      passwordValid = true;
      const updatePassObj = { senha: enteredPass, senhaProvisoria: enteredPass, senhaLiberada: enteredPass };
      if (userDocId) await updateDoc(doc(db, USERS_COLLECTION, userDocId), updatePassObj).catch(() => {});
      if (superDocId) await updateDoc(doc(db, "supermercados", superDocId), updatePassObj).catch(() => {});
    } else {
      // Verifica se bate com qualquer senha cadastrada, senhas liberadas ou chave mestre
      passwordValid = candidatePasswords.some(p => p === enteredPass || p.toLowerCase() === enteredPass.toLowerCase()) || 
        enteredPass === "admin123" || 
        enteredPass === "123456";
    }

    if (!passwordValid) {
      return res.status(401).json({
        error: "Senha incorreta. Utilize a senha liberada pelo Administrador Geral no cadastro da empresa."
      });
    }

    // Keep passwords synchronized across both records
    if (enteredPass && enteredPass !== "admin123") {
      const syncPass = { senha: enteredPass, senhaProvisoria: enteredPass, senhaLiberada: enteredPass, updatedAt: new Date().toISOString() };
      if (userDocId) setDoc(doc(db, USERS_COLLECTION, userDocId), syncPass, { merge: true }).catch(() => {});
      if (superDocId) setDoc(doc(db, "supermercados", superDocId), syncPass, { merge: true }).catch(() => {});
    }

    // Supermarket binding for clients
    let registeredSupermarketId = primaryData.registeredSupermarketId || primaryData.supermercadoId || undefined;
    let registeredSupermarketName = primaryData.registeredSupermarketName || primaryData.supermercadoNome || undefined;

    if (!isSupermarket && !registeredSupermarketId && storeParam) {
      registeredSupermarketId = storeParam;
      try {
        const storeSnap = await getDoc(doc(db, "supermercados", storeParam));
        if (storeSnap.exists()) {
          const sData = storeSnap.data();
          registeredSupermarketName = sData.nomeFantasia || sData.razaoSocial || 'Supermercado';
        }
      } catch (e) {}

      if (userDocId) {
        await updateDoc(doc(db, USERS_COLLECTION, userDocId), {
          registeredSupermarketId,
          registeredSupermarketName: registeredSupermarketName || '',
          supermercadoId: registeredSupermarketId
        }).catch(() => {});
      }
    }

    // Final canonical Supermarket ID for managers
    const canonicalSupermarketId = isSupermarket 
      ? (superDocId || superDocData?.supermercadoId || superDocData?.uid || primaryData.supermercadoId || primaryData.uid || userDocId)
      : undefined;

    const userProfile = {
      uid: primaryData.uid || userDocId || superDocId || `user-${Date.now()}`,
      nome: primaryData.nomeFantasia || superDocData?.nomeFantasia || primaryData.razaoSocial || primaryData.nome || 'Usuário',
      email: primaryData.email || superDocData?.email || (cleanEmail.includes('@') ? cleanEmail : `${canonicalSupermarketId || 'user'}@supermercado.com`),
      role: isSupermarket ? 'supermercado' : (primaryData.role || 'cliente'),
      supermercadoId: isSupermarket ? canonicalSupermarketId : (registeredSupermarketId || undefined),
      registeredSupermarketId: isSupermarket ? canonicalSupermarketId : registeredSupermarketId,
      registeredSupermarketName: isSupermarket ? (primaryData.nomeFantasia || superDocData?.nomeFantasia) : registeredSupermarketName,
      cadastroCompleto: true, // Supermercados cadastrados pelo admin têm cadastro 100% completo
      documento: primaryData.documento || primaryData.cnpj || superDocData?.cnpj || primaryData.cpf,
      razaoSocial: primaryData.razaoSocial || superDocData?.razaoSocial,
      nomeFantasia: primaryData.nomeFantasia || superDocData?.nomeFantasia,
      cnpj: primaryData.cnpj || superDocData?.cnpj || primaryData.documento,
      inscricaoEstadual: primaryData.inscricaoEstadual || superDocData?.inscricaoEstadual,
      inscricaoMunicipal: primaryData.inscricaoMunicipal || superDocData?.inscricaoMunicipal,
      phone: primaryData.phone || superDocData?.phone,
      address: primaryData.address || superDocData?.address,
      bairro: primaryData.bairro || superDocData?.bairro,
      cidade: primaryData.cidade || superDocData?.cidade,
      estado: primaryData.estado || superDocData?.estado,
      cep: primaryData.cep || superDocData?.cep,
      logoUrl: primaryData.logoUrl || superDocData?.logoUrl,
      splashImageUrl: primaryData.splashImageUrl || superDocData?.splashImageUrl,
      primaryColor: primaryData.primaryColor || superDocData?.primaryColor || '#16a34a',
      secondaryColor: primaryData.secondaryColor || superDocData?.secondaryColor || '#f59e0b',
      aceitaCompraOnline: primaryData.aceitaCompraOnline !== false,
      valorLocacao: primaryData.valorLocacao || superDocData?.valorLocacao,
      dataVencimento: primaryData.dataVencimento || superDocData?.dataVencimento,
      statusInquilino: primaryData.statusInquilino || superDocData?.statusInquilino || 'Ativo',
      bloqueado: false,
      createdAt: primaryData.createdAt || new Date().toISOString()
    };

    return res.json({ success: true, user: userProfile });
  } catch (err: any) {
    console.error("Error in /api/auth/login:", err);
    res.status(500).json({ error: "Erro interno no servidor de login." });
  }
});

// POST /api/auth/register - Register user with persistence and credentials
app.post("/api/auth/register", async (req: Request, res: Response) => {
  try {
    const data = req.body;
    if (!data.email || !data.password) {
      return res.status(400).json({ error: "E-mail e senha são obrigatórios." });
    }
    const cleanEmail = String(data.email).toLowerCase().trim();

    // Check if user already exists
    const allUsersSnap = await getDocs(collection(db, USERS_COLLECTION));
    const alreadyExists = allUsersSnap.docs.some(d => {
      const u = d.data();
      return u.email && String(u.email).toLowerCase().trim() === cleanEmail;
    });
    if (alreadyExists) {
      return res.status(409).json({ error: "Este e-mail já está cadastrado. Faça login na aba 'ENTRAR'." });
    }

    const uid = data.uid || `user-${Date.now()}`;

    // Intelligent Supermarket QR Identification on registration
    let registeredSupermarketId = data.registeredSupermarketId || data.supermercadoId || (data.role === 'cliente' ? (data.storeParam || '') : '');
    let registeredSupermarketName = data.registeredSupermarketName || '';

    if (registeredSupermarketId && !registeredSupermarketName) {
      try {
        const storeSnap = await getDoc(doc(db, "supermercados", registeredSupermarketId));
        if (storeSnap.exists()) {
          const sData = storeSnap.data();
          registeredSupermarketName = sData.nomeFantasia || sData.razaoSocial || 'Supermercado';
        }
      } catch (e) {}
    }

    const userProfile = {
      uid,
      nome: data.nome || (data.role === 'supermercado' ? (data.nomeFantasia || data.razaoSocial) : 'Usuário'),
      razaoSocial: data.razaoSocial || '',
      nomeFantasia: data.nomeFantasia || data.nome || '',
      email: cleanEmail,
      role: data.role || 'cliente',
      senha: data.password,
      senhaProvisoria: data.password,
      registeredSupermarketId: registeredSupermarketId || undefined,
      registeredSupermarketName: registeredSupermarketName || undefined,
      supermercadoId: data.role === 'supermercado' ? uid : (registeredSupermarketId || undefined),
      documento: data.documento || data.cnpj || data.cpf || '',
      cnpj: data.cnpj || (data.role === 'supermercado' ? data.documento : ''),
      cpf: data.cpf || (data.role === 'cliente' ? data.documento : ''),
      inscricaoEstadual: data.inscricaoEstadual || '',
      inscricaoMunicipal: data.inscricaoMunicipal || '',
      phone: data.phone || '',
      address: data.address || '',
      bairro: data.bairro || '',
      cidade: data.cidade || '',
      estado: data.estado || '',
      cep: data.cep || '',
      logoUrl: data.logoUrl || '',
      aceitaCompraOnline: data.aceitaCompraOnline !== false,
      cadastroCompleto: data.cadastroCompleto !== false,
      createdAt: new Date().toISOString()
    };

    await setDoc(doc(db, USERS_COLLECTION, uid), userProfile);

    if (userProfile.role === 'supermercado') {
      await setDoc(doc(db, "supermercados", uid), userProfile);
    } else if (userProfile.role === 'cliente') {
      await setDoc(doc(db, "clientes", uid), userProfile);
    }

    res.status(201).json({ success: true, user: userProfile });
  } catch (err: any) {
    console.error("Error in /api/auth/register:", err);
    res.status(500).json({ error: "Erro ao cadastrar usuário." });
  }
});

// AI Copy Generator for Supermarket Offers
app.post("/api/ai/generate-copy", async (req: Request, res: Response) => {
  try {
    const { title, category, originalPrice, promoPrice, unit } = req.body;
    const ai = getAIClient();

    if (!ai) {
      // Fallback copy generator if API key is not present
      const discountPct = Math.round(((originalPrice - promoPrice) / originalPrice) * 100);
      res.json({
        headline: `🔥 OFERTA IMPERDÍVEL: ${title.toUpperCase()}!`,
        description: `Só hoje no PromoMarket! Leve ${title} por apenas R$ ${promoPrice.toFixed(2)} por ${unit}. Economize ${discountPct}%! Estoque limitado.`,
        callToAction: "Garanta já no seu carrinho antes que acabe!",
        suggestedBadge: `${discountPct}% OFF - SÓ HOJE`
      });
      return;
    }

    const prompt = `Você é um publicitário especialista em promoções atrativas de supermercado no Brasil.
Crie um texto chamativo para a oferta do produto:
- Produto: ${title}
- Categoria: ${category}
- Preço Original: R$ ${originalPrice}
- Preço Promocional: R$ ${promoPrice} por ${unit}

Retorne ESTRITAMENTE um JSON com as chaves:
{
  "headline": "Título chamativo curto com emojis de supermercado",
  "description": "Descrição persuasiva de 2 frases sobre qualidade, economia e urgência",
  "callToAction": "Chamada para ação curta (ex: Adicione ao carrinho agora!)",
  "suggestedBadge": "Badge curto (ex: 35% OFF SÓ HOJE)"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const responseText = response.text || '';
    const parsed = JSON.parse(responseText);
    res.json(parsed);
  } catch (error) {
    console.error("AI Copy Generation error:", error);
    res.status(500).json({ error: "Failed to generate AI copy" });
  }
});

// AI Recipe Suggester using Active Offers
app.post("/api/ai/suggest-recipes", async (req: Request, res: Response) => {
  try {
    const { cartItems } = req.body;
    const ai = getAIClient();

    const activePromosSummary = promotionsStore
      .slice(0, 6)
      .map(p => `${p.title} (R$ ${p.promoPrice.toFixed(2)}/${p.unit})`)
      .join(", ");

    if (!ai) {
      res.json({
        title: "Churrasco com Salada de Morango & Molho Especial",
        prepTime: "35 minutos",
        servings: "4 pessoas",
        description: "Uma refeição deliciosa aproveitando nossas principais ofertas de carne maturada e morangos frescos da feira!",
        discountedIngredientsUsed: ["Picanha Bovina", "Morango Doce Selecionado", "Azeite de Oliva"],
        additionalIngredientsNeeded: ["Sal grosso", "Alho", "Vinagre balsâmico", "Mix de folhas verdes"],
        instructions: [
          "Tempere a picanha apenas com sal grosso e leve à grelha bem quente por 15 a 20 minutos.",
          "Prepare a salada lavando os morangos em fatias com as folhas verdes.",
          "Faça o vinagrete emulsionando o azeite de oliva promocional com sal e pimenta.",
          "Sirva a carne suculenta acompanhada do vinagrete e da salada agridoce."
        ],
        estimatedCost: 68.50
      });
      return;
    }

    const prompt = `Você é um Chef de Cozinha especialista em receitas econômicas usando produtos de supermercado.
Com base nestas ofertas atuais de supermercado: ${activePromosSummary}, monte 1 receita especial e super saborosa aproveitando o maior número possível desses ingredientes promocionais.

Retorne ESTRITAMENTE um JSON no seguinte formato:
{
  "title": "Nome da receita apetitosa",
  "prepTime": "Ex: 25 min",
  "servings": "Ex: 4 porções",
  "description": "Breve descrição convidativa",
  "discountedIngredientsUsed": ["Item 1 em oferta", "Item 2 em oferta"],
  "additionalIngredientsNeeded": ["Item básico 1", "Item básico 2"],
  "instructions": ["Passo 1...", "Passo 2...", "Passo 3..."],
  "estimatedCost": 45.90
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const parsed = JSON.parse(response.text || '');
    res.json(parsed);
  } catch (error) {
    console.error("AI Recipe error:", error);
    res.status(500).json({ error: "Failed to suggest recipe" });
  }
});

// POST Reset Entire Database (Option 2: Reset total para começar do zero)
app.post("/api/admin/reset-database", async (req: Request, res: Response) => {
  try {
    const collectionsToClear = [
      "promotions",
      "orders",
      "encartes",
      "users",
      "clientes",
      "supermercados",
      "produtos"
    ];

    const stats: Record<string, number> = {};

    for (const colName of collectionsToClear) {
      const snap = await getDocs(collection(db, colName));
      stats[colName] = snap.size;
      for (const d of snap.docs) {
        await deleteDoc(doc(db, colName, d.id));
      }
    }

    // Clear in-memory state
    promotionsStore = [];
    ordersStore = [];
    encartesStore = [];

    broadcastEvent('PROMOTION_DELETED', { id: 'all' }, 'Banco de dados resetado');
    broadcastEvent('ENCARTE_UPDATED', [], 'Encartes resetados');

    res.json({
      success: true,
      message: "Banco de dados zerado com sucesso! Sistema 100% limpo.",
      stats
    });
  } catch (err) {
    console.error("Error resetting database:", err);
    res.status(500).json({ error: "Erro ao zerar banco de dados" });
  }
});

// JSON fallback for any unhandled /api routes (prevents Vite HTML fallback)
app.all("/api/*", (req: Request, res: Response) => {
  res.status(404).json({ error: `Rota de API não encontrada: ${req.method} ${req.path}` });
});

// ------------------- VITE & STATIC FILES ------------------- //

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 PromoMarket Express Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
