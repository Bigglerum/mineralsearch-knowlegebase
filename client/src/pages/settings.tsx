import { Settings as SettingsIcon } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

export default function SettingsPage() {
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();

  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await apiRequest('POST', '/api/minerals/sync', {
        query: 'a',
        pageSize: 50,
        maxPages: 2,
      });
      const data = await response.json();
      
      toast({
        title: "Sync Complete",
        description: `Processed ${data.processed} minerals, ${data.failed} failed`,
      });
    } catch (error) {
      toast({
        title: "Sync Failed",
        description: "Unable to sync minerals from Mindat API",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="min-h-screen pb-40 pt-20 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2" data-testid="text-page-title">
            <SettingsIcon className="text-primary" />
            Settings
          </h1>
          <p className="text-muted-foreground">Manage app settings and data synchronization</p>
        </div>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Data Synchronization</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Sync mineral data from Mindat API to local database for faster searches.
              </p>
              <Button 
                onClick={handleSync} 
                disabled={syncing}
                data-testid="button-sync-minerals"
              >
                {syncing ? 'Syncing...' : 'Sync Minerals'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>About</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                e-Rocks Mineral Explorer - Powered by Mindat.org
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Version 1.0.0 (POC)
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
