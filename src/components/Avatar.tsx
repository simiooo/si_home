import React from "react";
interface AvatarProps {
  src?: string;
  size?: "sm" | "md" | "lg";
}
const Avatar: React.FC<AvatarProps> = ({ src, size = "md" }) => {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
  };
  const [imageError, setImageError] = React.useState(false);
  
  return (!src || imageError) ? (
    <div
      className={`${sizeClasses[size]} shrink-0 rounded-full bg-teal-700 `}
    />
  ) : (
    <img
      src={src}
      alt="Avatar"
      draggable={false}
      onError={() => {
        
        setImageError(true);
      }}
      onLoadedData={() => {
      }}
      className={`${sizeClasses[size]} shrink-0  object-cover  transition-transform hover:rotate-z-12 hover:scale-105`}
      style={{ transformStyle: "preserve-3d" }}
    />
  );
};
export default Avatar;
