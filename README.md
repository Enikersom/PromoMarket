# PromoMarket - Plataforma Multi-supermercados e Ofertas em Tempo Real

Plataforma completa de promoções de supermercados em tempo real, integrando painel administrativo geral, painel do gestor de loja e aplicativo do cliente com identificação inteligente por QR Code.

---

## 🚀 Tecnologias Utilizadas

- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide React, Motion
- **Backend / Servidor**: Node.js, Express, Server-Sent Events (SSE), Google GenAI SDK (Gemini)
- **Banco de Dados & Autenticação**: Firebase Firestore e Firebase Authentication
- **Build Tools**: Vite 6, esbuild, tsx

---

## 📦 Como Rodar Localmente

### 1. Clonar o repositório e instalar as dependências
```bash
git clone <URL_DO_REPOSITORIO>
cd <PASTA_DO_PROJETO>
npm install
```

### 2. Configuração de Variáveis de Ambiente
Crie um arquivo `.env` na raiz do projeto (baseado em `.env.example`):
```env
GEMINI_API_KEY="sua_chave_gemini_aqui"
```

### 3. Iniciar o Servidor de Desenvolvimento
```bash
npm run dev
```
O aplicativo iniciará na porta `3000` (http://localhost:3000).

---

## 🏗️ Comandos de Build

- **Build Completo (Full-Stack: Frontend + Servidor Express)**:
  ```bash
  npm run build
  ```
  Gera os arquivos estáticos em `dist/` e o servidor empacotado em `dist/server.cjs`.

- **Execução em Produção (Full-Stack)**:
  ```bash
  npm start
  ```
  Inicia o servidor Node.js de produção (`node dist/server.cjs`).

- **Build apenas Frontend (Static SPA)**:
  ```bash
  npm run build:client
  ```

---

## 🌐 Guia de Publicação (Deploy)

### ⚠️ Entendendo a Arquitetura da Aplicação
Este projeto é **Full-Stack**, possuindo um servidor Node.js/Express (`server.ts`) responsável por:
1. Sincronização em tempo real via **Server-Sent Events (SSE)** em `/api/events`
2. Criação automática de textos promocionais via **Gemini AI** em `/api/generate-description`
3. APIs centralizadas de promoções, encartes, pedidos e autenticação

---

### Opção A: Hospedagem Full-Stack (Recomendada)
Para rodar tanto o Frontend quanto o Backend com suporte a todas as funcionalidades:
- **Plataformas**: [Render](https://render.com), [Railway](https://railway.app), [Fly.io](https://fly.io), [Cloud Run](https://cloud.google.com/run) ou VPS.
- **Configurações**:
  - **Build Command**: `npm run build`
  - **Start Command**: `npm start`
  - **Porta**: `3000` (ou variável de ambiente `PORT` fornecida pelo provedor)
  - **Variáveis de Ambiente**: Defina `GEMINI_API_KEY` nas configurações da plataforma.

---

### Opção B: Publicação no Netlify
O **Netlify** é primariamente uma plataforma para sites estáticos (JAMstack) e funções serverless:

1. **Configuração já incluída no projeto**:
   - Foi criado o arquivo `public/_redirects` com `/* /index.html 200` para garantir o roteamento SPA sem erro 404 ao atualizar a página.
   - Foi criado o arquivo `netlify.toml` com as diretivas de build.
2. **Ao conectar o repositório do GitHub no Netlify**:
   - **Base directory**: (deixe em branco)
   - **Build command**: `npm run build` (ou `npm run build:client`)
   - **Publish directory**: `dist`
3. **Atenção sobre as rotas `/api/*`**:
   - Como o Netlify por padrão hospeda apenas arquivos estáticos do frontend, para usar as chamadas de backend `/api/*` no Netlify, você pode:
     - Hospedar o backend em um serviço como Render/Railway e adicionar no `public/_redirects`:
       ```
       /api/*   https://seu-backend.onrender.com/api/:splat   200
       /*       /index.html                                   200
       ```
     - Ou utilizar a hospedagem full-stack completa recomendada na **Opção A**.

---

## 📤 Como Subir para o GitHub

Se ainda não inicializou o git no projeto:

```bash
git init
git add .
git commit -m "feat: initial commit - PromoMarket multi-supermercados"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
git push -u origin main
```
