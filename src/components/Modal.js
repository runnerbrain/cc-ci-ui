// components/Modal.js
import { useState, useEffect } from 'react';

export function Modal({ title, onClose, onConfirm, initialName = '', initialDependency = '', processTitles = [], isSubProcess = false }) {
  const [name, setName] = useState(initialName);
  const [dependency, setDependency] = useState(initialDependency);

  useEffect(() => {
    setName(initialName);
    setDependency(initialDependency);
  }, [initialName, initialDependency]);

  const handleConfirm = () => {
    if (!name.trim()) {
      alert("Name cannot be empty.");
      return;
    }
    if (isSubProcess) {
      onConfirm(name); // Only name for sub-process
    } else {
      onConfirm(name, dependency); // Name and dependency for process title
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
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

        {!isSubProcess && ( // Only show dependency for process titles
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