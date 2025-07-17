// components/Modal.js
import { useState, useEffect } from 'react';

export function Modal({ title, onClose, onConfirm, initialName = '', initialDependency = '', initialSeq = 1, processTitles = [], subProcesses = [], isSubProcess = false }) {
  const [name, setName] = useState(initialName);
  const [dependency, setDependency] = useState(initialDependency);
  const [seq, setSeq] = useState(initialSeq);

  useEffect(() => {
    setName(initialName);
    setDependency(initialDependency);
    setSeq(initialSeq);
  }, [initialName, initialDependency, initialSeq]);

  const handleConfirm = () => {
    if (!name.trim()) {
      alert("Name cannot be empty.");
      return;
    }
    if (isSubProcess) {
      onConfirm(name, dependency, seq); // Pass dependency and seq for sub-process
    } else {
      onConfirm(name, dependency); // Name and dependency for process title
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-10 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
        </div>
        <label htmlFor="name-input" className="block text-sm font-medium text-gray-700 mb-1">Name:</label>
        <input
          type="text"
          id="name-input"
          className="w-full p-2 border border-gray-300 rounded-md mb-4"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        {/* Sequence number input for sub-processes */}
        {isSubProcess && (
          <>
            <label htmlFor="seq-input" className="block text-sm font-medium text-gray-700 mb-1">Sequence Number:</label>
            <input
              type="number"
              id="seq-input"
              className="w-full p-2 border border-gray-300 rounded-md mb-4"
              value={seq}
              onChange={(e) => setSeq(parseInt(e.target.value) || 1)}
              min="1"
            />
          </>
        )}

        {/* Dependency dropdown for process titles and sub-processes */}
        {(!isSubProcess && processTitles.length > 0) && (
          <>
            <label htmlFor="dependency-select" className="block text-sm font-medium text-gray-700 mb-1">Depends on (Optional):</label>
            <select
              id="dependency-select"
              className="w-full p-2 border border-gray-300 rounded-md bg-white mb-4"
              value={dependency}
              onChange={(e) => setDependency(e.target.value)}
            >
              <option value="">-- No Dependency --</option>
              {processTitles.map(pt => (
                <option key={pt.id} value={pt.id}>{pt.name}</option>
              ))}
            </select>
          </>
        )}
        {(isSubProcess) && (
          <>
            <label htmlFor="subprocess-dependency-select" className="block text-sm font-medium text-gray-700 mb-1">Depends on (Optional):</label>
            <select
              id="subprocess-dependency-select"
              className="w-full p-2 border border-gray-300 rounded-md bg-white mb-4"
              value={dependency}
              onChange={(e) => setDependency(e.target.value)}
              disabled={subProcesses.length === 0}
            >
              <option value="">-- No Dependency --</option>
              {subProcesses.map(sp => (
                <option key={sp.id} value={sp.id}>{sp.name}</option>
              ))}
            </select>
          </>
        )}

        <div className="flex justify-end space-x-3 mt-4">
          <button
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors duration-200"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
            onClick={handleConfirm}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}