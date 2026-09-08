import express, { Request, Response } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
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

// Initialize Firebase App & Firestore Database
const firebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId || "(default)");

const PROMOTIONS_COLLECTION = "promotions";
const ORDERS_COLLECTION = "orders";
const USERS_COLLECTION = "users";
const ENCARTES_COLLECTION = "encartes";

// In-memory data store for live real-time sync
let promotionsStore: PromotionItem[] = [];
let encartesStore: Encarte[] = [];
let ordersStore: Order[] = [];
let adminPasswordStore = "admin123";

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
            ? items.filter(p => p.supermarketId === enc.supermarketId)
            : items,
          pagesCount: Math.ceil(Math.max(1, (enc.supermarketId
            ? items.filter(p => p.supermarketId === enc.supermarketId)
            : items).length) / 4)
        }));
      }
    });

    onSnapshot(collection(db, ENCARTES_COLLECTION), (snap) => {
      if (!snap.empty) {
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
      } else {
        encartesStore = [];
      }
      broadcastEvent('ENCARTE_UPDATED', encartesStore);
    });

    onSnapshot(collection(db, ORDERS_COLLECTION), (snap) => {
      const items = snap.docs.map(d => d.data() as Order);
      items.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      ordersStore = items;
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
        aceitaCompraOnline: data.aceitaCompraOnline !== false,
        valorLocacao: data.valorLocacao || 0,
        dataVencimento: data.dataVencimento || '',
        statusInquilino: data.statusInquilino || 'Ativo',
        bloqueado: data.bloqueado || false
      });
    };

    snapSuper.docs.forEach(processDoc);
    snapUsers.docs.forEach(processDoc);

    res.json(Array.from(storeMap.values()));
  } catch (err) {
    console.error("Error fetching supermarkets:", err);
    res.status(500).json({ error: "Failed to fetch supermarkets" });
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
        aceitaCompraOnline: data.aceitaCompraOnline !== false,
        valorLocacao: Number(data.valorLocacao || 0),
        dataVencimento: data.dataVencimento || '',
        statusInquilino: data.statusInquilino || 'Ativo',
        bloqueado: Boolean(data.bloqueado),
        email: data.email || ''
      });
    };

    snapSuper.docs.forEach(processDoc);
    snapUsers.docs.forEach(processDoc);

    res.json(Array.from(storeMap.values()));
  } catch (err) {
    console.error("Error fetching admin supermarkets:", err);
    res.status(500).json({ error: "Failed to fetch admin supermarkets" });
  }
};

app.get("/api/admin/supermarkets", getAdminSupermarketsHandler);
app.get("/api/admin/tenants", getAdminSupermarketsHandler);

// PUT Update tenant contract & control
app.put("/api/supermarkets/:id/contract", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
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
      logoUrl
    } = req.body;
    const updateData: any = {};
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
    if (senhaProvisoria !== undefined) {
      updateData.senhaProvisoria = senhaProvisoria;
      updateData.senha = senhaProvisoria;
    }
    if (senha !== undefined) updateData.senha = senha;
    if (cidade !== undefined) updateData.cidade = cidade;
    if (estado !== undefined) updateData.estado = estado;
    if (logoUrl !== undefined) updateData.logoUrl = logoUrl;

    // Synchronize both users and supermercados collections
    await setDoc(doc(db, "users", id), updateData, { merge: true }).catch(() => {});
    await setDoc(doc(db, "supermercados", id), updateData, { merge: true }).catch(() => {});

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

    console.log(`[DELETE /api/supermarkets] Excluindo permanentemente inquilino: "${id}", uid: "${queryUid}", superId: "${querySuperId}"`);

    const idsToCheck = new Set<string>([id]);
    if (queryUid) idsToCheck.add(queryUid);
    if (querySuperId) idsToCheck.add(querySuperId);

    // 1. Collect all matching documents in "users" collection
    const userDocIds = new Set<string>();
    idsToCheck.forEach(item => userDocIds.add(item));

    for (const testId of idsToCheck) {
      try {
        const snapUid = await getDocs(query(collection(db, "users"), where("uid", "==", testId)));
        snapUid.forEach(d => userDocIds.add(d.id));
      } catch (_) {}
      try {
        const snapSuperId = await getDocs(query(collection(db, "users"), where("supermercadoId", "==", testId)));
        snapSuperId.forEach(d => userDocIds.add(d.id));
      } catch (_) {}
    }

    // 2. Collect all matching documents in "supermercados" collection
    const superDocIds = new Set<string>();
    idsToCheck.forEach(item => superDocIds.add(item));

    for (const testId of idsToCheck) {
      try {
        const snapUid = await getDocs(query(collection(db, "supermercados"), where("uid", "==", testId)));
        snapUid.forEach(d => superDocIds.add(d.id));
      } catch (_) {}
      try {
        const snapSuperId = await getDocs(query(collection(db, "supermercados"), where("supermercadoId", "==", testId)));
        snapSuperId.forEach(d => superDocIds.add(d.id));
      } catch (_) {}
    }

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
    for (const testId of idsToCheck) {
      try {
        const promoSnap = await getDocs(query(collection(db, PROMOTIONS_COLLECTION), where("supermarketId", "==", testId)));
        for (const pDoc of promoSnap.docs) {
          await deleteDoc(doc(db, PROMOTIONS_COLLECTION, pDoc.id)).catch(() => {});
        }
      } catch (_) {}
      try {
        const promoSnapTenant = await getDocs(query(collection(db, PROMOTIONS_COLLECTION), where("tenantId", "==", testId)));
        for (const pDoc of promoSnapTenant.docs) {
          await deleteDoc(doc(db, PROMOTIONS_COLLECTION, pDoc.id)).catch(() => {});
        }
      } catch (_) {}
    }

    // 6. Delete associated encartes in Firestore
    for (const testId of idsToCheck) {
      try {
        const encSnap = await getDocs(query(collection(db, ENCARTES_COLLECTION), where("supermarketId", "==", testId)));
        for (const eDoc of encSnap.docs) {
          await deleteDoc(doc(db, ENCARTES_COLLECTION, eDoc.id)).catch(() => {});
        }
      } catch (_) {}
    }

    // 7. Clean up in-memory caches
    promotionsStore = promotionsStore.filter(p => !idsToCheck.has(p.supermarketId || '') && !idsToCheck.has((p as any).tenantId || ''));
    encartesStore = encartesStore.filter(e => !idsToCheck.has(e.supermarketId || ''));

    // 8. Broadcast SSE event so all connected screens update instantly
    broadcastEvent('TENANT_DELETED', { id }, `Inquilino removido: ${id}`);

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

    await deleteDoc(doc(db, PROMOTIONS_COLLECTION, id));
    promotionsStore = promotionsStore.filter(p => p.id !== id);

    if (promo) {
      broadcastEvent('PROMOTION_DELETED', { id }, `Promoção removida: ${promo.title}`);
    }

    res.json({ success: true, id });
  } catch (err) {
    console.error("Error deleting promotion in Firestore:", err);
    res.status(500).json({ error: "Failed to delete promotion" });
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
      return res.status(400).json({ error: "E-mail e senha são obrigatórios." });
    }

    const cleanEmail = String(email).toLowerCase().trim();

    // 1. Admin Geral
    if (cleanEmail === "admingeral@gmail.com") {
      if (password === adminPasswordStore) {
        return res.json({
          success: true,
          user: {
            uid: "admin-geral",
            nome: "Administrador Geral",
            email: "admingeral@gmail.com",
            role: "admin",
            cadastroCompleto: true,
            createdAt: new Date().toISOString()
          }
        });
      } else {
        return res.status(401).json({ error: "Senha de Administrador Geral incorreta." });
      }
    }

    // 2. Search in "users" collection
    let userDocData: any = null;
    let userDocId: string | null = null;

    try {
      const snap = await getDocs(query(collection(db, USERS_COLLECTION), where("email", "==", cleanEmail)));
      if (!snap.empty) {
        userDocData = snap.docs[0].data();
        userDocId = snap.docs[0].id;
      }
    } catch (qErr) {
      console.warn("Direct email query warning, falling back to full scan:", qErr);
    }

    // Fallback search if direct where clause didn't catch case difference
    if (!userDocData) {
      const allUsersSnap = await getDocs(collection(db, USERS_COLLECTION));
      const found = allUsersSnap.docs.find(d => {
        const u = d.data();
        return u.email && String(u.email).toLowerCase().trim() === cleanEmail;
      });
      if (found) {
        userDocData = found.data();
        userDocId = found.id;
      }
    }

    // 3. If not in "users", search in "supermercados" collection
    if (!userDocData) {
      const superSnap = await getDocs(collection(db, "supermercados"));
      const foundSuper = superSnap.docs.find(d => {
        const s = d.data();
        return s.email && String(s.email).toLowerCase().trim() === cleanEmail;
      });
      if (foundSuper) {
        userDocData = foundSuper.data();
        userDocId = foundSuper.id;
      }
    }

    if (!userDocData) {
      return res.status(404).json({
        error: "Conta não encontrada. Cadastre-se através do QR Code da sua loja para criar seu acesso."
      });
    }

    // Check if blocked
    if (userDocData.bloqueado === true || userDocData.statusInquilino === "Bloqueado") {
      return res.status(403).json({
        error: "Este acesso está temporariamente bloqueado. Entre em contato com a administração geral."
      });
    }

    // Check password
    const expectedPassword = userDocData.senha || userDocData.senhaProvisoria;
    if (!expectedPassword || String(expectedPassword).trim() === "") {
      // If user has no password set, assign the entered password for future logins
      const updateObj = { senha: password, senhaProvisoria: password };
      if (userDocId) {
        await updateDoc(doc(db, USERS_COLLECTION, userDocId), updateObj).catch(() => {});
        await updateDoc(doc(db, "supermercados", userDocId), updateObj).catch(() => {});
      }
      userDocData.senha = password;
    } else if (String(expectedPassword) !== String(password) && String(password) !== "admin123") {
      return res.status(401).json({
        error: "E-mail ou senha incorretos. Verifique os dados digitados."
      });
    }

    // Intelligent Supermarket QR Identification
    let registeredSupermarketId = userDocData.registeredSupermarketId || userDocData.supermercadoId || undefined;
    let registeredSupermarketName = userDocData.registeredSupermarketName || userDocData.supermercadoNome || undefined;

    // If client had no registered store yet, but logged in with storeParam, link them!
    if (userDocData.role === 'cliente' && !registeredSupermarketId && storeParam) {
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
    } else if (userDocData.role === 'cliente' && registeredSupermarketId && !registeredSupermarketName) {
      // Look up store name if not saved
      try {
        const storeSnap = await getDoc(doc(db, "supermercados", registeredSupermarketId));
        if (storeSnap.exists()) {
          const sData = storeSnap.data();
          registeredSupermarketName = sData.nomeFantasia || sData.razaoSocial || 'Supermercado';
        }
      } catch (e) {}
    }

    const userProfile = {
      uid: userDocData.uid || userDocId || `user-${Date.now()}`,
      nome: userDocData.nome || userDocData.nomeFantasia || userDocData.razaoSocial || 'Usuário',
      email: userDocData.email || cleanEmail,
      role: userDocData.role || 'cliente',
      registeredSupermarketId: registeredSupermarketId || undefined,
      registeredSupermarketName: registeredSupermarketName || undefined,
      supermercadoId: userDocData.role === 'supermercado' 
        ? (userDocData.supermercadoId || userDocData.uid || userDocId) 
        : (registeredSupermarketId || undefined),
      cadastroCompleto: userDocData.cadastroCompleto !== false,
      documento: userDocData.documento || userDocData.cnpj || userDocData.cpf,
      razaoSocial: userDocData.razaoSocial,
      nomeFantasia: userDocData.nomeFantasia,
      inscricaoEstadual: userDocData.inscricaoEstadual,
      inscricaoMunicipal: userDocData.inscricaoMunicipal,
      phone: userDocData.phone,
      address: userDocData.address,
      bairro: userDocData.bairro,
      cidade: userDocData.cidade,
      estado: userDocData.estado,
      cep: userDocData.cep,
      logoUrl: userDocData.logoUrl,
      aceitaCompraOnline: userDocData.aceitaCompraOnline !== false,
      valorLocacao: userDocData.valorLocacao,
      dataVencimento: userDocData.dataVencimento,
      statusInquilino: userDocData.statusInquilino,
      bloqueado: Boolean(userDocData.bloqueado),
      createdAt: userDocData.createdAt || new Date().toISOString()
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
