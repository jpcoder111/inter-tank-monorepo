"use client";

import { useState } from "react";

// Tracks a set of selected ids drawn from a list of records. Designed for
// table-style bulk actions: per-row checkbox, header select-all, and a
// floating actions bar that appears when at least one row is selected.
//
// `visibleIds` should be the ids currently rendered (post-filter / search).
// Select-all toggles only the visible set so a search-then-select-all
// matches the user's mental model.
export function useBulkSelection(visibleIds: string[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Atomic select/deselect of an arbitrary subset (e.g., all rates of one
  // agent). If every id is already selected, deselect them; otherwise add the
  // missing ones.
  const toggleMany = (ids: string[]) =>
    setSelected((prev) => {
      if (ids.length === 0) return prev;
      const next = new Set(prev);
      const allSelected = ids.every((id) => next.has(id));
      if (allSelected) {
        for (const id of ids) next.delete(id);
      } else {
        for (const id of ids) next.add(id);
      }
      return next;
    });

  const toggleAllVisible = () =>
    setSelected((prev) => {
      const visible = new Set(visibleIds);
      const allVisibleSelected =
        visibleIds.length > 0 && visibleIds.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allVisibleSelected) {
        // Deselect just the visible ones — keep any selections outside the
        // current view (e.g. when a search filter is active).
        for (const id of visible) next.delete(id);
      } else {
        for (const id of visible) next.add(id);
      }
      return next;
    });

  const clear = () => setSelected(new Set());

  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  return {
    selected,
    toggleOne,
    toggleMany,
    toggleAllVisible,
    clear,
    allVisibleSelected,
  };
}
