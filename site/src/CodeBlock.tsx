import { useRef, useState } from 'react';
import { Button } from '@ds/react';

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // file:// and other non-secure contexts: fall back to the legacy path.
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.append(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

export interface CodeBlockProps {
  /** Accessible name for the snippet. */
  label: string;
  /** The exact text the copy button places on the clipboard. */
  code: string;
}

/** Copy-pasteable command block; the copy control is a real ds Button. */
export function CodeBlock({ label, code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  return (
    <div className="code-block">
      <pre aria-label={label}>
        <code>{code}</code>
      </pre>
      <div className="code-copy">
        <Button
          size="sm"
          variant="secondary"
          onPress={() => {
            void copyText(code).then((ok) => {
              setCopied(ok);
              if (timer.current) clearTimeout(timer.current);
              timer.current = setTimeout(() => setCopied(false), 2000);
            });
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
    </div>
  );
}
