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
    <div className="pt-top">
      <div className="flex items-baseline gap-[1.1rem] pb-[0.2rem]">
        {sections.map((section) => (
          <TextButton
            key={section.name}
            className={"my-[-0.3rem] py-2 text-heading font-bold tracking-[-0.02em] " + (section.name === active ? "text-text" : "text-faint hover:text-dim")}
            onSelect={() => onSelect(section.name)}
          >
            {section.label}
          </TextButton>
        ))}
      </div>
      <div className="pb-[0.4rem] text-meta text-dim">{dateline}</div>
    </div>
  );
}
