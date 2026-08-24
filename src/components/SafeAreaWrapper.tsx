import React from 'react';

export default function SafeAreaWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        paddingTop: "env(safe-area-inset-top)",
      }}
      className="w-full min-h-full flex flex-col"
    >
      {children}
    </div>
  );
}
