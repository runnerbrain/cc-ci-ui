// components/AttributeForm.js
import { useState, useEffect, useContext } from 'react'; // Corrected this line
import FirebaseContext from '../lib/FirebaseContext'; // Import the centralized context
import styles from './AttributeForm.module.css'; // Import the styles module

export default function AttributeForm({ subProcess, onSave }) {
  const [attributes, setAttributes] = useState({});
  const [newAttributeKey, setNewAttributeKey] = useState('');
  const [newAttributeValue, setNewAttributeValue] = useState('');
  const [editKey, setEditKey] = useState(null);
  const [editOriginalKey, setEditOriginalKey] = useState(null);

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

  const persistAttributes = (updatedAttributes) => {
    setAttributes(updatedAttributes);
    if (onSave && subProcess) {
      onSave({ ...subProcess, attributes: updatedAttributes });
    }
  };

  const handleAttributeChange = (key, value, index = null) => {
    setAttributes(prevAttributes => {
      const newAttrs = { ...prevAttributes };
      if (index !== null && Array.isArray(newAttrs[key])) {
        newAttrs[key][index] = value;
      } else {
        newAttrs[key] = value;
      }
      persistAttributes(newAttrs);
      return newAttrs;
    });
  };

  const handleAddValueToArray = (key, newValue) => {
    setAttributes(prevAttributes => {
      const newAttrs = { ...prevAttributes };
      if (Array.isArray(newAttrs[key])) {
        newAttrs[key].push(newValue);
      } else {
        newAttrs[key] = [newAttrs[key], newValue];
      }
      persistAttributes(newAttrs);
      return newAttrs;
    });
  };

  const handleRemoveValueFromArray = (key, indexToRemove) => {
    setAttributes(prevAttributes => {
      const newAttrs = { ...prevAttributes };
      if (Array.isArray(newAttrs[key])) {
        newAttrs[key].splice(indexToRemove, 1);
        if (newAttrs[key].length === 0) {
          delete newAttrs[key];
        }
      }
      persistAttributes(newAttrs);
      return newAttrs;
    });
  };

  const handleRemoveAttribute = (key) => {
    setAttributes(prevAttributes => {
      const newAttrs = { ...prevAttributes };
      delete newAttrs[key];
      persistAttributes(newAttrs);
      return newAttrs;
    });
  };

  const handleEditAttribute = (key) => {
    setEditKey(key);
    setEditOriginalKey(key);
    setNewAttributeKey(key);
    const value = attributes[key];
    setNewAttributeValue(Array.isArray(value) ? value.join(', ') : value);
  };

  const handleAddOrEditAttribute = () => {
    if (!newAttributeKey.trim()) {
      alert("Attribute name cannot be empty.");
      return;
    }
    let newAttrs = { ...attributes };
    const value = newAttributeValue.trim();
    if (editKey) {
      // Editing: remove old key if changed
      if (editOriginalKey !== newAttributeKey.trim()) {
        delete newAttrs[editOriginalKey];
      }
    } else if (attributes.hasOwnProperty(newAttributeKey.trim())) {
      alert(`Attribute \"${newAttributeKey.trim()}\" already exists.`);
      return;
    }
    newAttrs[newAttributeKey.trim()] = value.includes(',') ? value.split(',').map(v => v.trim()) : value;
    persistAttributes(newAttrs);
    setNewAttributeKey('');
    setNewAttributeValue('');
    setEditKey(null);
    setEditOriginalKey(null);
  };

  return (
    <div>
      <h4 className="text-md font-bold mb-2 text-gray-800">{editKey ? 'Edit Attribute' : 'Add New Attribute'}</h4>
      <div className="space-y-2 mb-6">
        <input
          type="text"
          placeholder="Attribute Name"
          value={newAttributeKey}
          onChange={(e) => setNewAttributeKey(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-md"
          disabled={!!editKey}
        />
        <input
          type="text"
          placeholder="Attribute Value (comma-separated for multiple)"
          value={newAttributeValue}
          onChange={(e) => setNewAttributeValue(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-md"
        />
        <button
          onClick={handleAddOrEditAttribute}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
        >
          {editKey ? 'Confirm Changes' : 'Add Attribute'}
        </button>
        {editKey && (
          <button
            onClick={() => {
              setEditKey(null);
              setEditOriginalKey(null);
              setNewAttributeKey('');
              setNewAttributeValue('');
            }}
            className="w-full bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-lg transition-colors duration-200 mt-2"
          >
            Cancel
          </button>
        )}
      </div>
      {Object.keys(attributes).length === 0 && (
        <p className="text-gray-500 italic mb-4">No attributes defined. Add one above!</p>
      )}
      {Object.entries(attributes).map(([key, value]) => (
        <div key={key} className="relative group mb-4 p-3 bg-gray-100 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-extrabold text-gray-700 mb-1">{key}</label>
              <div className={`text-base text-gray-800 bg-white px-2 py-1 rounded select-text ${styles.attributeValueInter}`}>
                {Array.isArray(value) ? value.join(', ') : value}
              </div>
            </div>
            <div className="flex items-center space-x-2 ml-4">
              <button
                onClick={() => handleEditAttribute(key)}
                className="text-blue-500 hover:text-blue-700 p-1"
                title="Edit Attribute"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13h3l8-8a2.828 2.828 0 00-4-4l-8 8v3zm0 0v3h3" />
                </svg>
              </button>
              <button
                onClick={() => handleRemoveAttribute(key)}
                className="text-red-500 hover:text-red-700 p-1"
                title="Delete Attribute"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}