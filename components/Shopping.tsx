'use client';
import React, { useState, useEffect } from 'react';
import { ShoppingBag, Plus, Trash2, CheckCircle2, Circle } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';

interface ShoppingProps {
  familyId: string;
  userId: string;
  displayName: string;
}

interface ShoppingItem {
  id: string;
  item: string;
  checked: boolean;
  addedBy: string;
  checkedBy?: string;
  createdAt: any;
}

export default function Shopping({ familyId, userId, displayName }: ShoppingProps) {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [newItemName, setNewItemName] = useState('');

  // Fetch shopping list items for this family
  useEffect(() => {
    if (!familyId) return;

    const q = query(
      collection(db, 'shopping_items'),
      where('familyId', '==', familyId),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const docsArr: ShoppingItem[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        docsArr.push({
          id: docSnap.id,
          item: d.item,
          checked: d.checked || false,
          addedBy: d.addedBy || 'Invitado',
          checkedBy: d.checkedBy || '',
          createdAt: d.createdAt
        });
      });
      setItems(docsArr);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'shopping_items');
    });

    return () => unsub();
  }, [familyId]);

  const addItemInput = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    try {
      await addDoc(collection(db, 'shopping_items'), {
        familyId,
        item: newItemName.trim(),
        checked: false,
        addedBy: displayName,
        checkedBy: '',
        createdAt: serverTimestamp()
      });
      setNewItemName('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'shopping_items');
    }
  };

  const toggleCheck = async (item: ShoppingItem) => {
    try {
      const docRef = doc(db, 'shopping_items', item.id);
      await updateDoc(docRef, {
        checked: !item.checked,
        checkedBy: !item.checked ? displayName : ''
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `shopping_items/${item.id}`);
    }
  };

  const deleteItem = async (itemId: string) => {
    try {
      await deleteDoc(doc(db, 'shopping_items', itemId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `shopping_items/${itemId}`);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border-2 border-blue-100 dark:border-slate-800 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <ShoppingBag className="text-blue-500 w-5 h-5" />
          Lista de la Compra Familiar
        </h3>
        <p className="text-xs text-slate-400 font-mono">
          {items.filter(i => !i.checked).length} por comprar
        </p>
      </div>

      <form onSubmit={addItemInput} className="flex gap-2 mb-4">
        <input
          type="text"
          value={newItemName}
          onChange={(e) => setNewItemName(e.target.value)}
          placeholder="Ej: Leche desnatada, Manzanas..."
          className="flex-1 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 placeholder-slate-400 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
        />
        <button
          type="submit"
          className="bg-blue-500 hover:bg-blue-600 active:scale-95 text-white p-2.5 rounded-xl transition-all"
        >
          <Plus className="w-4 h-4" />
        </button>
      </form>

      {items.length === 0 ? (
        <div className="text-center py-8 bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/40 rounded-xl">
          <p className="text-xs text-slate-400 font-mono">🍉 La despensa familiar está colmada. ¡No faltan cosas!</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-200/50 dark:border-slate-800 rounded-xl hover:bg-blue-50/20 transition-all"
            >
              <button
                onClick={() => toggleCheck(item)}
                className="flex items-center gap-2.5 text-left flex-1"
              >
                {item.checked ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                ) : (
                  <Circle className="w-5 h-5 text-slate-300 dark:text-slate-700 shrink-0" />
                )}
                <div>
                  <p className={`text-slate-800 dark:text-slate-200 text-xs font-bold ${item.checked ? 'line-through text-slate-400 dark:text-slate-600' : ''}`}>
                    {item.item}
                  </p>
                  <p className="text-[9px] text-slate-400 font-mono">
                    Añadido por: {item.addedBy} {item.checkedBy && ` | Comprado por: ${item.checkedBy}`}
                  </p>
                </div>
              </button>

              <button
                onClick={() => deleteItem(item.id)}
                className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg active:scale-90 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
