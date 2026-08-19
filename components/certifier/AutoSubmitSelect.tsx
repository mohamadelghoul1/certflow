"use client";

// A <select> that submits its enclosing form the moment its value changes
// (used for "assign inspector" / "record outcome" style dropdowns). Pulled
// out into its own Client Component because the pages that use it need to
// stay Server Components (they fetch secure file links server-side) —
// event handlers can't live directly on an element rendered by a Server
// Component.
export function AutoSubmitSelect({
  action,
  hidden,
  name,
  defaultValue,
  className,
  children,
}: {
  action: (formData: FormData) => Promise<void>;
  hidden: Record<string, string>;
  name: string;
  defaultValue: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <form action={action}>
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <select name={name} defaultValue={defaultValue} onChange={(e) => e.currentTarget.form?.requestSubmit()} className={className}>
        {children}
      </select>
    </form>
  );
}
