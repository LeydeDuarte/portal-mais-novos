import Header from './Header';
import FilterBar from './FilterBar';
import MasonryFeed from './MasonryFeed';
import Footer from './Footer';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <FilterBar />
      <MasonryFeed />
      <Footer />
    </div>
  );
}
