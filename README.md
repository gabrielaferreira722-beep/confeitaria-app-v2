# Sistema de Precificação — Confeitaria

MVP funcional para uso interno na loja. Fluxo: **nota fiscal (entrada manual) → ingredientes → receitas → cálculo de custo → preço sugerido por canal**. 100% gratuito para rodar — sem custo de API de IA.

## 1. Pré-requisitos

- Node.js 18 ou superior
- Uma conta no [Supabase](https://supabase.com) (plano gratuito)

## 2. Configurar o Supabase

1. Crie um projeto novo no Supabase.
2. Vá em **SQL Editor** e rode o conteúdo do arquivo `supabase/schema.sql` deste projeto. Isso cria as tabelas de ingredientes, histórico de preço, receitas e canais (já com Presencial, iFood, 99Food e Keeta pré-cadastrados com comissão 0% — ajuste depois na tela de Precificação).
3. Em **Project Settings → API Keys → aba "Legacy anon, service_role API keys"**, copie a `Project URL` e a `anon public key`.

## 3. Configurar o projeto

```bash
cp .env.local.example .env.local
```

Preencha o `.env.local` com `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` (do passo 2).

## 4. Rodar localmente

```bash
npm install
npm run dev
```

Abra `http://localhost:3000` — funciona tanto no computador quanto no celular (layout responsivo).

## 5. Colocar no ar (opcional)

Publique na [Vercel](https://vercel.com) (gratuita): conecte o repositório, cole as mesmas 2 variáveis de ambiente do `.env.local` no painel da Vercel, e o deploy é automático.

## O que este MVP faz

- **Ingredientes**: cadastro com cálculo automático de custo por grama/ml/unidade e histórico de preço.
- **Nota fiscal**: tela de entrada manual dos itens comprados — cria ingredientes novos ou atualiza o preço dos existentes.
- **Receitas**: monta o produto a partir dos ingredientes cadastrados, calcula custo total e por unidade.
- **Precificação**: margem desejada configurável, custos de gás/energia/mão de obra por unidade, comissão e taxa fixa editáveis por canal (Presencial, iFood, 99Food, Keeta), com preço sugerido, lucro líquido e margem real.
- **Assistente**: responde um conjunto fixo de perguntas (menor lucro, preço no iFood, se está cobrando barato) com base nos dados reais cadastrados — sem custo de IA.

## O que fica fora do escopo (de propósito)

Controle de estoque, emissão fiscal, leitura automática de nota por foto/OCR, assistente de IA em linguagem livre, múltiplos usuários/permissões, relatórios avançados. Este é um MVP para calcular preço corretamente — não um ERP.

Se no futuro você quiser reativar a leitura automática de nota fiscal por foto ou um assistente de IA que responde qualquer pergunta, isso volta a exigir uma chave da API da Anthropic (paga por uso) — é só pedir.
