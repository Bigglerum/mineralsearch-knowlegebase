import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

export default function LocalitySearchPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearch, setActiveSearch] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: [`/api/localities/search?name=${encodeURIComponent(activeSearch)}`],
    enabled: activeSearch.length > 0,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveSearch(searchQuery);
  };

  const localities = (data as { results: any[] })?.results || [];

  return (
    <div className="min-h-screen pb-40 pt-20 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2" data-testid="text-page-title">
            <MapPin className="text-primary" />
            Locality Search
          </h1>
          <p className="text-muted-foreground">Search mineral localities worldwide (Live Mindat API)</p>
        </div>

        <form onSubmit={handleSearch} className="mb-6">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
              <Input
                data-testid="input-locality-search"
                type="text"
                placeholder="Search localities..."
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
            <p className="mt-4 text-muted-foreground">Searching localities...</p>
          </div>
        )}

        {error && (
          <Card className="border-destructive" data-testid="card-error">
            <CardContent className="pt-6">
              <p className="text-destructive">Error loading localities. Please check your Mindat API credentials.</p>
            </CardContent>
          </Card>
        )}

        {!isLoading && !error && activeSearch && localities.length === 0 && (
          <Card data-testid="card-no-results">
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground">No localities found matching "{activeSearch}"</p>
            </CardContent>
          </Card>
        )}

        {!isLoading && localities.length > 0 && (
          <div className="grid gap-4" data-testid="list-localities">
            {localities.map((locality: any) => (
              <Card key={locality.id} className="hover-elevate" data-testid={`card-locality-${locality.id}`}>
                <CardHeader>
                  <CardTitle data-testid={`text-locality-name-${locality.id}`}>{locality.name}</CardTitle>
                  {(locality.country || locality.region) && (
                    <CardDescription>
                      {[locality.region, locality.country].filter(Boolean).join(', ')}
                    </CardDescription>
                  )}
                </CardHeader>
                {locality.description && (
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-2">{locality.description}</p>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
