type Props = {
  categories: string[];
  active: string;
  onSelect: (category: string) => void;
};

export const ALL_TAB = 'All';

export default function CategoryTabs({ categories, active, onSelect }: Props) {
  return (
    <div className="category-tabs">
      {[ALL_TAB, ...categories].map(cat => (
        <button
          key={cat}
          type="button"
          className={`category-tab ${cat === active ? 'category-tab--active' : ''}`}
          onClick={() => onSelect(cat)}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}
