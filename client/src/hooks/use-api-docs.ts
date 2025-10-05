import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { APICategory, APIEndpoint, SavedRequest } from '@/types/api';
import { useToast } from '@/hooks/use-toast';

export function useApiDocs() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: categories,
    isLoading: categoriesLoading,
    error: categoriesError
  } = useQuery({
    queryKey: ['/api/docs/categories'],
    staleTime: 1000 * 60 * 5,
  });

  const {
    data: savedRequests,
    isLoading: savedRequestsLoading,
    error: savedRequestsError
  } = useQuery({
    queryKey: ['/api/saved-requests'],
  });

  const sendRequest = useMutation({
    mutationFn: async ({ endpoint, parameters }: { endpoint: APIEndpoint, parameters: Record<string, any> }) => {
      const response = await apiRequest('POST', '/api/proxy', {
        path: endpoint.path,
        method: endpoint.method,
        parameters,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Request sent successfully",
        description: "API response received"
      });
    },
    onError: (error) => {
      toast({
        title: "Request failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const saveRequest = useMutation({
    mutationFn: async ({ name, endpoint, parameters }: { name: string, endpoint: APIEndpoint, parameters: Record<string, any> }) => {
      const response = await apiRequest('POST', '/api/saved-requests', {
        name,
        endpointId: endpoint.id,
        parameters,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/saved-requests'] });
      toast({
        title: "Request saved",
        description: "Your API request has been saved"
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to save request",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const deleteSavedRequest = useMutation({
    mutationFn: async (requestId: number) => {
      await apiRequest('DELETE', `/api/saved-requests/${requestId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/saved-requests'] });
      toast({
        title: "Request deleted",
        description: "Your saved request has been deleted"
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to delete request",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  return {
    categories: categories as APICategory[],
    categoriesLoading,
    categoriesError,
    savedRequests: savedRequests as SavedRequest[],
    savedRequestsLoading,
    savedRequestsError,
    sendRequest,
    saveRequest,
    deleteSavedRequest,
  };
}
