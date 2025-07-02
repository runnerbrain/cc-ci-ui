// components/AttributeForm.js
import { useState, useEffect, useContext } from 'react'; // Corrected this line
import FirebaseContext from '../lib/FirebaseContext'; // Import the centralized context

export default function AttributeForm({ subProcess, onSave }) {
  const [attributes, setAttributes] = useState({});
  const [newAttributeKey, setNewAttributeKey] = useState('');
  const [newAttributeValue, setNewAttributeValue] = useState('');

  // Use the context to get Firebase instances
  const firebaseContext = useContext(FirebaseContext);
  const db = firebaseContext?.db; // Access db from context
  const currentUserId = firebaseContext?.currentUserId;
  const firebaseAppId = firebaseContext?.firebaseAppId;

  // Update local state when subProcess prop changes
  useEffect(() => {
    if (subProcess) {
      // Deep copy attributes to avoid direct mutation of prop
      setAttributes(JSON.parse(JSON.stringify(subProcess.attributes || {})));
    }
  }, [subProcess]);

  const handleAttributeChange = (key, value, index = null) => {
    setAttributes(prevAttributes => {
      const newAttrs = { ...prevAttributes };
      if (index !== null && Array.isArray(newAttrs[key])) {
        newAttrs[key][index] = value;
      } else {
        newAttrs[key] = value;
      }
      return newAttrs;
    });
  };

  const handleAddValueToArray = (key, newValue) => {
    setAttributes(prevAttributes => {
      const newAttrs = { ...prevAttributes };
      if (Array.isArray(newAttrs[key])) {
        newAttrs[key].push(newValue);
      } else {
        newAttrs[key] = [newAttrs[key], newValue]; // Convert to array if not already
      }
      return newAttrs;
    });
  };

  const handleRemoveValueFromArray = (key, indexToRemove) => {
    setAttributes(prevAttributes => {
      const newAttrs = { ...prevAttributes };
      if (Array.isArray(newAttrs[key])) {
        newAttrs[key].splice(indexToRemove, 1);
        if (newAttrs[key].length === 0) {
          delete newAttrs[key]; // Remove attribute if array becomes empty
        }
      }
      return newAttrs;
    });
  };

  const handleRemoveAttribute = (key) => {
    setAttributes(prevAttributes => {
      const newAttrs = { ...prevAttributes };
      delete newAttrs[key];
      return newAttrs;
    });
  };

  const handleAddNewAttribute = () => {
    if (!newAttributeKey.trim()) {
      alert("Attribute name cannot be empty.");
      return;
    }
    if (attributes.hasOwnProperty(newAttributeKey.trim())) {
      alert(`Attribute "${newAttributeKey.trim()}" already exists.`);
      return;
    }

    setAttributes(prevAttributes => {
      const newAttrs = { ...prevAttributes };
      const value = newAttributeValue.trim();
      if (value.includes(',')) {
        newAttrs[newAttributeKey.trim()] = value.split(',').map(v => v.trim());
      } else {
        newAttrs[newAttributeKey.trim()] = value;
      }
      return newAttrs;
    });
    setNewAttributeKey('');
    setNewAttributeValue('');
  };

  const handleSave = () => {
    if (onSave && subProcess) {
      onSave({ ...subProcess, attributes });
    }
  };

  return (
    <div>
      {Object.keys(attributes).length === 0 && (
        <p className="text-gray-500 italic mb-4">No attributes defined. Add one below!</p>
      )}
      {Object.entries(attributes).map(([key, value]) => (
        <div key={key} className="relative group mb-4 border border-gray-200 p-3 rounded-md bg-gray-50">
          <button
            onClick={() => handleRemoveAttribute(key)}
            className="absolute top-1 right-1 p-1 rounded-full text-gray-400 hover:bg-red-100 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
            title={`Remove ${key} attribute`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </button>
          <label className="block text-sm font-medium text-gray-700 mb-2 font-bold">{key}:</label>
          {Array.isArray(value) ? (
            <>
              {value.map((val, index) => (
                <div key={index} className="flex items-center mb-2 space-x-2">
                  <input
                    type="text"
                    value={val}
                    onChange={(e) => handleAttributeChange(key, e.target.value, index)}
                    className="flex-grow p-2 border border-gray-300 rounded-md text-sm"
                  />
                  <button
                    onClick={() => handleRemoveValueFromArray(key, index)}
                    className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-md text-xs font-semibold"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <div className="flex items-center mt-2 space-x-2">
                <input
                  type="text"
                  placeholder="Add new value"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.target.value.trim()) {
                      handleAddValueToArray(key, e.target.value.trim());
                      e.target.value = '';
                    }
                  }}
                  className="flex-grow p-2 border border-gray-300 rounded-md text-sm"
                />
                <button
                  onClick={() => {
                    const input = document.querySelector(`#add-value-${key}`);
                    if (input?.value.trim()) {
                      handleAddValueToArray(key, input.value.trim());
                      input.value = '';
                    }
                  }}
                  className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-md text-xs font-semibold"
                >
                  Add
                </button>
              </div>
            </>
          ) : (
            <input
              type="text"
              value={value}
              onChange={(e) => handleAttributeChange(key, e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md text-sm"
            />
          )}
        </div>
      ))}

      <h4 className="text-md font-bold mb-2 text-gray-800 mt-6">Add New Attribute</h4>
      <div className="space-y-2">
        <input
          type="text"
          placeholder="Attribute Name"
          value={newAttributeKey}
          onChange={(e) => setNewAttributeKey(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-md"
        />
        <input
          type="text"
          placeholder="Attribute Value (comma-separated for multiple)"
          value={newAttributeValue}
          onChange={(e) => setNewAttributeValue(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-md"
        />
        <button
          onClick={handleAddNewAttribute}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
        >
          Add Attribute
        </button>
      </div>

      <button
        onClick={handleSave}
        className="mt-6 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg shadow-md transition-colors duration-200"
      >
        Save Changes
      </button>
    </div>
  );
}