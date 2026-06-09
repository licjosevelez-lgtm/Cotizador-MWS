import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { PartNumber } from '../types';
import { INITIAL_PART_NUMBERS } from '../data/defaultData';
import Swal from 'sweetalert2';

export interface PartNumbersContextType {
  partNumbers: PartNumber[];
  setPartNumbers: React.Dispatch<React.SetStateAction<PartNumber[]>>;
  selectedIds: string[];
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  toggleSelectId: (id: string) => void;
  toggleSelectAll: () => void;
  deleteSelected: () => void;
}

const PartNumbersContext = createContext<PartNumbersContextType | undefined>(undefined);

export const PartNumbersProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [partNumbers, setPartNumbers] = useState<PartNumber[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from local storage initially
  useEffect(() => {
    try {
      const storedParts = localStorage.getItem('industrial_parts');
      if (storedParts) {
        setPartNumbers(JSON.parse(storedParts));
      } else {
        setPartNumbers(INITIAL_PART_NUMBERS);
      }
    } catch (e) {
      console.error('Failed to load parts from localStorage:', e);
      setPartNumbers(INITIAL_PART_NUMBERS);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save changes to localStorage when partNumbers changes
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('industrial_parts', JSON.stringify(partNumbers));
    }
  }, [partNumbers, isLoaded]);

  const toggleSelectId = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    const allSelected = partNumbers.length > 0 && selectedIds.length === partNumbers.length;
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(partNumbers.map((p) => p.id));
    }
  };

  const deleteSelected = () => {
    if (selectedIds.length === 0) {
      Swal.fire({
        title: 'Selección vacía',
        text: 'Por favor, selecciona al menos un número de parte para eliminar.',
        icon: 'warning',
        confirmButtonColor: '#4f46e5'
      });
      return;
    }

    Swal.fire({
      title: '¿Confirmar eliminación?',
      text: `¿Eliminar permanentemente ${selectedIds.length} número(s) de parte? Esta acción no se puede deshacer.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        const newPartNumbers = partNumbers.filter((p) => !selectedIds.includes(p.id));
        setPartNumbers(newPartNumbers);
        setSelectedIds([]); // Clear selection

        Swal.fire({
          title: 'Eliminados',
          text: 'Los números de parte han sido eliminados correctamente.',
          icon: 'success',
          confirmButtonColor: '#4f46e5'
        });
      }
    });
  };

  return (
    <PartNumbersContext.Provider
      value={{
        partNumbers,
        setPartNumbers,
        selectedIds,
        setSelectedIds,
        toggleSelectId,
        toggleSelectAll,
        deleteSelected,
      }}
    >
      {children}
    </PartNumbersContext.Provider>
  );
};

export const usePartNumbers = () => {
  const context = useContext(PartNumbersContext);
  if (!context) {
    throw new Error('usePartNumbers must be used within a PartNumbersProvider');
  }
  return context;
};
