import { useQuery } from '@tanstack/react-query';
import { getHealth, queryKeys } from '@/services/api';
export const useHealth = () =>
  useQuery({
    queryKey: queryKeys.health,
    queryFn: getHealth,
    staleTime: 30000,
    retry: 1,
  });
