'use client';

import { AMENIDADES_PADRAO } from '@/lib/amenidades';

type Props = {
  selected: string[];
  onChange: (next: string[]) => void;
};

export default function AmenitiesCheckboxes({ selected, onChange }: Props) {
  const toggle = (item: string) => {
    onChange(selected.includes(item) ? selected.filter((a) => a !== item) : [...selected, item]);
  };

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {AMENIDADES_PADRAO.map((item) => (
        <label key={item} className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={selected.includes(item)} onChange={() => toggle(item)} />
          {item}
        </label>
      ))}
    </div>
  );
}
