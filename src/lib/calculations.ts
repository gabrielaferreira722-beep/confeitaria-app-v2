import { Channel, ChannelPricing, RecipeWithItems, Unit } from './types';

/** Converte a quantidade comprada para a unidade base (g, ml ou unidade) usada no custo unitário. */
export function toBaseQty(qty: number, unit: Unit): number {
  if (unit === 'kg' || unit === 'litro') return qty * 1000;
  return qty;
}

/** Rótulo da unidade base para exibição (g, ml, un). */
export function baseUnitLabel(unit: Unit): string {
  if (unit === 'kg' || unit === 'g') return 'g';
  if (unit === 'litro' || unit === 'ml') return 'ml';
  return 'un';
}

/**
 * Custo dos itens de uma receita:
 * - ingredientes: qty_used * custo por unidade base
 * - outras receitas usadas: qty_used * custo por unidade de rendimento da receita usada
 */
export function recipeIngredientsCost(recipe: RecipeWithItems): number {
  const ingredientsCost = recipe.recipe_ingredients.reduce((total, item) => {
    const costPerBase = item.ingredient?.cost_per_base ?? 0;
    return total + costPerBase * item.qty_used;
  }, 0);

  const componentsCost = (recipe.recipe_components ?? []).reduce((total, item) => {
    const unitCost = item.component ? recipeUnitCost(item.component) : 0;
    return total + unitCost * item.qty_used;
  }, 0);

  return ingredientsCost + componentsCost;
}

/** Custo total da receita (itens + embalagem, gás, energia e mão de obra do lote inteiro). */
export function recipeTotalCost(recipe: RecipeWithItems): number {
  const ingredientsCost = recipeIngredientsCost(recipe);
  const overheadPerUnit = recipe.packaging_cost + recipe.gas_cost + recipe.energy_cost + recipe.labor_cost;
  return ingredientsCost + overheadPerUnit * recipe.yield_qty;
}

/** Custo por unidade de rendimento (un, g ou ml). Para produtos vendidos, é o número que entra na precificação. */
export function recipeUnitCost(recipe: RecipeWithItems): number {
  return recipeTotalCost(recipe) / recipe.yield_qty;
}

/**
 * Preço sugerido para um canal.
 * 1) aplica a margem desejada sobre o custo (preço base)
 * 2) reajusta para cima o suficiente para cobrir a comissão percentual do canal
 * 3) soma a taxa fixa do canal
 */
export function suggestedPrice(unitCost: number, channel: Channel, targetMarginPct: number): number {
  const basePrice = unitCost * (1 + targetMarginPct / 100);
  const priceCoveringCommission = basePrice / (1 - channel.commission_pct / 100);
  return priceCoveringCommission + channel.extra_fee;
}

/** Lucro líquido por unidade vendida naquele canal, depois de descontar comissão e taxa fixa. */
export function netProfit(price: number, unitCost: number, channel: Channel): number {
  const commissionValue = price * (channel.commission_pct / 100);
  return price - unitCost - commissionValue - channel.extra_fee;
}

/** Aplica a promoção da receita (percentual ou valor fixo em R$) sobre um preço, sem deixar ficar negativo. */
export function applyPromotion(price: number, recipe: Pick<RecipeWithItems, 'promotion_type' | 'promotion_value'>): number {
  if (recipe.promotion_type === 'percent') {
    return Math.max(0, price * (1 - recipe.promotion_value / 100));
  }
  if (recipe.promotion_type === 'value') {
    return Math.max(0, price - recipe.promotion_value);
  }
  return price;
}

/** Monta a precificação sugerida da receita para todos os canais informados, já considerando promoção ativa. */
export function priceRecipeForChannels(recipe: RecipeWithItems, channels: Channel[]): ChannelPricing[] {
  const unitCost = recipeUnitCost(recipe);
  const hasPromotion = recipe.promotion_type !== 'none' && recipe.promotion_value > 0;
  return channels.map((channel) => {
    const regularPrice = suggestedPrice(unitCost, channel, recipe.target_margin_pct);
    const finalPrice = hasPromotion ? applyPromotion(regularPrice, recipe) : regularPrice;
    const profit = netProfit(finalPrice, unitCost, channel);
    return {
      channel,
      regularPrice,
      finalPrice,
      hasPromotion,
      netProfit: profit,
      netMarginPct: finalPrice > 0 ? (profit / finalPrice) * 100 : 0,
    };
  });
}

export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
