// components/Layout.js
import Head from 'next/head';
import { useState, useContext } from 'react';
import FirebaseContext from '../lib/FirebaseContext'; // Import the centralized context

export default function Layout({ children, userId, onAddProcessTitle, processTitles }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProcessName, setNewProcessName] = useState('');
  const [processDependency, setProcessDependency] = useState('');

  const handleConfirmAddProcess = async () => {
    if (!newProcessName.trim()) {
      alert("Process Name cannot be empty.");
      return;
    }
    if (onAddProcessTitle) {
      await onAddProcessTitle(newProcessName.trim(), processDependency);
    }
    setIsModalOpen(false);
    setNewProcessName('');
    setProcessDependency('');
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      <Head>
        <title>Verspeeten CI Management</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <header className="bg-gray-900 text-white p-4 shadow-md flex justify-between items-center">
        <h1 className="text-2xl font-bold">Verspeeten CI Management</h1>
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-300">User ID: {userId || 'N/A'}</span>
          <button
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
            onClick={() => setIsModalOpen(true)}
          >
            Add New Process Title
          </button>
        </div>
      </header>

      <main className="flex-grow">{children}</main>

      {/* Add Process Title Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
            <h3 className="text-xl font-bold mb-4 text-gray-800">Add New Process Title</h3>
            <label htmlFor="new-process-name" className="block text-sm font-medium text-gray-700 mb-1">Process Name:</label>
            <input
              type="text"
              id="new-process-name"
              className="w-full p-2 border border-gray-300 rounded-md mb-4"
              placeholder="e.g., Treatment Planning"
              value={newProcessName}
              onChange={(e) => setNewProcessName(e.target.value)}
            />

            <label htmlFor="process-dependency" className="block text-sm font-medium text-gray-700 mb-1">Depends on (Optional):</label>
            <select
              id="process-dependency"
              className="w-full p-2 border border-gray-300 rounded-md bg-white mb-4"
              value={processDependency}
              onChange={(e) => setProcessDependency(e.target.value)}
            >
              <option value="">-- No Dependency --</option>
              {processTitles.map(pt => (
                <option key={pt.id} value={pt.id}>{pt.name}</option>
              ))}
            </select>

            <div className="flex justify-end space-x-3 mt-4">
              <button
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors duration-200"
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                onClick={handleConfirmAddProcess}
              >
                Add Process
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}