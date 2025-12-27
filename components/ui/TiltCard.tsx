import React from 'react';
import { cn } from '@/lib/utils';

interface TiltCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const TiltCard = React.forwardRef<HTMLDivElement, TiltCardProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "bg-surface border border-border rounded-xl p-4 transition-transform hover:scale-[1.01]",
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
