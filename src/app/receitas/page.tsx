'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase-browser';
import { Ingredient, RecipeWithItems, YieldUnit } from '@/lib/types';
import { baseUnitLabel, formatBRL, recipeTotalCost, recipeUnitCost } from '@/lib/calculations';

interface DraftItem {
  ingredient_id: string;
  qty_used: string;
}

interface DraftComponent {
  recipe_id: string;
  qty_used: string;
}

const emptyForm = {
  name: '',
  yield_qty: '',
  yield_unit: 'un' as YieldUnit,
  packaging_cost: '',
  gas_cost: '',
  energy_cost: '',
  labor_cost: '',
};

// Traz os ingredientes e também as outras receitas usadas dentro de cada receita
const RECIPE_SELECT =
  '*, recipe_ingredients(*, ingredient:ingredients(*)), ' +
  'recipe_components:recipe_components!recipe_components_recipe_id_fkey(*, ' +
  'component:recipes!recipe_components_component_recipe_id_fkey(*, recipe_ingredients(*, ingredient:ingredients(*))))';

export default function ReceitasPage() {
  const [recipes, setRecipes] = useState<RecipeWithItems[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [items, setItems] = useState<DraftItem[]>([{ ingredient_id: '', qty_used: '' }]);
  const [components, setComponents] = useState<DraftComponent[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Quando preenchido, o formulário está editando uma receita existente
  const [editingId, setEditingId] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    const [recipesRes, ingredientsRes] = await Promise.all([
      supabase.from('recipes').select(RECIPE_SELECT).order('name'),
      supabase.from('ingredients').select('*').order('name'),
    ]);
    if (recipesRes.error) setError(recipesRes.error.message);
    else setRecipes(recipesRes.data as unknown as RecipeWithItems[]);
    if (ingredientsRes.data) setIngredients(ingredientsRes.data as Ingredient[]);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  // Só receitas "simples" (que não usam outras receitas) podem ser usadas como item
  const componentOptions = recipes.filter(
    (r) => r.id !== editingId && !(r.recipe_components && r.recipe_components.length > 0)
  );

  function isUsedAsComponent(recipeId: string) {
    return recipes.some((r) => r.recipe_components?.some((c) => c.component_recipe_id === recipeId));
  }

  function updateItem(idx: number, field: keyof DraftItem, value: string) {
    const copy = [...items];
    copy[idx] = { ...copy[idx], [field]: value };
    setItems(copy);
  }

  function addItemRow() {
    setItems([...items, { ingredient_id: '', qty_used: '' }]);
  }

  function removeItemRow(idx: number) {
    setItems(items.filter((_, i) => i !== idx));
  }

  function updateComponent(idx: number, field: keyof DraftComponent, value: string) {
    const copy = [...components];
    copy[idx] = { ...copy[idx], [field]: value };
    setComponents(copy);
  }

  function addComponentRow() {
    setComponents([...components, { recipe_id: '', qty_used: '' }]);
  }

  function removeComponentRow(idx: number) {
    setComponents(components.filter((_, i) => i !== idx));
  }

  function resetForm() {
    setForm(emptyForm);
    setItems([{ ingredient_id: '', qty_used: '' }]);
    setComponents([]);
    setEditingId(null);
    setError(null);
  }

  function closeForm() {
    resetForm();
    setShowForm(false);
  }

  function handleToggleForm() {
    if (showForm) {
      closeForm();
    } else {
      resetForm();
      setShowForm(true);
    }
  }

  function handleEditRecipe(recipe: RecipeWithItems) {
    setError(null);
    setEditingId(recipe.id);
    setForm({
      name: recipe.name,
      yield_qty: String(recipe.yield_qty),
      yield_unit: (recipe.yield_unit ?? 'un') as YieldUnit,
      packaging_cost: recipe.packaging_cost ? String(recipe.packaging_cost) : '',
      gas_cost: recipe.gas_cost ? String(recipe.gas_cost) : '',
      energy_cost: recipe.energy_cost ? String(recipe.energy_cost) : '',
      labor_cost: recipe.labor_cost ? String(recipe.labor_cost) : '',
    });
    const draft = recipe.recipe_ingredients.map((ri) => ({
      ingredient_id: (ri as { ingredient_id?: string }).ingredient_id ?? ri.ingredient?.id ?? '',
      qty_used: String(ri.qty_used),
    }));
    setItems(draft.length > 0 ? draft : [{ ingredient_id: '', qty_used: '' }]);
    setComponents(
      (recipe.recipe_components ?? []).map((c) => ({
        recipe_id: c.component_recipe_id,
        qty_used: String(c.qty_used),
      }))
    );
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Insere ingredientes e receitas usadas. Devolve a mensagem de erro, ou null se deu certo.
  async function insertChildren(
    recipeId: string,
    validItems: DraftItem[],
    validComps: DraftComponent[]
  ): Promise<string | null> {
    if (validItems.length > 0) {
      const { error: itemsError } = await supabase.from('recipe_ingredients').insert(
        validItems.map((i) => ({
          recipe_id: recipeId,
          ingredient_id: i.ingredient_id,
          qty_used: Number(i.qty_used),
        }))
      );
      if (itemsError) return itemsError.message;
    }
    if (validComps.length > 0) {
      const { error: compsError } = await supabase.from('recipe_components').insert(
        validComps.map((c) => ({
          recipe_id: recipeId,
          component_recipe_id: c.recipe_id,
          qty_used: Number(c.qty_used),
        }))
      );
      if (compsError) return compsError.message;
    }
    return null;
  }

  async function handleSave() {
    setError(null);
    const validItems = items.filter((i) => i.ingredient_id && i.qty_used);
    const validComps = components.filter((c) => c.recipe_id && c.qty_used);
    if (!form.name || !form.yield_qty || (validItems.length === 0 && validComps.length === 0)) {
      setError('Preencha nome, rendimento e ao menos um ingrediente ou uma receita.');
      return;
    }
    if (editingId && validComps.length > 0 && isUsedAsComponent(editingId)) {
      setError('Esta receita já é usada dentro de outra receita, então ela não pode usar outras receitas.');
      return;
    }
    setSaving(true);

    const recipeData = {
      name: form.name,
      yield_qty: Number(form.yield_qty),
      yield_unit: form.yield_unit,
      packaging_cost: Number(form.packaging_cost) || 0,
      gas_cost: Number(form.gas_cost) || 0,
      energy_cost: Number(form.energy_cost) || 0,
      labor_cost: Number(form.labor_cost) || 0,
    };

    if (editingId) {
      // ---- EDIÇÃO ----
      const { error: updateError } = await supabase
        .from('recipes')
        .update(recipeData)
        .eq('id', editingId);

      if (updateError) {
        setError(updateError.message);
        setSaving(false);
        return;
      }

      // Guarda os ids antigos para apagar só depois de inserir os novos
      const [oldItemsRes, oldCompsRes] = await Promise.all([
        supabase.from('recipe_ingredients').select('id').eq('recipe_id', editingId),
        supabase.from('recipe_components').select('id').eq('recipe_id', editingId),
      ]);
      if (oldItemsRes.error || oldCompsRes.error) {
        setError((oldItemsRes.error || oldCompsRes.error)!.message);
        setSaving(false);
        return;
      }

      const insertError = await insertChildren(editingId, validItems, validComps);
      if (insertError) {
        setError(insertError);
        setSaving(false);
        return;
      }

      const oldItemIds = (oldItemsRes.data ?? []).map((o) => o.id);
      if (oldItemIds.length > 0) {
        const { error: delError } = await supabase.from('recipe_ingredients').delete().in('id', oldItemIds);
        if (delError) {
          setError(delError.message);
          setSaving(false);
          return;
        }
      }
      const oldCompIds = (oldCompsRes.data ?? []).map((o) => o.id);
      if (oldCompIds.length > 0) {
        const { error: delError } = await supabase.from('recipe_components').delete().in('id', oldCompIds);
        if (delError) {
          setError(delError.message);
          setSaving(false);
          return;
        }
      }

      setSaving(false);
      closeForm();
      loadData();
      return;
    }

    // ---- NOVA RECEITA ----
    const { data: recipe, error: recipeError } = await supabase
      .from('recipes')
      .insert(recipeData)
      .select()
      .single();

    if (recipeError || !recipe) {
      setError(recipeError?.message || 'Erro ao salvar receita.');
      setSaving(false);
      return;
    }

    const childError = await insertChildren(recipe.id, validItems, validComps);
    if (childError) {
      // desfaz a receita criada para não deixar uma receita vazia
      await supabase.from('recipes').delete().eq('id', recipe.id);
      setError(childError);
      setSaving(false);
      return;
    }

    setSaving(false);
    closeForm();
    loadData();
  }

  async function handleDeleteRecipe(recipeId: string, name: string) {
    const confirmed = window.confirm(`Excluir a receita "${name}"? Essa ação não pode ser desfeita.`);
    if (!confirmed) return;
    const { error } = await supabase.from('recipes').delete().eq('id', recipeId);
    if (error) {
      const inUse = isUsedAsComponent(recipeId);
      alert(
        inUse
          ? `Não foi possível excluir: esta receita é usada dentro de outra receita. Remova-a de lá primeiro.`
          : `Erro ao excluir: ${error.message}`
      );
      return;
    }
    if (editingId === recipeId) closeForm();
    loadData();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl">Receitas</h1>
        <button className="btn-primary" onClick={handleToggleForm}>
          {showForm ? 'Fechar' : '+ Nova receita'}
        </button>
      </div>

      {error && !showForm && <p className="text-sm text-rose">{error}</p>}

      {showForm && (
        <div className="card space-y-4">
          {editingId && (
            <p className="text-sm text-muted">
              Editando receita: <span className="font-medium">{form.name || '(sem nome)'}</span>
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label>Nome do produto</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label>Rendimento</label>
              <input
                type="number"
                value={form.yield_qty}
                onChange={(e) => setForm({ ...form, yield_qty: e.target.value })}
              />
            </div>
            <div>
              <label>Unidade do rendimento</label>
              <select
                value={form.yield_unit}
                onChange={(e) => setForm({ ...form, yield_unit: e.target.value as YieldUnit })}
              >
                <option value="un">unidades (un)</option>
                <option value="g">gramas (g)</option>
                <option value="ml">mililitros (ml)</option>
              </select>
            </div>
            <div>
              <label>Embalagem (R$/{form.yield_unit})</label>
              <input
                type="number"
                value={form.packaging_cost}
                onChange={(e) => setForm({ ...form, packaging_cost: e.target.value })}
              />
            </div>
            <div>
              <label>Gás (R$/{form.yield_unit})</label>
              <input
                type="number"
                value={form.gas_cost}
                onChange={(e) => setForm({ ...form, gas_cost: e.target.value })}
              />
            </div>
            <div>
              <label>Energia (R$/{form.yield_unit})</label>
              <input
                type="number"
                value={form.energy_cost}
                onChange={(e) => setForm({ ...form, energy_cost: e.target.value })}
              />
            </div>
            <div>
              <label>Mão de obra (R$/{form.yield_unit})</label>
              <input
                type="number"
                value={form.labor_cost}
                onChange={(e) => setForm({ ...form, labor_cost: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label>Ingredientes utilizados</label>
            {items.map((item, idx) => {
              const ing = ingredients.find((i) => i.id === item.ingredient_id);
              return (
                <div key={idx} className="flex gap-2 items-center">
                  <select
                    className="flex-1"
                    value={item.ingredient_id}
                    onChange={(e) => updateItem(idx, 'ingredient_id', e.target.value)}
                  >
                    <option value="">Selecione o ingrediente</option>
                    {ingredients.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                  <input
                    className="w-28"
                    type="number"
                    placeholder={ing ? baseUnitLabel(ing.unit) : 'qtd'}
                    value={item.qty_used}
                    onChange={(e) => updateItem(idx, 'qty_used', e.target.value)}
                  />
                  <button className="text-muted text-sm px-2" onClick={() => removeItemRow(idx)}>
                    remover
                  </button>
                </div>
              );
            })}
            <button className="btn-secondary text-sm" onClick={addItemRow}>
              + adicionar ingrediente
            </button>
          </div>

          <div className="space-y-2">
            <label>Receitas utilizadas (frações de outras receitas)</label>
            {components.map((comp, idx) => {
              const r = recipes.find((x) => x.id === comp.recipe_id);
              return (
                <div key={idx} className="flex gap-2 items-center">
                  <select
                    className="flex-1"
                    value={comp.recipe_id}
                    onChange={(e) => updateComponent(idx, 'recipe_id', e.target.value)}
                  >
                    <option value="">Selecione a receita</option>
                    {componentOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name} (rende {o.yield_qty} {o.yield_unit ?? 'un'})
                      </option>
                    ))}
                  </select>
                  <input
                    className="w-28"
                    type="number"
                    placeholder={r ? (r.yield_unit ?? 'un') : 'qtd'}
                    value={comp.qty_used}
                    onChange={(e) => updateComponent(idx, 'qty_used', e.target.value)}
                  />
                  <button className="text-muted text-sm px-2" onClick={() => removeComponentRow(idx)}>
                    remover
                  </button>
                </div>
              );
            })}
            <button className="btn-secondary text-sm" onClick={addComponentRow}>
              + adicionar receita
            </button>
          </div>

          {error && <p className="text-sm text-rose">{error}</p>}
          <div className="flex gap-2">
            <button className="btn-primary" disabled={saving} onClick={handleSave}>
              {saving ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Salvar receita'}
            </button>
            <button className="btn-secondary" onClick={closeForm}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {loading && <p className="text-sm text-muted">Carregando...</p>}
        {!loading && recipes.length === 0 && (
          <p className="text-sm text-muted">Nenhuma receita cadastrada ainda.</p>
        )}
        {recipes.map((recipe) => {
          const unit = recipe.yield_unit ?? 'un';
          const per = unit === 'un' ? 1 : 100;
          return (
            <div key={recipe.id} className="card">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">{recipe.name}</h3>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted">
                    Rendimento: {recipe.yield_qty} {unit}
                  </span>
                  <button className="text-xs underline" onClick={() => handleEditRecipe(recipe)}>
                    Editar
                  </button>
                  <button
                    className="text-xs text-rose underline"
                    onClick={() => handleDeleteRecipe(recipe.id, recipe.name)}
                  >
                    Excluir
                  </button>
                </div>
              </div>
              <div className="space-y-1 mb-3">
                {recipe.recipe_ingredients.map((ri) => (
                  <div key={ri.id} className="flex justify-between text-sm text-muted">
                    <span>
                      {ri.ingredient?.name} · {ri.qty_used}
                      {ri.ingredient ? baseUnitLabel(ri.ingredient.unit) : ''}
                    </span>
                    <span>{formatBRL((ri.ingredient?.cost_per_base ?? 0) * ri.qty_used)}</span>
                  </div>
                ))}
                {(recipe.recipe_components ?? []).map((c) => (
                  <div key={c.id} className="flex justify-between text-sm text-muted">
                    <span>
                      {c.component?.name ?? 'receita removida'} · {c.qty_used}
                      {c.component?.yield_unit ?? 'un'} (receita)
                    </span>
                    <span>{formatBRL((c.component ? recipeUnitCost(c.component) : 0) * c.qty_used)}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-1 mb-3">
                {([
                  ['Embalagem', recipe.packaging_cost],
                  ['Gás', recipe.gas_cost],
                  ['Energia', recipe.energy_cost],
                  ['Mão de obra', recipe.labor_cost],
                ] as [string, number][])
                  .filter(([, v]) => v > 0)
                  .map(([label, v]) => (
                    <div key={label} className="flex justify-between text-sm text-muted">
                      <span>
                        {label} · {formatBRL(v)}/{unit} × {recipe.yield_qty}
                      </span>
                      <span>{formatBRL(v * recipe.yield_qty)}</span>
                    </div>
                  ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-cream px-3 py-2">
                  <p className="text-xs text-muted">Custo total</p>
                  <p className="font-medium">{formatBRL(recipeTotalCost(recipe))}</p>
                </div>
                <div className="rounded-lg bg-cream px-3 py-2">
                  <p className="text-xs text-muted">Custo por {per === 1 ? 'unidade' : `100 ${unit}`}</p>
                  <p className="font-medium">{formatBRL(recipeUnitCost(recipe) * per)}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
