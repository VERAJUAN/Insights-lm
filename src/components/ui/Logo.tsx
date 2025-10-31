
import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const Logo = ({ size = 'md', className = '' }: LogoProps) => {
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

  return (
    <div className={`${sizeClasses[size]} flex items-center justify-center overflow-hidden ${className}`}>
      <img 
        src="/favicon.png" 
        alt="Logo" 
        style={{ width: iconSizes[size], height: iconSizes[size] }}
      />
    </div>
  );
};

export default Logo;
