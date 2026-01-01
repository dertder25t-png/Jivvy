import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Primary action button following the "Calm" aesthetic.
 * Uses Focus Blue (primary) as the accent color.
 * No scale transforms or "gummy" effects per AGENT_CONTEXT design rules.
 */
interface PrimaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export const GummyButton = React.forwardRef<HTMLButtonElement, PrimaryButtonProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium",
          "hover:bg-primary/90 transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

GummyButton.displayName = "GummyButton";
