import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import type { Mineral } from '@shared/schema';

export default function MineralSearchPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [exactMatchMode, setExactMatchMode] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: [`/api/minerals/search?q=${encodeURIComponent(activeSearch)}`],
    enabled: activeSearch.length > 0,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveSearch(searchQuery.trim());
  };

  const rawMinerals = (data as { results: any[] })?.results || [];
  
  const mineralsWithoutGroups = rawMinerals.filter((m: any) => {
    const entryType = m.entrytype_text?.toLowerCase() || '';
    return !entryType.includes('group') && !entryType.includes('series') && !entryType.includes('supergroup');
  });
  
  let filteredMinerals = mineralsWithoutGroups;
  let hasNonIMAMatch = false;
  
  if (exactMatchMode && activeSearch) {
    const exactMatch = mineralsWithoutGroups.find(m => {
      const nameMatches = m.name?.toLowerCase() === activeSearch.toLowerCase();
      const statusLower = (m.ima_status || '').toLowerCase();
      const isApprovedOrGrandfathered = statusLower.includes('approved') || statusLower.includes('grandfathered');
      return nameMatches && isApprovedOrGrandfathered;
    });
    
    hasNonIMAMatch = mineralsWithoutGroups.some(m => 
      m.name?.toLowerCase() === activeSearch.toLowerCase()
    );
    
    filteredMinerals = exactMatch ? [exactMatch] : [];
  }
  
  const minerals = filteredMinerals.sort((a, b) => {
    const searchLower = activeSearch.toLowerCase();
    const aExactMatch = a.name?.toLowerCase() === searchLower;
    const bExactMatch = b.name?.toLowerCase() === searchLower;
    
    if (aExactMatch && !bExactMatch) return -1;
    if (!aExactMatch && bExactMatch) return 1;
    return 0;
  });

  const relatedMineralIds = useMemo(() => {
    const ids = new Set<number>();
    minerals.forEach(m => {
      if (m.varietyof && m.varietyof > 0) ids.add(m.varietyof);
      if (m.synid && m.synid > 0) ids.add(m.synid);
    });
    return Array.from(ids);
  }, [minerals]);

  const { data: relatedMineralsData } = useQuery({
    queryKey: ['/api/minerals/batch', relatedMineralIds],
    enabled: relatedMineralIds.length > 0,
    queryFn: async () => {
      const results = await Promise.all(
        relatedMineralIds.map(id => 
          fetch(`/api/minerals/${id}`).then(res => res.ok ? res.json() : null)
        )
      );
      return results.filter(Boolean);
    }
  });

  const relatedMineralsMap = useMemo(() => {
    const map = new Map<number, string>();
    if (relatedMineralsData) {
      relatedMineralsData.forEach((m: any) => {
        if (m && m.id && m.name) {
          map.set(m.id, m.name);
        }
      });
    }
    return map;
  }, [relatedMineralsData]);

  const convertToUTF8Formula = (html: string) => {
    if (!html) return '';
    
    const subscriptMap: { [key: string]: string } = {
      '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
      '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
      'a': 'ₐ', 'e': 'ₑ', 'h': 'ₕ', 'i': 'ᵢ', 'j': 'ⱼ',
      'k': 'ₖ', 'l': 'ₗ', 'm': 'ₘ', 'n': 'ₙ', 'o': 'ₒ',
      'p': 'ₚ', 'r': 'ᵣ', 's': 'ₛ', 't': 'ₜ', 'u': 'ᵤ',
      'v': 'ᵥ', 'x': 'ₓ'
    };
    
    const superscriptMap: { [key: string]: string } = {
      '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
      '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
      '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
      'n': 'ⁿ'
    };
    
    const htmlEntities: { [key: string]: string } = {
      '&middot;': '·',
      '&nbsp;': ' ',
      '&times;': '×',
      '&deg;': '°',
      '&plusmn;': '±',
      '&lt;': '<',
      '&gt;': '>',
      '&amp;': '&'
    };
    
    let result = html;
    
    result = result.replace(/<sub>(.*?)<\/sub>/g, (match, content) => {
      return content.split('').map((char: string) => subscriptMap[char] || char).join('');
    });
    
    result = result.replace(/<sup>(.*?)<\/sup>/g, (match, content) => {
      return content.split('').map((char: string) => superscriptMap[char] || char).join('');
    });
    
    result = result.replace(/<mi>/g, '').replace(/<\/mi>/g, '');
    result = result.replace(/\{10_11\}/g, '{10̄11}');
    result = result.replace(/\{([0-9]+)_([0-9]+)\}/g, '{$1̄$2}');
    
    Object.entries(htmlEntities).forEach(([entity, char]) => {
      result = result.replace(new RegExp(entity, 'g'), char);
    });
    
    return result;
  };

  const getStrunzCode = (mineral: any) => {
    const { strunz10ed1, strunz10ed2, strunz10ed3, strunz10ed4 } = mineral;
    if (!strunz10ed1 || strunz10ed1 === '0') return null;
    
    const part1 = strunz10ed1;
    const part2 = (strunz10ed2 && strunz10ed2 !== '0') ? strunz10ed2.toUpperCase() : '';
    const part3 = (strunz10ed3 && strunz10ed3 !== '0') ? strunz10ed3.toUpperCase() : '';
    const part4 = (strunz10ed4 && strunz10ed4 !== '0' && strunz10ed4 !== '') ? strunz10ed4.padStart(2, '0') : '';
    
    const letterPart = part2 + part3;
    
    let code = part1;
    if (letterPart) code += `.${letterPart}`;
    if (part4) code += `.${part4}`;
    
    return code;
  };

  return (
    <div className="min-h-screen pb-40 pt-20 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" data-testid="text-page-title">Mineral Search</h1>
          <p className="text-muted-foreground">Search minerals by name</p>
        </div>

        <form onSubmit={handleSearch} className="mb-6">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
              <Input
                data-testid="input-mineral-search"
                type="text"
                placeholder="Search minerals..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button type="submit" data-testid="button-search">
              Search
            </Button>
          </div>
          
          <div className="flex items-center gap-3 mt-4">
            <label className="flex items-center gap-3 cursor-pointer" data-testid="toggle-exact-match">
              <input
                type="checkbox"
                className="erocks-toggle"
                checked={exactMatchMode}
                onChange={(e) => setExactMatchMode(e.target.checked)}
              />
              <span className="text-sm font-medium">
                {exactMatchMode ? 'IMA Search' : 'Containing'}
              </span>
            </label>
          </div>
        </form>

        {isLoading && (
          <div className="text-center py-12" data-testid="text-loading">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Searching minerals...</p>
          </div>
        )}

        {error && (
          <Card className="border-destructive" data-testid="card-error">
            <CardContent className="pt-6">
              <p className="text-destructive">Error loading minerals. Please try again.</p>
            </CardContent>
          </Card>
        )}

        {!isLoading && !error && activeSearch && minerals.length === 0 && (
          <Card data-testid="card-no-results">
            <CardContent className="pt-6 text-center">
              {exactMatchMode && hasNonIMAMatch ? (
                <p className="text-muted-foreground">
                  "{activeSearch}" is not an IMA approved mineral type, try removing the IMA search for all results.
                </p>
              ) : (
                <p className="text-muted-foreground">No minerals found matching "{activeSearch}"</p>
              )}
            </CardContent>
          </Card>
        )}

        {!isLoading && minerals.length > 0 && (
          <div className="grid gap-4" data-testid="list-minerals">
            {minerals.map((mineral) => {
              const formula = convertToUTF8Formula(mineral.mindat_formula || mineral.ima_formula || '');
              const strunzCode = getStrunzCode(mineral);
              
              return (
                <div key={mineral.id}>
                  <Card data-testid={`card-mineral-${mineral.id}`}>
                    <CardHeader>
                      <div className="flex items-start gap-2">
                        <div className="flex-1">
                          <CardTitle data-testid={`text-mineral-name-${mineral.id}`}>{mineral.name}</CardTitle>
                          {formula && (
                            <CardDescription data-testid={`text-mineral-formula-${mineral.id}`}>
                              {formula}
                            </CardDescription>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-between items-start text-sm">
                        <div>
                          {strunzCode && (
                            <div data-testid={`text-mineral-strunz-${mineral.id}`}>
                              <span className="text-muted-foreground">Strunz:</span>{' '}
                              <span className="font-medium">{strunzCode}</span>
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          {mineral.varietyof > 0 ? (
                            <div className="text-xs text-muted-foreground" data-testid={`text-mineral-variety-${mineral.id}`}>
                              {relatedMineralsMap.get(mineral.varietyof) 
                                ? `Variety of ${relatedMineralsMap.get(mineral.varietyof)}`
                                : 'Variety'}
                            </div>
                          ) : mineral.synid > 0 ? (
                            <div className="text-xs text-muted-foreground" data-testid={`text-mineral-synonym-${mineral.id}`}>
                              {relatedMineralsMap.get(mineral.synid)
                                ? `Synonym of ${relatedMineralsMap.get(mineral.synid)}`
                                : 'Synonym'}
                            </div>
                          ) : mineral.ima_status && mineral.ima_status.length === 0 && mineral.entrytype_text?.toLowerCase().includes('discredited') ? (
                            <div className="text-xs text-muted-foreground" data-testid={`text-mineral-discredited-${mineral.id}`}>
                              Discredited
                            </div>
                          ) : mineral.ima_status && mineral.ima_status.length > 0 ? (
                            <div className="text-xs text-muted-foreground" data-testid={`text-mineral-ima-status-${mineral.id}`}>
                              {mineral.ima_status.join(', ')}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
