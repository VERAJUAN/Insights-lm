
import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  src?: string | null;
  alt?: string;
}

const Logo = ({ size = 'md', className = '', src, alt }: LogoProps) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10', 
    lg: 'w-14 h-14'
  };

  const iconSizes = {
    sm: '24px',
    md: '32px',
    lg: '40px'
  };

  // Handle data URLs (base64), relative paths, or regular URLs
  let imageSrc = src || "/favicon.png";
  
  // If it's a data URL (base64) or starts with http/https, use it directly
  // Otherwise, if it starts with /, it's a relative path from public folder
  if (src) {
    if (src.startsWith('data:') || src.startsWith('http://') || src.startsWith('https://')) {
      imageSrc = src;
    } else if (src.startsWith('/')) {
      imageSrc = src;
    }
  }

  return (
    <div className={`${sizeClasses[size]} flex items-center justify-center overflow-hidden ${className}`}>
      <img 
        src={imageSrc} 
        alt={alt || "Logo"} 
        style={{ width: iconSizes[size], height: iconSizes[size] }}
        onError={(e) => {
          // Fallback to default logo if image fails to load
          if (imageSrc !== "/favicon.png") {
            (e.target as HTMLImageElement).src = "/favicon.png";
          }
        }}
      />
    </div>
  );
};

export default Logo;
