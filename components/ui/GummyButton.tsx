import React from 'react';
import { cn } from '@/lib/utils';

interface GummyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export const GummyButton = React.forwardRef<HTMLButtonElement, GummyButtonProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all active:scale-95",
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
