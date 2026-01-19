import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Card container following the "Calm" aesthetic.
 * No scale transforms or tilt effects per AGENT_CONTEXT design rules.
 * Uses ultra-subtle borders and clean rounded corners.
 */
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const TiltCard = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "bg-surface dark:bg-surface-dark border border-border rounded-xl p-4",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

TiltCard.displayName = "TiltCard";
