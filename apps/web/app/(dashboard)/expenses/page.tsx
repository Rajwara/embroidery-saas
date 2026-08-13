"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { listExpenses } from "@embroidery/types";
import type { ExpenseOut } from "@embroidery/types";

import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function ExpensesPage() {
  const { hasPermission } = useAuth();
  const [expenses, setExpenses] = useState<ExpenseOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setExpenses(null);
    listExpenses()
      .then(setExpenses)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setError("You don't have permission to view expenses.");
        } else {
          setError("Could not load expenses.");
        }
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Expenses</h1>
        {hasPermission("expenses.create") && (
          <Link
            href="/expenses/new"
            className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white"
          >
            New Expense
          </Link>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={load} className="font-medium underline">
            Retry
          </button>
        </div>
      )}

      {!error && expenses === null && <p className="text-sm text-gray-500">Loading expenses...</p>}

      {!error && expenses !== null && expenses.length === 0 && (
        <p className="text-sm text-gray-500">No expenses found.</p>
      )}

      {!error && expenses !== null && expenses.length > 0 && (
        <table className="w-full rounded bg-white text-sm shadow">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="px-4 py-2 font-medium">Expense #</th>
              <th className="px-4 py-2 font-medium">Category</th>
              <th className="px-4 py-2 font-medium">Description</th>
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((expense) => (
              <tr key={expense.id} className="border-b border-gray-100 last:border-0">
                <td className="px-4 py-2 font-medium text-gray-900">{expense.expense_number}</td>
                <td className="px-4 py-2">{expense.category}</td>
                <td className="px-4 py-2">{expense.description}</td>
                <td className="px-4 py-2">{expense.expense_date}</td>
                <td className="px-4 py-2">{expense.amount.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
