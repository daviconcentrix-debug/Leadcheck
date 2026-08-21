# Parcela Justa

Funil de captação (tripwire) para revisão de juros e quitação de financiamento de veículos.

- Frontend: React + Vite
- API Bacen: serverless Vercel (`/api/bacen`)
- Pix: QR estático local (sem Mercado Pago)
- Leads: localStorage + exportação CSV para Google Sheets

## Zero custo

- API pública do Banco Central (SGS)
- Pix com a sua chave (sem gateway)
- Sem banco de dados pago

## Desenvolvimento local

```bash
npm install
npm run dev
```

A consulta Bacen em local sem a função `/api/bacen` usa o fallback em cache. No Vercel a API sobe automaticamente.

## Deploy no Vercel (recomendado)

1. Crie uma conta em [vercel.com](https://vercel.com)
2. **Import Project** → faça upload deste zip ou conecte o repositório Git
3. Framework preset: **Vite**
4. Build command: `npm run build`
5. Output directory: `dist`
6. Deploy

A pasta `api/bacen.ts` vira uma Serverless Function automaticamente.

### Via CLI

```bash
npm i -g vercel
vercel
```

## Deploy no Cloudflare Pages

1. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages**
2. Upload dos arquivos ou conecte o Git
3. Build command: `npm run build`
4. Output directory: `dist`

**Atenção:** a rota `/api/bacen` é específica do Vercel. No Cloudflare Pages puro, a consulta usa o fallback em cache. Para Bacen ao vivo no Cloudflare, crie um Worker que faça o proxy da API do Bacen e aponte o frontend para ele.

## Painel da equipe

Abra `/#backoffice` no site publicado.

Configure:

- Chave Pix real
- Nome e cidade do recebedor
- WhatsApp do especialista
- Valor do pré-laudo (padrão R$ 4,90)

Exporte o CSV e cole no Google Sheets. As fórmulas prontas estão no painel.

## Estrutura

```
api/bacen.ts          # Serverless Vercel — taxa média Bacen
src/App.tsx           # Funil + backoffice
src/lib/              # CPF, Pix, leads, settings, Bacen client
public/favicon.svg
vercel.json           # SPA rewrites
```

## Sprint 1 (implementado)

- Catálogo SGS veículos PF (25471 mensal + 20749 anual)
- Simulação: parcela se taxa = média Bacen + economia R$/%
- Score automático (quitação 100 / prestamista 70 / reduzir 40 + bônus)
- Fila do dia: pagos sem contato + botão Já falei
- Template WhatsApp por flag
- Pré-laudo em PDF (imprimir / salvar)
- Aviso LGPD na captura

## Autenticação do backoffice

1. No Vercel: **Settings → Environment Variables**
2. Crie `BACKOFFICE_PASSWORD` com uma senha forte
3. (Opcional) `BACKOFFICE_SECRET` para assinar o token
4. Redeploy
5. Acesse `/#backoffice` e entre com a senha

A senha **não** vai no bundle do frontend. O login chama `/api/auth`.

Local: defina `VITE_BACKOFFICE_DEV_PASSWORD` no `.env.local` (não versionar).

## Sprint 2

- Auth server-side do painel
- CET/TAEG aproximado na etapa Bacen e no PDF
- Validação de consistência séries mensal ↔ anual

## Sprint 3

- Data do contrato: chips de ano + selects Mês/Ano (mobile-friendly)
- PWA: manifest + service worker
- Webhook opcional no pagamento (n8n/Make/Sheets)
- Worker Cloudflare em `workers/bacen-worker.js`
- Proxy Bacen via `VITE_BACEN_PROXY`
