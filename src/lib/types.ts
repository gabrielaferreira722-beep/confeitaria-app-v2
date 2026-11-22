export type Unit = 'kg' | 'g' | 'litro' | 'ml' | 'unidade';

export interface Ingredient {
  id: string;
  name: string;
  unit: Unit;
  qty_bought: number;
  value_paid: number;
  supplier: string | null;
  purchase_date: string;
  cost_per_base: number;
  created_at: string;
  updated_at: string;
}

export interface PriceHistoryEntry {
  id: string;
  ingredient_id: string;
  price_per_base: number;
  recorded_at: string;
}

export type PromotionType = 'none' | 'percent' | 'value';

/** Unidade em que o rendimento da receita é medido: unidades, gramas ou ml. */
export type YieldUnit = 'un' | 'g' | 'ml';

export interface Recipe {
  id: string;
  name: string;
  yield_qty: number;
  yield_unit?: YieldUnit;
  packaging_cost: number;
  gas_cost: number;
  energy_cost: number;
  labor_cost: number;
  target_margin_pct: number;
  promotion_type: PromotionType;
  promotion_value: number;
  created_at: string;
  updated_at: string;
}

export interface RecipeIngredient {
  id: string;
  recipe_id: string;
  ingredient_id: string;
  qty_used: number;
  // preenchido via join na leitura
  ingredient?: Ingredient;
}

/** Outra receita usada como item dentro de uma receita (ex.: 80 g de creme de ninho). */
export interface RecipeComponent {
  id: string;
  recipe_id: string;
  component_recipe_id: string;
  qty_used: number; // na unidade de rendimento da receita usada
  // preenchido via join na leitura
  component?: RecipeWithItems;
}

export interface RecipeWithItems extends Recipe {
  recipe_ingredients: RecipeIngredient[];
  recipe_components?: RecipeComponent[];
}

export interface Channel {
  id: string;
  key: 'presencial' | 'ifood' | '99food' | 'keeta';
  name: string;
  commission_pct: number;
  extra_fee: number;
}

export interface ChannelPricing {
  channel: Channel;
  regularPrice: number;
  finalPrice: number;
  hasPromotion: boolean;
  netProfit: number;
  netMarginPct: number;
}
