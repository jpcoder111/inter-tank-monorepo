import { ReactElement } from "react";

interface SectionProps {
  icon: ReactElement;
  text: string;
  selected: boolean;
  onClick?: () => void;
}

export default function Section({
  icon,
  text,
  selected,
  onClick,
}: SectionProps) {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors text-white font-normal text-sm ${
        selected ? "bg-blue-800" : "hover:bg-blue-700"
      }`}
      onClick={onClick}
    >
      {icon}
      <p>{text}</p>
    </div>
  );
}
