'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase-browser';
import { Channel, PromotionType, RecipeWithItems } from '@/lib/types';
import { formatBRL, priceRecipeForChannels, recipeUnitCost } from '@/lib/calculations';

export default function PrecificacaoPage() {
  const [recipes, setRecipes] = useState<RecipeWithItems[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [savingOverhead, setSavingOverhead] = useState(false);

  async function loadData() {
    setLoading(true);
    const [recipesRes, channelsRes] = await Promise.all([
      supabase.from('recipes').select('*, recipe_ingredients(*, ingredient:ingredients(*))').order('name'),
      supabase.from('channels').select('*').order('key'),
    ]);
    const loadedRecipes = (recipesRes.data as unknown as RecipeWithItems[]) || [];
    setRecipes(loadedRecipes);
    setChannels((channelsRes.data as Channel[]) || []);
    if (loadedRecipes.length > 0 && !selectedRecipeId) setSelectedRecipeId(loadedRecipes[0].id);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recipe = recipes.find((r) => r.id === selectedRecipeId);

  async function updateRecipeField(field: keyof RecipeWithItems, value: number | string) {
    if (!recipe) return;
    setRecipes(recipes.map((r) => (r.id === recipe.id ? { ...r, [field]: value } : r)));
    setSavingOverhead(true);
    await supabase.from('recipes').update({ [field]: value }).eq('id', recipe.id);
    setSavingOverhead(false);
  }

  async function updateChannelField(channelId: string, field: keyof Channel, value: number) {
    setChannels(channels.map((c) => (c.id === channelId ? { ...c, [field]: value } : c)));
    await supabase.from('channels').update({ [field]: value }).eq('id', channelId);
  }

  if (loading) return <p className="text-sm text-muted">Carregando...</p>;

  if (recipes.length === 0) {
    return (
      <div className="card text-center py-10">
        <p className="text-sm text-muted">Cadastre uma receita primeiro para calcular o preço de venda.</p>
      </div>
    );
  }

  const pricing = recipe ? priceRecipeForChannels(recipe, channels) : [];

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl">Precificação</h1>

      <div>
        <label>Produto</label>
        <select value={selectedRecipeId} onChange={(e) => setSelectedRecipeId(e.target.value)}>
          {recipes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>

      {recipe && (
        <>
          <div className="card space-y-3">
            <p className="font-medium">Custos fixos por unidade e margem desejada</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label>Gás (R$/un)</label>
                <input
                  type="number"
                  step="0.01"
                  defaultValue={recipe.gas_cost}
                  onBlur={(e) => updateRecipeField('gas_cost', Number(e.target.value))}
                />
              </div>
              <div>
                <label>Energia (R$/un)</label>
                <input
                  type="number"
                  step="0.01"
                  defaultValue={recipe.energy_cost}
                  onBlur={(e) => updateRecipeField('energy_cost', Number(e.target.value))}
                />
              </div>
              <div>
                <label>Mão de obra (R$/un)</label>
                <input
                  type="number"
                  step="0.01"
                  defaultValue={recipe.labor_cost}
                  onBlur={(e) => updateRecipeField('labor_cost', Number(e.target.value))}
                />
              </div>
              <div>
                <label>Margem desejada sobre o custo (%)</label>
                <input
                  type="number"
                  defaultValue={recipe.target_margin_pct}
                  onBlur={(e) => updateRecipeField('target_margin_pct', Number(e.target.value))}
                />
              </div>
            </div>
            <p className="text-sm text-muted">
              {savingOverhead ? 'Salvando...' : `Custo total por unidade: ${formatBRL(recipeUnitCost(recipe))}`}
            </p>
          </div>

          <div className="card space-y-3">
            <p className="font-medium">Promoção</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 items-end">
              <div>
                <label>Tipo</label>
                <select
                  defaultValue={recipe.promotion_type}
                  onChange={(e) => updateRecipeField('promotion_type', e.target.value as PromotionType)}
                >
                  <option value="none">Sem promoção</option>
                  <option value="percent">Desconto em %</option>
                  <option value="value">Desconto em R$</option>
                </select>
              </div>
              <div>
                <label>{recipe.promotion_type === 'value' ? 'Desconto (R$)' : 'Desconto (%)'}</label>
                <input
                  type="number"
                  step="0.01"
                  disabled={recipe.promotion_type === 'none'}
                  defaultValue={recipe.promotion_value}
                  onBlur={(e) => updateRecipeField('promotion_value', Number(e.target.value))}
                />
              </div>
            </div>
            <p className="text-xs text-muted">
              O desconto é aplicado em cima do preço sugerido de cada canal, depois de já cobrir custo, margem e
              comissão.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {pricing.map(({ channel, regularPrice, finalPrice, hasPromotion, netProfit, netMarginPct }) => (
              <div key={channel.id} className="card">
                <p className="font-medium mb-2">{channel.name}</p>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div>
                    <label>Comissão %</label>
                    <input
                      type="number"
                      step="0.5"
                      defaultValue={channel.commission_pct}
                      onBlur={(e) => updateChannelField(channel.id, 'commission_pct', Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label>Taxa fixa (R$)</label>
                    <input
                      type="number"
                      step="0.1"
                      defaultValue={channel.extra_fee}
                      onBlur={(e) => updateChannelField(channel.id, 'extra_fee', Number(e.target.value))}
                    />
                  </div>
                </div>
                {hasPromotion ? (
                  <div className="mb-1">
                    <p className="text-sm text-muted line-through">{formatBRL(regularPrice)}</p>
                    <p className="text-2xl font-medium text-rose">{formatBRL(finalPrice)}</p>
                  </div>
                ) : (
                  <p className="text-2xl font-medium mb-1">{formatBRL(finalPrice)}</p>
                )}
                <div className="flex justify-between text-xs text-muted">
                  <span>Lucro líquido: {formatBRL(netProfit)}</span>
                  <span>Margem: {netMarginPct.toFixed(0)}%</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
