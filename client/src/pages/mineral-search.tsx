import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Plus, Minus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import type { Mineral } from '@shared/schema';

export default function MineralSearchPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [exactMatchMode, setExactMatchMode] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());

  const { data, isLoading, error } = useQuery({
    queryKey: [`/api/minerals/search?q=${encodeURIComponent(activeSearch)}`],
    enabled: activeSearch.length > 0,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveSearch(searchQuery);
  };

  const rawMinerals = (data as { results: any[] })?.results || [];
  
  let filteredMinerals = rawMinerals;
  if (exactMatchMode && activeSearch) {
    const exactMatch = rawMinerals.find(m => m.name?.toLowerCase() === activeSearch.toLowerCase());
    filteredMinerals = exactMatch ? [exactMatch] : rawMinerals;
  }
  
  const minerals = filteredMinerals.sort((a, b) => {
    const searchLower = activeSearch.toLowerCase();
    const aExactMatch = a.name?.toLowerCase() === searchLower;
    const bExactMatch = b.name?.toLowerCase() === searchLower;
    
    if (aExactMatch && !bExactMatch) return -1;
    if (!aExactMatch && bExactMatch) return 1;
    return 0;
  });
  
  const toggleGroupExpansion = (mineralId: number) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(mineralId)) {
      newExpanded.delete(mineralId);
    } else {
      newExpanded.add(mineralId);
    }
    setExpandedGroups(newExpanded);
  };
  
  const { data: groupMembersData } = useQuery({
    queryKey: expandedGroups.size > 0 ? [`/api/minerals/search?q=${encodeURIComponent(activeSearch)}&page_size=50`] : [],
    enabled: expandedGroups.size > 0,
  });

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
                {exactMatchMode ? 'Exact Match' : 'Containing'}
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
              <p className="text-muted-foreground">No minerals found matching "{activeSearch}"</p>
            </CardContent>
          </Card>
        )}

        {!isLoading && minerals.length > 0 && (
          <div className="grid gap-4" data-testid="list-minerals">
            {minerals.map((mineral) => {
              const formula = convertToUTF8Formula(mineral.mindat_formula || mineral.ima_formula || '');
              const strunzCode = getStrunzCode(mineral);
              const isGroup = mineral.name?.toLowerCase().includes('group') || 
                             mineral.name?.toLowerCase().includes('series');
              const isExpanded = expandedGroups.has(mineral.id);
              const groupMembers = isExpanded && groupMembersData 
                ? (groupMembersData as { results: any[] }).results.filter((m: any) => 
                    m.id !== mineral.id && 
                    m.name?.toLowerCase().includes(mineral.name?.toLowerCase().replace(/\s+(group|series)$/i, ''))
                  )
                : [];
              
              return (
                <div key={mineral.id}>
                  <Card data-testid={`card-mineral-${mineral.id}`}>
                    <CardHeader>
                      <div className="flex items-start gap-2">
                        {isGroup && (
                          <button
                            onClick={() => toggleGroupExpansion(mineral.id)}
                            className="flex-shrink-0 w-6 h-6 rounded-full bg-[#EE2C25] flex items-center justify-center text-white hover:bg-[#cc0000] transition-colors mt-1"
                            data-testid={`button-expand-${mineral.id}`}
                            aria-label={isExpanded ? 'Collapse' : 'Expand'}
                          >
                            {isExpanded ? (
                              <Minus size={14} strokeWidth={3} />
                            ) : (
                              <Plus size={14} strokeWidth={3} />
                            )}
                          </button>
                        )}
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
                      <div className="text-sm">
                        {strunzCode && (
                          <div data-testid={`text-mineral-strunz-${mineral.id}`}>
                            <span className="text-muted-foreground">Strunz:</span>{' '}
                            <span className="font-medium">{strunzCode}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                  
                  {isExpanded && groupMembers.length > 0 && (
                    <div className="ml-10 mt-2 space-y-2" data-testid={`group-members-${mineral.id}`}>
                      {groupMembers.map((member: any) => {
                        const memberFormula = convertToUTF8Formula(member.mindat_formula || member.ima_formula || '');
                        const memberStrunz = getStrunzCode(member);
                        
                        return (
                          <Card key={member.id} className="bg-muted/30" data-testid={`card-mineral-${member.id}`}>
                            <CardHeader className="py-3">
                              <CardTitle className="text-base" data-testid={`text-mineral-name-${member.id}`}>
                                {member.name}
                              </CardTitle>
                              {memberFormula && (
                                <CardDescription className="text-sm" data-testid={`text-mineral-formula-${member.id}`}>
                                  {memberFormula}
                                </CardDescription>
                              )}
                            </CardHeader>
                            {memberStrunz && (
                              <CardContent className="py-2">
                                <div className="text-xs" data-testid={`text-mineral-strunz-${member.id}`}>
                                  <span className="text-muted-foreground">Strunz:</span>{' '}
                                  <span className="font-medium">{memberStrunz}</span>
                                </div>
                              </CardContent>
                            )}
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
