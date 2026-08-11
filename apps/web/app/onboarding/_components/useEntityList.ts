"use client";

import { useCallback, useEffect, useState } from "react";

import { ApiError } from "@/lib/api";

interface UseEntityListArgs<TOut, TCreate> {
  list: () => Promise<TOut[]>;
  create: (body: TCreate) => Promise<TOut>;
}

export function useEntityList<TOut extends { id: string }, TCreate>({
  list,
  create,
}: UseEntityListArgs<TOut, TCreate>) {
  const [items, setItems] = useState<TOut[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    list()
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch(() => {
        if (!cancelled) setLoadError("Could not load existing records.");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const add = useCallback(
    async (body: TCreate) => {
      setSubmitError(null);
      setSubmitting(true);
      try {
        const created = await create(body);
        setItems((prev) => (prev ? [...prev, created] : [created]));
        return created;
      } catch (err) {
        setSubmitError(err instanceof ApiError ? err.detail : "Something went wrong.");
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [create],
  );

  return { items, loadError, add, submitting, submitError };
}
