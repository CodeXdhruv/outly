import { useQuery } from '@tanstack/react-query';
import type { User } from '../types';

export function useAuth() {
  const query = useQuery<User | null>({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const res = await fetch('/api/me');
      if (res.status === 401) return null;
      if (!res.ok) throw new Error('Failed to fetch user');
      return res.json();
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  return {
    user: query.data ?? null,
    isLoading: query.isLoading,
    isAuthenticated: !!query.data,
    refetch: query.refetch,
  };
}
