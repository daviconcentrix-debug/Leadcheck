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
