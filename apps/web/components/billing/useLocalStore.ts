"use client";

import { useEffect, useState } from "react";

export function useLocalStore<T>(key: string, seed: T[]): {
  items: T[];
  setItems: (items: T[]) => void;
  add: (item: T) => void;
  update: (id: string, patch: Partial<T>) => void;
  remove: (id: string) => void;
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

  const persist = (next: T[]) => {
    setItemsState(next);
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // ignore quota / disabled storage
    }
  };

  const setItems = (next: T[]) => persist(next);

  const add = (item: T) => persist([...items, item]);

  const update = (id: string, patch: Partial<T>) =>
    persist(
      items.map((it) =>
        (it as unknown as { id: string }).id === id ? { ...it, ...patch } : it
      )
    );

  const remove = (id: string) =>
    persist(items.filter((it) => (it as unknown as { id: string }).id !== id));

  return { items, setItems, add, update, remove, hydrated };
}
