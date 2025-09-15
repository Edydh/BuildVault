import React, { createContext, useContext } from 'react';
import { useSharedValue } from 'react-native-reanimated';

interface ScrollContextType {
  scrollY: ReturnType<typeof useSharedValue<number>>;
}

const ScrollContext = createContext<ScrollContextType | undefined>(undefined);

export const ScrollProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const scrollY = useSharedValue(0);

  return (
    <ScrollContext.Provider value={{ scrollY }}>
      {children}
    </ScrollContext.Provider>
  );
};

export const useScrollContext = () => {
  const context = useContext(ScrollContext);
  if (!context) {
    throw new Error('useScrollContext must be used within ScrollProvider');
  }
  return context;
};
