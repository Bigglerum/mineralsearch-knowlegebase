import { Grid3x3 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function StrunzPage() {
  return (
    <div className="min-h-screen pb-40 pt-20 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2" data-testid="text-page-title">
            <Grid3x3 className="text-primary" />
            Strunz Classification
          </h1>
          <p className="text-muted-foreground">Browse minerals by Strunz classification system</p>
        </div>

        <Card>
          <CardContent className="pt-6 text-center py-12">
            <Grid3x3 size={64} className="text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Coming Soon</h3>
            <p className="text-muted-foreground">
              Strunz classification browser will be integrated here.
              <br />
              Ready to accept your classification code and template.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
