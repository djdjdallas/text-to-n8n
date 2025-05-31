import React from 'react';

const Card = ({ className = '', children, ...props }) => {
  return (
    <div 
      className={`rounded-lg border border-border bg-card p-4 shadow-sm ${className}`} 
      {...props}
    >
      {children}
    </div>
  );
};

const CardHeader = ({ className = '', children, ...props }) => {
  return (
    <div 
      className={`flex flex-col space-y-1.5 p-2 ${className}`} 
      {...props}
    >
      {children}
    </div>
  );
};

const CardTitle = ({ className = '', children, ...props }) => {
  return (
    <h3 
      className={`font-semibold text-lg text-foreground ${className}`} 
      {...props}
    >
      {children}
    </h3>
  );
};

const CardDescription = ({ className = '', children, ...props }) => {
  return (
    <p 
      className={`text-sm text-muted ${className}`} 
      {...props}
    >
      {children}
    </p>
  );
};

const CardContent = ({ className = '', children, ...props }) => {
  return (
    <div 
      className={`p-2 pt-0 ${className}`} 
      {...props}
    >
      {children}
    </div>
  );
};

const CardFooter = ({ className = '', children, ...props }) => {
  return (
    <div 
      className={`flex items-center p-2 pt-0 ${className}`} 
      {...props}
    >
      {children}
    </div>
  );
};

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };