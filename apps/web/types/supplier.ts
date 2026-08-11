export interface Supplier {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  tax_id: string | null;
  notes: string | null;
  is_active: boolean;
  // Present only if the caller has suppliers.see_money -- absent, not null,
  // when they don't.
  opening_balance?: string;
}
