import type { LucideIcon } from "lucide-react";

type IconLabelProps = {
  icon: LucideIcon;
  text: string;
};

export function IconLabel({ icon: Icon, text }: IconLabelProps) {
  return (
    <span className="status-pill">
      <Icon aria-hidden="true" size={16} />
      {text}
    </span>
  );
}
