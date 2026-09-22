import { TextButton } from "../ui/TextButton.tsx";

export function TopBar<Name extends string>({
  sections,
  active,
  dateline,
  onSelect,
}: {
  sections: { name: Name; label: string }[];
  active: Name;
  dateline: string;
  onSelect: (name: Name) => void;
}) {
  return (
    <div className="topbar">
      <div className="tabs">
        {sections.map((section) => (
          <TextButton key={section.name} active={section.name === active} onSelect={() => onSelect(section.name)}>
            {section.label}
          </TextButton>
        ))}
      </div>
      <div className="dateline">{dateline}</div>
    </div>
  );
}
