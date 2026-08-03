'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase-browser';
import { Channel, RecipeWithItems } from '@/lib/types';
import { formatBRL, netProfit, priceRecipeForChannels, recipeUnitCost, suggestedPrice } from '@/lib/calculations';

interface Message {
  role: 'user' | 'assistant';
  text: string;
}

const SUGESTOES = [
  'Qual produto está dando menos lucro?',
  'Quanto devo cobrar no iFood?',
  'Estou cobrando barato?',
];

async function loadData() {
  const [recipesRes, channelsRes] = await Promise.all([
    supabase.from('recipes').select('*, recipe_ingredients(*, ingredient:ingredients(*))'),
    supabase.from('channels').select('*'),
  ]);
  return {
    recipes: (recipesRes.data as unknown as RecipeWithItems[]) || [],
    channels: (channelsRes.data as Channel[]) || [],
  };
}

function answer(question: string, recipes: RecipeWithItems[], channels: Channel[]): string {
  if (recipes.length === 0) return 'Cadastre ao menos uma receita para eu poder calcular isso.';
  const lower = question.toLowerCase();

  if (lower.includes('lucro')) {
    let worst: { recipeName: string; channelName: string; profit: number } | null = null;
    recipes.forEach((recipe) => {
      const pricing = priceRecipeForChannels(recipe, channels);
      pricing.forEach((p) => {
        if (!worst || p.netProfit < worst.profit) {
          worst = { recipeName: recipe.name, channelName: p.channel.name, profit: p.netProfit };
        }
      });
    });
    if (!worst) return 'Não encontrei dados suficientes para calcular isso.';
    const w = worst as { recipeName: string; channelName: string; profit: number };
    return `O menor lucro líquido hoje é "${w.recipeName}" no canal ${w.channelName}, com ${formatBRL(
      w.profit
    )} por unidade.`;
  }

  if (lower.includes('ifood')) {
    const channel = channels.find((c) => c.key === 'ifood');
    if (!channel) return 'Não encontrei o canal iFood cadastrado.';
    const linhas = recipes.map((r) => {
      const unitCost = recipeUnitCost(r);
      const price = suggestedPrice(unitCost, channel, r.target_margin_pct);
      return `${r.name}: ${formatBRL(price)}`;
    });
    return `Preço sugerido no iFood (considerando comissão de ${channel.commission_pct}% e taxa fixa de ${formatBRL(
      channel.extra_fee
    )}):\n${linhas.join('\n')}`;
  }

  if (lower.includes('barato') || lower.includes('caro')) {
    const presencial = channels.find((c) => c.key === 'presencial');
    if (!presencial) return 'Não encontrei o canal Presencial cadastrado.';
    const linhas = recipes.map((r) => {
      const unitCost = recipeUnitCost(r);
      const price = suggestedPrice(unitCost, presencial, r.target_margin_pct);
      const profit = netProfit(price, unitCost, presencial);
      const marginPct = price > 0 ? (profit / price) * 100 : 0;
      return `${r.name}: margem de ${marginPct.toFixed(0)}% sobre o preço de venda no presencial`;
    });
    return `${linhas.join('\n')}\n\nSe algum estiver abaixo de 40-50%, vale considerar reajustar.`;
  }

  return 'Ainda respondo apenas essas perguntas prontas — use um dos botões de sugestão abaixo.';
}

export default function AssistentePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  async function ask(question: string) {
    if (!question.trim()) return;
    setMessages((m) => [...m, { role: 'user', text: question }]);
    setInput('');
    setLoading(true);
    const { recipes, channels } = await loadData();
    const text = answer(question, recipes, channels);
    setMessages((m) => [...m, { role: 'assistant', text }]);
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl">Assistente</h1>
      <div className="card">
        <p className="text-sm text-muted mb-3">
          Respostas prontas com base nos dados cadastrados — sem custo de IA. Use os botões abaixo.
        </p>

        <div className="space-y-2 mb-3 max-h-80 overflow-y-auto">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`text-sm rounded-lg px-3 py-2 max-w-[85%] whitespace-pre-wrap ${
                m.role === 'user' ? 'bg-caramel text-white ml-auto' : 'bg-cream'
              }`}
            >
              {m.text}
            </div>
          ))}
          {loading && <div className="text-sm text-muted">Calculando...</div>}
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          {SUGESTOES.map((s) => (
            <button key={s} className="btn-secondary text-xs" onClick={() => ask(s)}>
              {s}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            value={input}
            placeholder="Digite sua pergunta (ou use os botões acima)"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') ask(input);
            }}
          />
          <button className="btn-primary" disabled={loading} onClick={() => ask(input)}>
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}
