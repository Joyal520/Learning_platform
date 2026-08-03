import { ArrowUpRight, Clock3 } from "lucide-react";
import type { ReactNode } from "react";

type ConfiguredActionProps = {
  href: string;
  children: ReactNode;
  className?: string;
  external?: boolean;
  showPendingIcon?: boolean;
};

export function ConfiguredAction({
  href,
  children,
  className = "button button-secondary",
  external = false,
  showPendingIcon = true,
}: ConfiguredActionProps) {
  if (!href) {
    return (
      <span className={`${className} button-disabled`} aria-disabled="true" title="This destination has not been configured yet">
        {children}
        {showPendingIcon ? <Clock3 aria-hidden="true" size={16} /> : null}
        <span className="sr-only"> — coming soon</span>
      </span>
    );
  }

  return (
    <a
      href={href}
      className={className}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {children}
      {external ? <ArrowUpRight aria-hidden="true" size={16} /> : null}
    </a>
  );
}
