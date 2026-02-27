import { InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={id}
            className="block text-sm font-medium text-text-primary dark:text-text-dark-primary mb-1.5"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={cn(
            "w-full px-3 py-2 rounded-lg border border-border bg-surface text-text-primary placeholder:text-text-secondary",
            "focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent",
            "dark:bg-surface-dark-secondary dark:border-border-dark dark:text-text-dark-primary dark:placeholder:text-text-dark-secondary",
            "transition-colors duration-200",
            error && "border-error focus:ring-error",
            className
          )}
          {...props}
        />
        {error && (
          <p className="mt-1 text-sm text-error">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
export default Input;
