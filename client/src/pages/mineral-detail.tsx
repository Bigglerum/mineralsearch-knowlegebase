import { useQuery } from '@tanstack/react-query';
import { useRoute, Link } from 'wouter';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import type { Mineral } from '@shared/schema';

export default function MineralDetailPage() {
  const [, params] = useRoute('/mineral/:id');
  const mineralId = params?.id;

  const { data: mineral, isLoading, error } = useQuery<Mineral>({
    queryKey: [`/api/minerals/${mineralId}`],
    enabled: !!mineralId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen pb-40 pt-20 px-4">
        <div className="max-w-4xl mx-auto text-center py-12" data-testid="text-loading">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading mineral details...</p>
        </div>
      </div>
    );
  }

  if (error || !mineral) {
    return (
      <div className="min-h-screen pb-40 pt-20 px-4">
        <div className="max-w-4xl mx-auto">
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <p className="text-destructive">Mineral not found</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-40 pt-20 px-4">
      <div className="max-w-4xl mx-auto">
        <Link href="/search">
          <Button variant="ghost" className="mb-4" data-testid="button-back">
            <ArrowLeft size={20} className="mr-2" />
            Back to Search
          </Button>
        </Link>

        <div className="mb-6">
          <h1 className="text-4xl font-bold mb-2" data-testid="text-mineral-name">{mineral.name}</h1>
          {mineral.formula && (
            <p className="text-xl font-mono text-muted-foreground" data-testid="text-mineral-formula">
              {mineral.formula}
            </p>
          )}
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Physical Properties</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {mineral.crystalSystem && (
                  <div>
                    <dt className="text-sm text-muted-foreground">Crystal System</dt>
                    <dd className="font-medium" data-testid="text-crystal-system">{mineral.crystalSystem}</dd>
                  </div>
                )}
                {(mineral.hardnessMin !== null || mineral.hardnessMax !== null) && (
                  <div>
                    <dt className="text-sm text-muted-foreground">Mohs Hardness</dt>
                    <dd className="font-medium" data-testid="text-hardness">
                      {mineral.hardnessMin && mineral.hardnessMax 
                        ? `${mineral.hardnessMin} - ${mineral.hardnessMax}`
                        : mineral.hardnessMin || mineral.hardnessMax}
                    </dd>
                  </div>
                )}
                {(mineral.specificGravityMin !== null || mineral.specificGravityMax !== null) && (
                  <div>
                    <dt className="text-sm text-muted-foreground">Specific Gravity</dt>
                    <dd className="font-medium">
                      {mineral.specificGravityMin && mineral.specificGravityMax
                        ? `${mineral.specificGravityMin} - ${mineral.specificGravityMax}`
                        : mineral.specificGravityMin || mineral.specificGravityMax}
                    </dd>
                  </div>
                )}
                {mineral.colour && (
                  <div>
                    <dt className="text-sm text-muted-foreground">Colour</dt>
                    <dd className="font-medium">{mineral.colour}</dd>
                  </div>
                )}
                {mineral.lustre && (
                  <div>
                    <dt className="text-sm text-muted-foreground">Lustre</dt>
                    <dd className="font-medium">{mineral.lustre}</dd>
                  </div>
                )}
                {mineral.streak && (
                  <div>
                    <dt className="text-sm text-muted-foreground">Streak</dt>
                    <dd className="font-medium">{mineral.streak}</dd>
                  </div>
                )}
                {mineral.diaphaneity && (
                  <div>
                    <dt className="text-sm text-muted-foreground">Diaphaneity</dt>
                    <dd className="font-medium">{mineral.diaphaneity}</dd>
                  </div>
                )}
                {mineral.cleavage && (
                  <div>
                    <dt className="text-sm text-muted-foreground">Cleavage</dt>
                    <dd className="font-medium">{mineral.cleavage}</dd>
                  </div>
                )}
                {mineral.fracture && (
                  <div>
                    <dt className="text-sm text-muted-foreground">Fracture</dt>
                    <dd className="font-medium">{mineral.fracture}</dd>
                  </div>
                )}
                {mineral.tenacity && (
                  <div>
                    <dt className="text-sm text-muted-foreground">Tenacity</dt>
                    <dd className="font-medium">{mineral.tenacity}</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>

          {(mineral.imaFormula || mineral.imaStatus || mineral.strunzClass) && (
            <Card>
              <CardHeader>
                <CardTitle>Classification</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {mineral.imaFormula && (
                    <div>
                      <dt className="text-sm text-muted-foreground">IMA Formula</dt>
                      <dd className="font-mono font-medium">{mineral.imaFormula}</dd>
                    </div>
                  )}
                  {mineral.imaStatus && (
                    <div>
                      <dt className="text-sm text-muted-foreground">IMA Status</dt>
                      <dd className="font-medium">{mineral.imaStatus}</dd>
                    </div>
                  )}
                  {mineral.strunzClass && (
                    <div>
                      <dt className="text-sm text-muted-foreground">Strunz Classification</dt>
                      <dd className="font-medium">{mineral.strunzClass}</dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>
          )}

          {mineral.description && (
            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{mineral.description}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
