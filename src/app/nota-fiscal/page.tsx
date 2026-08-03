'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase-browser';
import { Unit } from '@/lib/types';

const UNITS: Unit[] = ['kg', 'g', 'litro', 'ml', 'unidade'];

interface DraftItem {
  name: string;
  qty: string;
  unit: Unit;
  value: string;
  supplier: string;
}

function emptyItem(): DraftItem {
  return { name: '', qty: '', unit: 'kg', value: '', supplier: '' };
}

export default function NotaFiscalPage() {
  const router = useRouter();
  const [items, setItems] = useState<DraftItem[]>([emptyItem()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateItem(idx: number, field: keyof DraftItem, value: string) {
    const copy = [...items];
    copy[idx] = { ...copy[idx], [field]: value };
    setItems(copy);
  }

  function addRow() {
    setItems([...items, emptyItem()]);
  }

  function removeRow(idx: number) {
    setItems(items.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    setError(null);
    const validItems = items.filter((i) => i.name && i.qty && i.value);
    if (validItems.length === 0) {
      setError('Preencha ao menos um item com nome, quantidade e valor.');
      return;
    }
    setSaving(true);
    try {
      for (const item of validItems) {
        const { data: existing } = await supabase
          .from('ingredients')
          .select('id')
          .ilike('name', item.name)
          .maybeSingle();

        if (existing) {
          const { error } = await supabase
            .from('ingredients')
            .update({
              qty_bought: Number(item.qty),
              value_paid: Number(item.value),
              unit: item.unit,
              supplier: item.supplier || null,
              purchase_date: new Date().toISOString().slice(0, 10),
            })
            .eq('id', existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('ingredients').insert({
            name: item.name,
            unit: item.unit,
            qty_bought: Number(item.qty),
            value_paid: Number(item.value),
            supplier: item.supplier || null,
            purchase_date: new Date().toISOString().slice(0, 10),
          });
          if (error) throw error;
        }
      }
      router.push('/ingredientes');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl">Nota fiscal</h1>
      <p className="text-sm text-muted -mt-2">
        Digite os itens da nota. Se o nome já existir em ingredientes, o preço é atualizado; se não existir,
        um ingrediente novo é criado.
      </p>

      <div className="card space-y-3">
        {items.map((item, idx) => (
          <div key={idx} className="grid grid-cols-2 sm:grid-cols-5 gap-2 border-t border-border pt-3 first:border-0 first:pt-0">
            <div className="col-span-2 sm:col-span-1">
              <label>Nome</label>
              <input value={item.name} onChange={(e) => updateItem(idx, 'name', e.target.value)} />
            </div>
            <div>
              <label>Quantidade</label>
              <input type="number" value={item.qty} onChange={(e) => updateItem(idx, 'qty', e.target.value)} />
            </div>
            <div>
              <label>Unidade</label>
              <select value={item.unit} onChange={(e) => updateItem(idx, 'unit', e.target.value)}>
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Valor pago (R$)</label>
              <input type="number" value={item.value} onChange={(e) => updateItem(idx, 'value', e.target.value)} />
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label>Fornecedor</label>
                <input value={item.supplier} onChange={(e) => updateItem(idx, 'supplier', e.target.value)} />
              </div>
              {items.length > 1 && (
                <button className="text-xs text-muted pb-2" onClick={() => removeRow(idx)}>
                  remover
                </button>
              )}
            </div>
          </div>
        ))}
        <button className="btn-secondary text-sm" onClick={addRow}>
          + adicionar item
        </button>

        {error && <p className="text-sm text-rose">{error}</p>}
        <div>
          <button className="btn-primary" disabled={saving} onClick={handleSave}>
            {saving ? 'Salvando...' : 'Salvar itens'}
          </button>
        </div>
      </div>
    </div>
  );
}
