import { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  children: React.ReactNode;
  buttonType?: "primary" | "secondary" | "outline" | "link" | "danger";
  size?: "sm" | "md" | "lg";
  className?: string | undefined;
}

export function Button({
  children,
  buttonType = "primary",
  size = "md",
  loading = false,
  className,
  ...props
}: ButtonProps) {
  let internalClassName = "";

  if (loading) {
    internalClassName = "cursor-wait";
  }

  switch (buttonType) {
    case "primary":
      internalClassName +=
        "text-white bg-cyan-500 hover:bg-cyan-600 focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 transition-colors duration-200";
      break;
    case "danger":
      internalClassName +=
        "text-white bg-red-500 hover:bg-red-600 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors duration-200";
      break;
    case "secondary":
      internalClassName +=
        "text-gray-700 bg-gray-100 hover:bg-gray-200 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors duration-200";
      break;
    case "outline":
      internalClassName +=
        "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors duration-200";
      break;
    case "link":
      internalClassName +=
        "bg-transparent text-black-700 border border-transparent hover:bg-black-50 focus:ring-2 focus:ring-black-500 focus:ring-offset-2 transition-colors duration-200";
      break;
    default:
      internalClassName +=
        "text-white bg-cyan-500 hover:bg-cyan-600 focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 transition-colors duration-200"; // Default to primary
  }

  switch (size) {
    case "sm":
      internalClassName += " px-2 py-0.5 text-xs rounded";
      break;
    case "md":
      internalClassName += " px-3 py-1.5 text-sm rounded-lg";
      break;
    case "lg":
      internalClassName += " px-4 py-2 text-base rounded-xl";
      break;
    default:
      internalClassName += " px-3 py-1.5 text-sm rounded-lg"; // Default to md
  }

  return (
    <button className={internalClassName + ` ${className}`} {...props}>
      {loading ? "Loading..." : children}
    </button>
  );
}
