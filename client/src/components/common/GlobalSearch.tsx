import { AnimatePresence, motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { useGlobalSearch } from '@/features/search/api';

export function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { data, isFetching } = useGlobalSearch(query);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hasResults = Boolean(data && (data.customers?.length || data.users?.length));

  return (
    <div ref={containerRef} className="relative w-full max-w-sm">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search customers, users…"
        className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      />
      <AnimatePresence>
        {open && query.trim().length > 1 && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className="absolute z-50 mt-1 w-full rounded-md border border-border bg-card p-2 text-sm shadow-md"
          >
            {isFetching && <p className="px-2 py-1 text-muted-foreground">Searching…</p>}
            {!isFetching && !hasResults && (
              <p className="px-2 py-1 text-muted-foreground">No results.</p>
            )}
            {data?.customers && data.customers.length > 0 && (
              <div className="mb-2">
                <p className="px-2 py-1 text-xs font-semibold uppercase text-muted-foreground">
                  Customers
                </p>
                {data.customers.map((c) => (
                  <div key={c._id} className="rounded px-2 py-1.5 hover:bg-muted">
                    {c.name} {c.email && <span className="text-muted-foreground">— {c.email}</span>}
                  </div>
                ))}
              </div>
            )}
            {data?.users && data.users.length > 0 && (
              <div>
                <p className="px-2 py-1 text-xs font-semibold uppercase text-muted-foreground">
                  Users
                </p>
                {data.users.map((u) => (
                  <div key={u.id} className="rounded px-2 py-1.5 hover:bg-muted">
                    {u.name} <span className="text-muted-foreground">— {u.email}</span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
