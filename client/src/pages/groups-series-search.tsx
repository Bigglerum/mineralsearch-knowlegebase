import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Plus, Minus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function GroupsSeriesSearchPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [expandedSubgroups, setExpandedSubgroups] = useState<Set<number>>(new Set());

  const { data, isLoading, error } = useQuery({
    queryKey: [`/api/groups-series/search?q=${encodeURIComponent(activeSearch)}`],
    enabled: activeSearch.length > 0,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveSearch(searchQuery);
  };

  const results = (data as { results: any[] })?.results || [];

  const toggleExpansion = (itemId: number) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  const toggleSubgroupExpansion = (subgroupId: number) => {
    const newExpanded = new Set(expandedSubgroups);
    if (newExpanded.has(subgroupId)) {
      newExpanded.delete(subgroupId);
    } else {
      newExpanded.add(subgroupId);
    }
    setExpandedSubgroups(newExpanded);
  };

  const { data: membersData } = useQuery({
    queryKey: expandedItems.size > 0 ? [`/api/minerals/search?q=${encodeURIComponent(activeSearch)}&page_size=100`] : [],
    enabled: expandedItems.size > 0,
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

  const getMembersForItem = (item: any) => {
    if (!membersData) return [];
    
    const allResults = (membersData as { results: any[] }).results;
    const baseName = item.name?.toLowerCase().replace(/\s+(group|series|supergroup)$/i, '');
    
    return allResults.filter((m: any) => 
      m.id !== item.id && 
      m.name?.toLowerCase().includes(baseName) &&
      m.entrytype_text?.toLowerCase() !== 'group' &&
      m.entrytype_text?.toLowerCase() !== 'series' &&
      m.entrytype_text?.toLowerCase() !== 'supergroup'
    );
  };

  const getSubgroupsForSupergroup = (supergroup: any) => {
    if (!membersData) return [];
    
    const allResults = (membersData as { results: any[] }).results;
    const baseName = supergroup.name?.toLowerCase().replace(/\s+supergroup$/i, '');
    
    return allResults.filter((m: any) => 
      m.id !== supergroup.id && 
      m.name?.toLowerCase().includes(baseName) &&
      (m.entrytype_text?.toLowerCase() === 'group' || m.entrytype_text?.toLowerCase() === 'series')
    );
  };

  return (
    <div className="min-h-screen pb-40 pt-20 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" data-testid="text-page-title">Groups & Series Search</h1>
          <p className="text-muted-foreground">Search for mineral groups, series, and supergroups</p>
        </div>

        <form onSubmit={handleSearch} className="mb-6">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
              <Input
                data-testid="input-groups-series-search"
                type="text"
                placeholder="Search groups, series, supergroups..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button type="submit" data-testid="button-search">
              Search
            </Button>
          </div>
        </form>

        {isLoading && (
          <div className="text-center py-12" data-testid="text-loading">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Searching...</p>
          </div>
        )}

        {error && (
          <Card className="border-destructive" data-testid="card-error">
            <CardContent className="pt-6">
              <p className="text-destructive">Error loading results. Please try again.</p>
            </CardContent>
          </Card>
        )}

        {!isLoading && !error && activeSearch && results.length === 0 && (
          <Card data-testid="card-no-results">
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground">No groups or series found matching "{activeSearch}"</p>
            </CardContent>
          </Card>
        )}

        {!isLoading && results.length > 0 && (
          <div className="grid gap-4" data-testid="list-groups-series">
            {results.map((item) => {
              const isSupergroup = item.entrytype_text?.toLowerCase() === 'supergroup';
              const isExpanded = expandedItems.has(item.id);
              const members = isExpanded ? getMembersForItem(item) : [];
              const subgroups = isSupergroup && isExpanded ? getSubgroupsForSupergroup(item) : [];

              return (
                <div key={item.id}>
                  <Card data-testid={`card-item-${item.id}`}>
                    <CardHeader>
                      <div className="flex items-start gap-2">
                        <button
                          onClick={() => toggleExpansion(item.id)}
                          className="flex-shrink-0 w-6 h-6 rounded-full bg-[#EE2C25] flex items-center justify-center text-white hover:bg-[#cc0000] transition-colors mt-1"
                          data-testid={`button-expand-${item.id}`}
                          aria-label={isExpanded ? 'Collapse' : 'Expand'}
                        >
                          {isExpanded ? (
                            <Minus size={14} strokeWidth={3} />
                          ) : (
                            <Plus size={14} strokeWidth={3} />
                          )}
                        </button>
                        <div className="flex-1">
                          <CardTitle data-testid={`text-item-name-${item.id}`}>{item.name}</CardTitle>
                          <CardDescription className="text-xs mt-1">
                            {item.entrytype_text}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>

                  {isExpanded && isSupergroup && subgroups.length > 0 && (
                    <div className="ml-10 mt-2 space-y-2" data-testid={`subgroups-${item.id}`}>
                      {subgroups.map((subgroup: any) => {
                        const subgroupExpanded = expandedSubgroups.has(subgroup.id);
                        const subgroupMembers = subgroupExpanded ? getMembersForItem(subgroup) : [];

                        return (
                          <div key={subgroup.id}>
                            <Card className="bg-muted/30">
                              <CardHeader className="py-3">
                                <div className="flex items-start gap-2">
                                  <button
                                    onClick={() => toggleSubgroupExpansion(subgroup.id)}
                                    className="flex-shrink-0 w-5 h-5 rounded-full bg-[#EE2C25] flex items-center justify-center text-white hover:bg-[#cc0000] transition-colors"
                                    data-testid={`button-expand-subgroup-${subgroup.id}`}
                                  >
                                    {subgroupExpanded ? (
                                      <Minus size={12} strokeWidth={3} />
                                    ) : (
                                      <Plus size={12} strokeWidth={3} />
                                    )}
                                  </button>
                                  <div className="flex-1">
                                    <CardTitle className="text-base" data-testid={`text-subgroup-name-${subgroup.id}`}>
                                      {subgroup.name}
                                    </CardTitle>
                                  </div>
                                </div>
                              </CardHeader>
                            </Card>

                            {subgroupExpanded && subgroupMembers.length > 0 && (
                              <div className="ml-8 mt-2 mb-2">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Mineral Name</TableHead>
                                      <TableHead>Formula</TableHead>
                                      <TableHead>Strunz Code</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {subgroupMembers.map((member: any) => (
                                      <TableRow key={member.id} data-testid={`row-member-${member.id}`}>
                                        <TableCell className="font-medium">{member.name}</TableCell>
                                        <TableCell>{convertToUTF8Formula(member.mindat_formula || member.ima_formula || '')}</TableCell>
                                        <TableCell>{getStrunzCode(member) || '-'}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {isExpanded && !isSupergroup && members.length > 0 && (
                    <div className="ml-10 mt-2 mb-2" data-testid={`members-${item.id}`}>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Mineral Name</TableHead>
                            <TableHead>Formula</TableHead>
                            <TableHead>Strunz Code</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {members.map((member: any) => (
                            <TableRow key={member.id} data-testid={`row-member-${member.id}`}>
                              <TableCell className="font-medium">{member.name}</TableCell>
                              <TableCell>{convertToUTF8Formula(member.mindat_formula || member.ima_formula || '')}</TableCell>
                              <TableCell>{getStrunzCode(member) || '-'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
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
