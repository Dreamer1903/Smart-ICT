import React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { Link } from '../../router/RouterContext';

export interface BreadcrumbItem {
  label: string;
  to?: string;
  current?: boolean;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items, className = '' }) => {
  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center space-x-2 text-xs text-neutral-500 dark:text-neutral-400 py-3 ${className}`}
    >
      <Link
        to="/"
        className="flex items-center space-x-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        title="Главная"
      >
        <Home className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Главная</span>
      </Link>

      {items.map((item, index) => {
        const isLast = index === items.length - 1 || item.current;

        return (
          <React.Fragment key={index}>
            <ChevronRight className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-600 shrink-0" />
            {isLast || !item.to ? (
              <span className="font-medium text-neutral-900 dark:text-neutral-100 truncate max-w-[200px] sm:max-w-md">
                {item.label}
              </span>
            ) : (
              <Link
                to={item.to}
                className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate max-w-[150px] sm:max-w-xs"
              >
                {item.label}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
