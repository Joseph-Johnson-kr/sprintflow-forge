import type { ReactNode } from 'react';

interface Props {
  title: string;
  message: string;
  action?: ReactNode;
}

export default function EmptyState({ title, message, action }: Props) {
  return (
    <div className="h-full flex items-center justify-center p-12">
      <div className="text-center max-w-md">
        <h2 className="text-xl font-semibold text-slate-900 mb-2">{title}</h2>
        <p className="text-sm text-slate-500 mb-4">{message}</p>
        {action}
      </div>
    </div>
  );
}
