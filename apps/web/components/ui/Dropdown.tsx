import { Label } from "./Label";

export interface DropdownOption {
  value: string | number;
  label: string;
}

interface DropdownProps {
  options: DropdownOption[];
  value?: string | number;
  onChange?: (value: string | number) => void;
  placeholder?: string;
  className?: string;
  id: string;
  name: string;
  disabled?: boolean;
  label?: string;
}

export function Dropdown({
  options,
  value,
  onChange,
  placeholder = "Select an option...",
  className = "border border-gray-200 rounded-md p-2 h-10",
  id,
  name,
  disabled = false,
  label,
}: DropdownProps) {
  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = event.target.value;
    if (onChange) {
      // Convert to number if the original value was a number
      const option = options.find(
        (opt) => opt.value.toString() === selectedValue
      );
      if (option) {
        onChange(option.value);
      }
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        name={name}
        value={value || ""}
        onChange={handleChange}
        className={className}
        disabled={disabled}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
