import { Atom, ChevronRight, Gauge, Layers3, Orbit, Radio, Route, Waves, Zap } from 'lucide-react';

interface CategoryArtworkProps { category: string; subcategory: string }

function categoryIcon(category: string) {
  const key = category.toUpperCase();
  return key.includes('ANEL') ? Orbit : key === 'LINAC' ? Zap : key === 'BOOSTER' ? Gauge
    : key === 'RF' ? Radio : key === 'BEAMLINES' ? Waves : ['BTS', 'LTB'].includes(key) ? Route
      : key === 'IDS' ? Atom : Layers3;
}

/** A mesma decoração preenche o cabeçalho da grade e toda a linha da lista. */
export function CategoryArtDecoration({ category }: Pick<CategoryArtworkProps, 'category'>) {
  const Icon = categoryIcon(category);
  return (
    <div className="chartlink-art-decoration" aria-hidden="true">
      <div className="chartlink-art-orbit" />
      <Icon className="chartlink-art-watermark" strokeWidth={0.8} />
    </div>
  );
}

export function CategoryIdentity({ category, subcategory, variant = 'grid' }: CategoryArtworkProps & { variant?: 'grid' | 'list' }) {
  const Icon = categoryIcon(category);
  const path = subcategory.split('/').map(name => name.trim()).filter(Boolean);
  return (
    <div className={'chartlink-art-content' + (variant === 'list' ? ' chartlink-list-identity' : '')}>
      <div className="chartlink-art-symbol" aria-hidden="true"><Icon size={18} strokeWidth={1.6} /></div>
      <div className="chartlink-art-labels">
        <p className={'chartlink-art-category' + (variant === 'grid' ? ' line-clamp-2' : '')} title={category}>{category}</p>
        {subcategory && (variant === 'grid'
          ? <span className="chartlink-card-subcategory chartlink-art-subcategory line-clamp-2" title={subcategory}>{subcategory}</span>
          : <p className="chartlink-list-path" aria-label={subcategory}>{path.map((name, index) => (
            <span key={`${index}:${name}`} className="chartlink-path-segment">
              {index > 0 && <ChevronRight size={12} aria-hidden="true" />}
              <span>{name}</span>
            </span>
          ))}</p>)}
      </div>
    </div>
  );
}

export function CategoryArtwork(props: CategoryArtworkProps) {
  return <div className="chartlink-category-art">
    <CategoryArtDecoration category={props.category} />
    <CategoryIdentity {...props} />
  </div>;
}
