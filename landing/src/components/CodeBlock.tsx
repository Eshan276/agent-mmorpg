import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export default function CodeBlock({
  children,
  prompt = '$',
  className = '',
}: {
  children: string;
  prompt?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* noop — older browsers */ }
  }

  return (
    <div className={`liquid-glass rounded-xl px-4 py-3 flex items-center gap-3 ${className}`}>
      <span className="text-white/30 select-none font-mono text-sm">{prompt}</span>
      <code className="flex-1 font-mono text-sm text-white overflow-x-auto whitespace-nowrap">
        {children}
      </code>
      <button
        type="button"
        onClick={copy}
        className="flex-shrink-0 w-8 h-8 rounded-md hover:bg-white/10 flex items-center justify-center transition-colors"
        aria-label="Copy"
      >
        {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} className="text-white/50" />}
      </button>
    </div>
  );
}
