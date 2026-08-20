import { useState, useEffect, useMemo, useRef, useCallback } from "react";

/**
 * Debounce hook - retarda a atualização de um valor até que pare de mudar.
 * Reduz consultas desnecessárias durante digitação em campos de busca.
 */
export function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debounced;
}

/**
 * Hook de paginação genérico para listas.
 * Retorna a página atual, total de páginas, e funções de navegação.
 */
export function usePagination(items, perPage = 20) {
  const [page, setPage] = useState(1);

  const totalPages = Math.ceil(items.length / perPage);

  const paginated = useMemo(
    () => items.slice((page - 1) * perPage, page * perPage),
    [items, page, perPage]
  );

  const nextPage = useCallback(() => setPage((p) => Math.min(p + 1, totalPages)), [totalPages]);
  const prevPage = useCallback(() => setPage((p) => Math.max(p - 1, 1)), []);
  const goTo = useCallback((p) => setPage(Math.max(1, Math.min(p, totalPages))), [totalPages]);

  // Reset para página 1 quando a lista muda significativamente
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  return { page, perPage, totalPages, paginated, nextPage, prevPage, goTo, setPage };
}

/**
 * Hook para trackar se um componente está visível (Intersection Observer).
 * Útil para lazy loading de componentes pesados.
 */
export function useInView(options = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true);
        observer.unobserve(el);
      }
    }, { threshold: 0.1, ...options });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, inView };
}

/**
 * Hook para medir performance de uma operação assíncrona.
 */
export function usePerformance() {
  const start = useRef(null);

  const begin = useCallback(() => { start.current = performance.now(); }, []);
  const end = useCallback(() => {
    if (start.current) {
      const elapsed = performance.now() - start.current;
      start.current = null;
      return elapsed;
    }
    return 0;
  }, []);

  return { begin, end };
}