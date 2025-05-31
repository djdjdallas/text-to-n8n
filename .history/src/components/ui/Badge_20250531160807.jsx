import React from "react";

const Badge = ({ children, variant = "default", className = "", ...props }) => {
  const variants = {
    default: "bg-primary text-white",
    secondary: "bg-secondary text-primary",
    outline: "border border-border bg-transparent",
    success: "bg-green-500 text-white",
    warning: "bg-yellow-500 text-white",
    error: "bg-red-500 text-white",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};

export default Badge;
