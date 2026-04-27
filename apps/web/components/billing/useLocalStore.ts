"use client";

import { useEffect, useState } from "react";

type Updater<T> = T[] | ((prev: T[]) => T[]);

export function useLocalStore<T>(key: string, seed: T[]): {
  items: T[];
  setItems: (next: Updater<T>) => void;
  add: (item: T) => void;
  addMany: (items: T[]) => void;
  update: (id: string, patch: Partial<T>) => void;
  remove: (id: string) => void;
  removeMany: (ids: string[]) => void;
  hydrated: boolean;
} {
  const [items, setItemsState] = useState<T[]>(seed);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
      if (raw) {
        const parsed = JSON.parse(raw) as T[];
        setItemsState(parsed);
      } else {
        window.localStorage.setItem(key, JSON.stringify(seed));
        setItemsState(seed);
      }
    } catch {
      setItemsState(seed);
    } finally {
      setHydrated(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Use the functional setter so sequential calls (e.g. add() in a loop) compose
  // against the latest state instead of a stale closure value.
  const persist = (compute: (prev: T[]) => T[]) => {
    setItemsState((prev) => {
      const next = compute(prev);
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // ignore quota / disabled storage
      }
      return next;
    });
  };

  const setItems = (next: Updater<T>) =>
    persist(typeof next === "function" ? (next as (prev: T[]) => T[]) : () => next);

  const add = (item: T) => persist((prev) => [...prev, item]);

  const addMany = (newItems: T[]) =>
    persist((prev) => [...prev, ...newItems]);

  const update = (id: string, patch: Partial<T>) =>
    persist((prev) =>
      prev.map((it) =>
        (it as unknown as { id: string }).id === id ? { ...it, ...patch } : it
      )
    );

  const remove = (id: string) =>
    persist((prev) =>
      prev.filter((it) => (it as unknown as { id: string }).id !== id)
    );

  const removeMany = (ids: string[]) => {
    if (ids.length === 0) return;
    const set = new Set(ids);
    persist((prev) =>
      prev.filter((it) => !set.has((it as unknown as { id: string }).id))
    );
  };

  return { items, setItems, add, addMany, update, remove, removeMany, hydrated };
}
