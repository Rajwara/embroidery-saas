interface AddedListProps<TOut> {
  items: TOut[];
  renderItem: (item: TOut) => React.ReactNode;
  emptyLabel: string;
}

export function AddedList<TOut extends { id: string }>({ items, renderItem, emptyLabel }: AddedListProps<TOut>) {
  if (items.length === 0) {
    return <p className="text-sm text-gray-500">{emptyLabel}</p>;
  }

  return (
    <ul className="divide-y divide-gray-100 rounded bg-white shadow">
      {items.map((item) => (
        <li key={item.id} className="px-4 py-2 text-sm">
          {renderItem(item)}
        </li>
      ))}
    </ul>
  );
}
