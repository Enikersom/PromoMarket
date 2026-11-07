const { initializeApp } = require("firebase/app");
const { initializeFirestore, collection, getDocs } = require("firebase/firestore");
const fs = require("fs");

const oldConfig = {
  projectId: "graphical-dreamlet-14dh4",
  appId: "1:565945201741:web:9539a505483f4781abd804",
  apiKey: "AIzaSyBJ7U9_CbAZfacSc2KRnnWiu-QT69Jj0Ic",
  authDomain: "graphical-dreamlet-14dh4.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-promomarketpromo-9a93172e-0344-4f26-8b22-a6194a16e5f0"
};

const oldApp = initializeApp(oldConfig, "exportApp");
const oldDb = initializeFirestore(oldApp, { experimentalAutoDetectLongPolling: true }, oldConfig.firestoreDatabaseId);

const collections = [
  "promotions",
  "supermercados",
  "users",
  "encartes",
  "orders",
  "clientes",
  "produtos",
  "admin",
  "settings",
  "banners"
];

async function exportAll() {
  const result = {};
  for (const col of collections) {
    try {
      const snap = await getDocs(collection(oldDb, col));
      result[col] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      console.log(`Exportado '${col}': ${result[col].length} itens.`);
    } catch (e) {
      console.error(`Erro ao exportar '${col}':`, e.message);
      result[col] = [];
    }
  }

  fs.writeFileSync("./exported_old_data.json", JSON.stringify(result, null, 2), "utf8");
  console.log("\nDados salvos com sucesso em 'exported_old_data.json'!");
  process.exit(0);
}

exportAll();
