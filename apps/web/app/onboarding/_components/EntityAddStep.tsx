"use client";

import { useEntityList } from "./useEntityList";
import { AddedList } from "./AddedList";

interface RenderFormArgs<TCreate> {
  add: (body: TCreate) => Promise<unknown>;
  submitting: boolean;
  submitError: string | null;
}

interface EntityAddStepProps<TOut extends { id: string }, TCreate> {
  title: string;
  description?: string;
  list: () => Promise<TOut[]>;
  create: (body: TCreate) => Promise<TOut>;
  renderItem: (item: TOut) => React.ReactNode;
  renderForm: (args: RenderFormArgs<TCreate>) => React.ReactNode;
  emptyLabel: string;
  minRequired?: number;
  requiredMessage?: string;
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
}

export function EntityAddStep<TOut extends { id: string }, TCreate>({
  title,
  description,
  list,
  create,
  renderItem,
  renderForm,
  emptyLabel,
  minRequired = 0,
  requiredMessage,
  onBack,
  onNext,
  nextLabel = "Continue",
}: EntityAddStepProps<TOut, TCreate>) {
  const { items, loadError, add, submitting, submitError } = useEntityList<TOut, TCreate>({ list, create });

  const count = items?.length ?? 0;
  const canAdvance = items !== null && count >= minRequired;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && <p className="text-sm text-gray-500">{description}</p>}
      </div>

      {renderForm({ add, submitting, submitError })}

      {loadError ? (
        <p className="text-sm text-red-600">{loadError}</p>
      ) : items === null ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : (
        <AddedList items={items} renderItem={renderItem} emptyLabel={emptyLabel} />
      )}

      {!canAdvance && requiredMessage && <p className="text-sm text-amber-600">{requiredMessage}</p>}

      <div className="flex items-center justify-between border-t border-gray-100 pt-4">
        {onBack ? (
          <button onClick={onBack} className="text-sm font-medium text-gray-600 hover:underline">
            Back
          </button>
        ) : (
          <span />
        )}
        <button
          onClick={onNext}
          disabled={!canAdvance}
          className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {nextLabel}
        </button>
      </div>
    </div>
  );
}
