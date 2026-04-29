import React from 'react';

export default function SafeAreaWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)"
      }}
      className="w-full h-full flex flex-col"
    >
      {children}
    </div>
  );
}
