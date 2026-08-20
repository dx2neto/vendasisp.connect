import { QueryClient } from '@tanstack/react-query';

/**
 * Configuração otimizada do React Query:
 * - staleTime: dados frescos por 30s (evita refetch desnecessário)
 * - gcTime: cache mantido por 5 min (previously cacheTime)
 * - refetchOnWindowFocus: desativado para reduzir carga
 * - retry: 1 tentativa com backoff exponencial
 * - refetchOnMount: só refetch se dados estiverem stale
 */
export const queryClientInstance = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnMount: true,
      refetchOnReconnect: true,
      retry: 1,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: 0,
    },
  },
});