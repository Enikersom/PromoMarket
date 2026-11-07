const { initializeApp, getApps } = require("firebase/app");
const { initializeFirestore, collection, getDocs, doc, setDoc } = require("firebase/firestore");

const oldConfig = {
  projectId: "graphical-dreamlet-14dh4",
  appId: "1:565945201741:web:9539a505483f4781abd804",
  apiKey: "AIzaSyBJ7U9_CbAZfacSc2KRnnWiu-QT69Jj0Ic",
  authDomain: "graphical-dreamlet-14dh4.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-promomarketpromo-9a93172e-0344-4f26-8b22-a6194a16e5f0"
};

const newConfig = {
  projectId: "promomarket-promocoes",
  appId: "1:531107145519:web:d41980cd477c0db89063da",
  apiKey: "AIzaSyA_9tJnChsqwg2QExMd6H241B8nsr1ksaI",
  authDomain: "promomarket-promocoes.firebaseapp.com",
  firestoreDatabaseId: "(default)"
};

const oldApp = initializeApp(oldConfig, "oldApp");
const oldDb = initializeFirestore(oldApp, { experimentalAutoDetectLongPolling: true }, oldConfig.firestoreDatabaseId);

const newApp = initializeApp(newConfig, "newApp");
const newDb = initializeFirestore(newApp, { experimentalAutoDetectLongPolling: true });

const collectionsToMigrate = [
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

async function runMigration() {
  console.log("=== INICIANDO MIGRAÇÃO DE DADOS ===");
  console.log("Origem: graphical-dreamlet-14dh4 (" + oldConfig.firestoreDatabaseId + ")");
  console.log("Destino: promomarket-promocoes ((default))");

  let totalMigrated = 0;

  for (const colName of collectionsToMigrate) {
    try {
      console.log(`\nConsultando coleção '${colName}'...`);
      const oldSnap = await getDocs(collection(oldDb, colName));
      console.log(`Encontrados ${oldSnap.docs.length} documento(s) em '${colName}'.`);

      for (const docSnap of oldSnap.docs) {
        const docId = docSnap.id;
        const data = docSnap.data();
        console.log(`   -> Copiando documento [${docId}]...`);
        await setDoc(doc(newDb, colName, docId), data);
        totalMigrated++;
      }
    } catch (err) {
      console.error(`Erro ao migrar coleção '${colName}':`, err.message);
    }
  }

  console.log(`\n=== MIGRAÇÃO CONCLUÍDA! Total de ${totalMigrated} documentos transferidos com sucesso! ===`);
  process.exit(0);
}

runMigration().catch((e) => {
  console.error("Falha na migração:", e);
  process.exit(1);
});
