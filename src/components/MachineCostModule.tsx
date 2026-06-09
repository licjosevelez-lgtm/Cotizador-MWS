import React, { useState } from 'react';
import { Machine, VolumeParameters } from '../types';
import { Trash2, Plus, Upload, ClipboardCheck, Edit3, Settings, Save, X, RotateCcw } from 'lucide-react';
import Swal from 'sweetalert2';

interface MachineCostModuleProps {
  machines: Machine[];
  volParams: VolumeParameters;
  onUpdateMachines: (machines: Machine[]) => void;
}

export const MachineCostModule: React.FC<MachineCostModuleProps> = ({
  machines,
  volParams,
  onUpdateMachines,
}) => {
  // Local state for adding/editing individual machine
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCost, setEditCost] = useState('');

  const [newName, setNewName] = useState('');
  const [newCost, setNewCost] = useState('');

  // Excel paste mode
  const [pasteMode, setPasteMode] = useState<'import' | 'update' | null>(null);
  const [rawPasteText, setRawPasteText] = useState('');
  const [pasteError, setPasteError] = useState<string | null>(null);

  const startEdit = (machine: Machine) => {
    setEditingId(machine.id);
    setEditName(machine.name);
    setEditCost(machine.baseCost.toString());
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = () => {
    if (!editName.trim() || isNaN(parseFloat(editCost))) {
      return;
    }
    const updated = machines.map((m) =>
      m.id === editingId ? { ...m, name: editName.trim(), baseCost: parseFloat(editCost) } : m
    );
    onUpdateMachines(updated);
    setEditingId(null);
  };

  const addMachine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || isNaN(parseFloat(newCost))) return;

    const newMachine: Machine = {
      id: `m-${Date.now()}`,
      name: newName.trim(),
      baseCost: parseFloat(newCost),
    };
    onUpdateMachines([...machines, newMachine]);
    setNewName('');
    setNewCost('');
  };

  const deleteMachine = (id: string, name: string) => {
    Swal.fire({
      title: '¿Eliminar máquina?',
      text: `¿Está seguro de que desea eliminar la máquina "${name}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        onUpdateMachines(machines.filter((m) => m.id !== id));
        Swal.fire({
          title: 'Eliminada',
          text: 'La máquina fue eliminada correctamente.',
          icon: 'success',
          confirmButtonColor: '#4f46e5'
        });
      }
    });
  };

  // Heavy-duty Excel / CSV Parser
  const parsePastedData = () => {
    if (!rawPasteText.trim()) return;

    const lines = rawPasteText.split(/\r?\n/);
    const parsed: Machine[] = [];
    let skipped = 0;

    lines.forEach((line) => {
      // Clean and split by tabs or commas
      const cells = line.split(/\t|,|;/).map((c) => c.trim());
      if (cells.length < 2) {
        skipped++;
        return;
      }

      const name = cells[0];
      // Clean numerical value (remove $, % and commas)
      const cleanCostStr = cells[1].replace(/[$\s,]/g, '');
      const costVal = parseFloat(cleanCostStr);

      // Verify names and numbers
      if (name && !isNaN(costVal)) {
        // Skip header lines or standard labels if detected
        if (name.toLowerCase() === '# maquina' || name.toLowerCase() === 'maquina' || name.toLowerCase() === 'mano de ob') {
          skipped++;
          return;
        }
        parsed.push({
          id: `m-excel-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          name: name,
          baseCost: costVal,
        });
      } else {
        skipped++;
      }
    });

    if (parsed.length === 0) {
      setPasteError('No se pudieron detectar filas válidas. Asegúrate de copiar el nombre de la máquina y su costo por hora.');
    } else {
      onUpdateMachines([...machines, ...parsed]);
      setRawPasteText('');
      setPasteError(null);
      setPasteMode(null);
      Swal.fire({
        title: 'Carga exitosa',
        text: `Se cargaron con éxito ${parsed.length} máquinas. (Filas ignoradas u omitidas: ${skipped})`,
        icon: 'success',
        confirmButtonColor: '#4f46e5'
      });
    }
  };

  const parsePastedDataForUpdate = () => {
    if (!rawPasteText.trim()) return;

    const lines = rawPasteText.split(/\r?\n/);
    let updatedCount = 0;
    let notFoundCount = 0;
    let skipped = 0;

    const updatedMachines = [...machines];

    lines.forEach((line) => {
      const cells = line.split(/\t|,|;/).map((c) => c.trim());
      if (cells.length < 2) {
        skipped++;
        return;
      }

      const nameInput = cells[0];
      const cleanCostStr = cells[1].replace(/[$\s,]/g, '');
      const costVal = parseFloat(cleanCostStr);

      if (nameInput && !isNaN(costVal)) {
        if (nameInput.toLowerCase() === '# maquina' || nameInput.toLowerCase() === 'maquina' || nameInput.toLowerCase() === 'mano de ob') {
          skipped++;
          return;
        }

        const matchIndex = updatedMachines.findIndex(
          (m) => m.name.toLowerCase().trim() === nameInput.toLowerCase().trim()
        );

        if (matchIndex !== -1) {
          updatedMachines[matchIndex] = {
            ...updatedMachines[matchIndex],
            baseCost: costVal,
          };
          updatedCount++;
        } else {
          notFoundCount++;
        }
      } else {
        skipped++;
      }
    });

    if (updatedCount === 0) {
      setPasteError('No se encontraron máquinas para actualizar. Verifica que los nombres de las máquinas coincidan con las existentes.');
    } else {
      onUpdateMachines(updatedMachines);
      setRawPasteText('');
      setPasteError(null);
      setPasteMode(null);
      Swal.fire({
        title: 'Actualización completada',
        text: `Máquinas actualizadas: ${updatedCount}. Nombres no encontrados: ${notFoundCount}. (Filas ignoradas: ${skipped})`,
        icon: 'success',
        confirmButtonColor: '#4f46e5'
      });
    }
  };

  return (
    <div className="space-y-6" id="machine-cost-module">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">Costo Hora Máquina</h2>
          <p className="text-sm text-gray-500">Administra o importa tus máquinas y evalúa las tarifas escaladas por volumen.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            id="btn-excel-paste"
            onClick={() => {
              setPasteMode(pasteMode === 'import' ? null : 'import');
              setPasteError(null);
            }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
              pasteMode === 'import'
                ? 'text-red-700 bg-red-50 border-red-200 hover:bg-red-100'
                : 'text-teal-700 bg-teal-50 border-teal-200 hover:bg-teal-100/70'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            {pasteMode === 'import' ? 'Cancelar Importar' : 'Pegar desde Excel'}
          </button>

          <button
            id="btn-update-base-cost"
            onClick={() => {
              setPasteMode(pasteMode === 'update' ? null : 'update');
              setPasteError(null);
            }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
              pasteMode === 'update'
                ? 'text-red-700 bg-red-50 border-red-200 hover:bg-red-100'
                : 'text-indigo-700 bg-indigo-50 border-indigo-200 hover:bg-indigo-100/70'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {pasteMode === 'update' ? 'Cancelar Actualizar' : 'Actualizar costo base'}
          </button>
        </div>
      </div>

      {pasteMode !== null && (
        <div className={`border rounded-xl p-5 space-y-4 ${
          pasteMode === 'update' 
            ? 'bg-indigo-50/50 border-indigo-100' 
            : 'bg-teal-50/50 border-teal-100'
        }`}>
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className={`text-xs font-bold flex items-center gap-1.5 ${
                pasteMode === 'update' ? 'text-indigo-900' : 'text-teal-900'
              }`}>
                {pasteMode === 'update' ? (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    Actualización de Costos de Máquinas Existentes
                  </>
                ) : (
                  <>
                    <ClipboardCheck className="w-4 h-4" />
                    Carga Rápida (Pega desde Excel / Archivo CSV)
                  </>
                )}
              </span>
              <p className={`text-xs leading-normal ${
                pasteMode === 'update' ? 'text-indigo-700' : 'text-teal-700'
              }`}>
                {pasteMode === 'update' ? (
                  'Pega lista de máquinas existentes y sus nuevos costos (Nombre<TAB>NuevoCosto). Solo se actualizarán las coincidencias exactas por nombre.'
                ) : (
                  'Selecciona las columnas en Excel (por ejemplo, Nombre de Máquina y Costo Base por Hora) y pégalas directamente debajo. Los símbolos de moneda ($) y comas se limpiarán de manera automática.'
                )}
              </p>
            </div>
            <button 
              id="close-paste-mode"
              onClick={() => setPasteMode(null)}
              className={`font-bold text-sm ${
                pasteMode === 'update' ? 'text-indigo-400 hover:text-indigo-600' : 'text-teal-400 hover:text-teal-600'
              }`}
            >
              ×
            </button>
          </div>

          <div className="space-y-2">
            <textarea
              id="paste-area"
              rows={5}
              placeholder={
                pasteMode === 'update'
                  ? "Pega lista de máquinas existentes y sus nuevos costos (Nombre[TAB]NuevoCosto):&#13;MP10	2.50&#13;MP25	3.10"
                  : "Ejemplo de copiado de Excel:&#13;MP10	2.04&#13;MP25	2.40&#13;MP50	1.80"
              }
              value={rawPasteText}
              onChange={(e) => setRawPasteText(e.target.value)}
              className={`w-full bg-white border rounded-xl p-3 text-xs font-mono focus:outline-none focus:ring-2 focus:border-transparent ${
                pasteMode === 'update'
                  ? 'border-indigo-200 focus:ring-indigo-400 placeholder-indigo-300'
                  : 'border-teal-200 focus:ring-teal-400 placeholder-teal-300'
              }`}
            />
            {pasteError && <p className="text-xs font-medium text-red-600">{pasteError}</p>}
          </div>

          <div className="flex justify-end gap-2">
            <button
              id="cancel-parsing"
              onClick={() => setPasteMode(null)}
              className={`text-xs font-medium px-3 py-1.5 ${
                pasteMode === 'update' ? 'text-indigo-700 hover:text-indigo-900' : 'text-teal-700 hover:text-teal-900'
              }`}
            >
              Cerrar
            </button>
            <button
              id="execute-parsing"
              onClick={pasteMode === 'update' ? parsePastedDataForUpdate : parsePastedData}
              className={`text-white text-xs font-semibold px-4 py-1.5 rounded-lg transition-colors cursor-pointer ${
                pasteMode === 'update' 
                  ? 'bg-indigo-600 hover:bg-indigo-700' 
                  : 'bg-teal-600 hover:bg-teal-700'
              }`}
            >
              {pasteMode === 'update' ? 'Procesar y Actualizar' : 'Procesar y Cargar'}
            </button>
          </div>
        </div>
      )}

      {/* Grid of Adding custom machine & Table showing calculations */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Simple Add Form */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 h-fit space-y-4">
          <h3 className="text-sm font-semibold text-gray-900 border-b border-gray-50 pb-2 flex items-center gap-1.5">
            <Plus className="w-4 h-4 text-indigo-600" />
            Nueva Prensa / Máquina
          </h3>
          <form onSubmit={addMachine} className="space-y-3">
            <div className="space-y-1">
              <label htmlFor="new-machine-name" className="text-xs font-medium text-gray-500">Nombre / ID</label>
              <input
                id="new-machine-name"
                type="text"
                placeholder="MP250"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                required
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="new-machine-cost" className="text-xs font-medium text-gray-500">Costo Base por Hora (USD)</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-400 text-xs">$</span>
                <input
                  id="new-machine-cost"
                  type="number"
                  step="0.0001"
                  placeholder="2.50"
                  value={newCost}
                  onChange={(e) => setNewCost(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg py-2 pl-6 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                  required
                />
              </div>
            </div>
            <button
              id="submit-machine"
              type="submit"
              className="w-full inline-flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold py-2 px-3 rounded-lg transition-colors shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              Añadir Máquina
            </button>
          </form>
        </div>

        {/* Dynamic calculation table */}
        <div className="lg:col-span-3 bg-white rounded-xl shadow-sm border border-gray-100 p-5 overflow-hidden">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Listado de Tarifas por Volumen</h3>
            <span className="text-[11px] bg-slate-100 text-slate-600 font-medium px-2.5 py-1 rounded-full">{machines.length} máquinas activas</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse" id="machines-table">
              <thead>
                <tr className="border-b border-gray-100 text-xs font-bold text-gray-400 uppercase tracking-wider">
                  <th className="py-2.5 pb-2"># Máquina</th>
                  <th className="py-2.5 pb-2">Costo Base</th>
                  <th className="py-2.5 pb-2 text-green-600 bg-green-50/30 px-2 rounded-t-lg">Alto ({volParams.altoPercentage}%)</th>
                  <th className="py-2.5 pb-2 text-blue-600 bg-blue-50/30 px-2">Medio ({volParams.medioPercentage}%)</th>
                  <th className="py-2.5 pb-2 text-amber-600 bg-amber-50/30 px-2">Bajo ({volParams.bajoPercentage}%)</th>
                  <th className="py-2.5 pb-2 text-purple-600 bg-purple-50/30 px-2 rounded-t-lg">Factory ({volParams.factoryPercentage}%)</th>
                  <th className="py-2.5 pb-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-xs font-medium">
                {machines.map((machine) => {
                  const isEditing = editingId === machine.id;

                  return (
                    <tr key={machine.id} className="hover:bg-slate-50/50 group transition-colors">
                      <td className="py-3 font-semibold text-gray-900">
                        {isEditing ? (
                          <input
                            id={`edit-machine-name-${machine.id}`}
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="bg-white border border-gray-300 rounded p-1 text-xs w-24 font-semibold"
                          />
                        ) : (
                          machine.name
                        )}
                      </td>
                      <td className="py-3 font-mono text-gray-600">
                        {isEditing ? (
                          <div className="relative">
                            <span className="absolute left-1 top-1 text-gray-400">$</span>
                            <input
                              id={`edit-machine-cost-${machine.id}`}
                              type="number"
                              step="0.0001"
                              value={editCost}
                              onChange={(e) => setEditCost(e.target.value)}
                              className="bg-white border border-gray-300 rounded p-1 pl-4 text-xs w-20 font-mono"
                            />
                          </div>
                        ) : (
                          `$${machine.baseCost.toFixed(4)}`
                        )}
                      </td>

                      {/* Scaled Columns with editable ratios info */}
                      <td className="py-3 font-mono text-green-700 bg-green-50/10 px-2 font-semibold">
                        {isEditing ? (
                          <span className="text-gray-400">-</span>
                        ) : (
                          `$${(machine.baseCost * (volParams.altoPercentage / 100)).toFixed(2)}`
                        )}
                      </td>

                      <td className="py-3 font-mono text-blue-700 bg-blue-50/10 px-2 font-semibold">
                        {isEditing ? (
                          <span className="text-gray-400">-</span>
                        ) : (
                          `$${(machine.baseCost * (volParams.medioPercentage / 100)).toFixed(2)}`
                        )}
                      </td>

                      <td className="py-3 font-mono text-amber-700 bg-amber-50/10 px-2 font-semibold">
                        {isEditing ? (
                          <span className="text-gray-400">-</span>
                        ) : (
                          `$${(machine.baseCost * (volParams.bajoPercentage / 100)).toFixed(2)}`
                        )}
                      </td>

                      <td className="py-3 font-mono text-purple-700 bg-purple-50/10 px-2 font-semibold">
                        {isEditing ? (
                          <span className="text-gray-400">-</span>
                        ) : (
                          `$${(machine.baseCost * (volParams.factoryPercentage / 100)).toFixed(2)}`
                        )}
                      </td>

                      <td className="py-3 text-right">
                        <div className="flex justify-end gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                          {isEditing ? (
                            <>
                              <button
                                id={`save-machine-${machine.id}`}
                                onClick={saveEdit}
                                className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                                title="Guardar"
                              >
                                <Save className="w-4 h-4" />
                              </button>
                              <button
                                id={`cancel-machine-${machine.id}`}
                                onClick={cancelEdit}
                                className="p-1 text-red-600 hover:bg-red-50 rounded"
                                title="Cancelar"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                id={`edit-machine-btn-${machine.id}`}
                                onClick={() => startEdit(machine)}
                                className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"
                                title="Editar"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                id={`delete-machine-btn-${machine.id}`}
                                onClick={() => deleteMachine(machine.id, machine.name)}
                                className="p-1 text-red-600 hover:bg-red-50 rounded"
                                title="Eliminar"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
