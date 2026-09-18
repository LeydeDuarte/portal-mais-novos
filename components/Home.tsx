'use client';

import { useState } from 'react';
import Header from './Header';
import FilterBar from './FilterBar';
import MasonryFeed from './MasonryFeed';
import Footer from './Footer';
import { DEFAULT_FILTERS, type FilterState } from '@/lib/filters';

export default function Home() {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <FilterBar filters={filters} onChange={setFilters} />
      <MasonryFeed filters={filters} />
      <Footer />
    </div>
  );
}
