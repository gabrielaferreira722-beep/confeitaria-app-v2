'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase-browser';
import { Ingredient, PriceHistoryEntry, Unit } from '@/lib/types';
import { baseUnitLabel } from '@/lib/calculations';

const UNITS: Unit[] = ['kg', 'g', 'litro', 'ml', 'unidade'];

const emptyForm = {
  name: '',
  unit: 'kg' as Unit,
  qty_bought: '',
  value_paid: '',
  supplier: '',
  purchase_date: new Date().toISOString().slice(0, 10),
};

export default function IngredientesPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openHistory, setOpenHistory] = useState<string | null>(null);
  const [history, setHistory] = useState<PriceHistoryEntry[]>([]);

  async function loadIngredients() {
    setLoading(true);
    const { data, error } = await supabase
      .from('ingredients')
      .select('*')
      .order('name', { ascending: true });
    if (error) setError(error.message);
    else setIngredients(data as Ingredient[]);
    setLoading(false);
  }

  useEffect(() => {
    loadIngredients();
  }, []);

  async function handleSave() {
    setError(null);
    if (!form.name || !form.qty_bought || !form.value_paid) {
      setError('Preencha nome, quantidade e valor pago.');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('ingredients').insert({
      name: form.name,
      unit: form.unit,
      qty_bought: Number(form.qty_bought),
      value_paid: Number(form.value_paid),
      supplier: form.supplier || null,
      purchase_date: form.purchase_date,
    });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setForm(emptyForm);
    setShowForm(false);
    loadIngredients();
  }

  async function handleDelete(ingredient: Ingredient) {
    const confirmed = window.confirm(`Excluir "${ingredient.name}"? Essa ação não pode ser desfeita.`);
    if (!confirmed) return;
    const { error } = await supabase.from('ingredients').delete().eq('id', ingredient.id);
    if (error) {
      if (error.code === '23503') {
        alert(
          `"${ingredient.name}" está sendo usado em alguma receita. Remova-o da receita primeiro para poder excluir.`
        );
      } else {
        alert(`Erro ao excluir: ${error.message}`);
      }
      return;
    }
    loadIngredients();
  }

  async function toggleHistory(ingredientId: string) {
    if (openHistory === ingredientId) {
      setOpenHistory(null);
      return;
    }
    const { data, error } = await supabase
      .from('price_history')
      .select('*')
      .eq('ingredient_id', ingredientId)
      .order('recorded_at', { ascending: false });
    if (!error) setHistory(data as PriceHistoryEntry[]);
    setOpenHistory(ingredientId);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl">Ingredientes</h1>
        <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Fechar' : '+ Novo ingrediente'}
        </button>
      </div>

      {showForm && (
        <div className="card space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label>Nome do ingrediente</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label>Unidade de compra</label>
              <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value as Unit })}>
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Quantidade comprada</label>
              <input
                type="number"
                value={form.qty_bought}
                onChange={(e) => setForm({ ...form, qty_bought: e.target.value })}
              />
            </div>
            <div>
              <label>Valor pago (R$)</label>
              <input
                type="number"
                value={form.value_paid}
                onChange={(e) => setForm({ ...form, value_paid: e.target.value })}
              />
            </div>
            <div>
              <label>Fornecedor</label>
              <input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
            </div>
            <div>
              <label>Data da compra</label>
              <input
                type="date"
                value={form.purchase_date}
                onChange={(e) => setForm({ ...form, purchase_date: e.target.value })}
              />
            </div>
          </div>
          {error && <p className="text-sm text-rose">{error}</p>}
          <div className="flex gap-2">
            <button className="btn-primary" disabled={saving} onClick={handleSave}>
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
            <button className="btn-secondary" onClick={() => setShowForm(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="card divide-y divide-border">
        {loading && <p className="text-sm text-muted py-2">Carregando...</p>}
        {!loading && ingredients.length === 0 && (
          <p className="text-sm text-muted py-2">Nenhum ingrediente cadastrado ainda.</p>
        )}
        {ingredients.map((ing) => (
          <div key={ing.id} className="py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium truncate">{ing.name}</p>
                <p className="text-xs text-muted">
                  {ing.supplier || 'Fornecedor não informado'} · {ing.qty_bought} {ing.unit} por{' '}
                  {ing.value_paid.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>
              <div className="text-right whitespace-nowrap">
                <p className="font-medium">
                  {ing.cost_per_base.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 4,
                  })}
                  <span className="text-muted font-normal">/{baseUnitLabel(ing.unit)}</span>
                </p>
                <div className="flex gap-3 justify-end mt-1">
                  <button className="text-xs text-caramel-dark underline" onClick={() => toggleHistory(ing.id)}>
                    Histórico
                  </button>
                  <button className="text-xs text-rose underline" onClick={() => handleDelete(ing)}>
                    Excluir
                  </button>
                </div>
              </div>
            </div>
            {openHistory === ing.id && (
              <div className="mt-2 pl-3 border-l-2 border-border text-xs text-muted space-y-1">
                {history.length === 0 && <p>Sem histórico registrado.</p>}
                {history.map((h) => (
                  <p key={h.id}>
                    {new Date(h.recorded_at).toLocaleDateString('pt-BR')}:{' '}
                    {h.price_per_base.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                      maximumFractionDigits: 4,
                    })}
                    /{baseUnitLabel(ing.unit)}
                  </p>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
