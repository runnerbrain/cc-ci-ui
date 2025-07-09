// components/AttributeForm.js
import { useState, useEffect, useContext } from 'react'; // Corrected this line
import FirebaseContext from '../lib/FirebaseContext'; // Import the centralized context
import styles from './AttributeForm.module.css'; // Import the styles module

export default function AttributeForm({ subProcess, onSave }) {
  const [attributes, setAttributes] = useState({});
  const [newAttributeKey, setNewAttributeKey] = useState('');
  const [newAttributeValue, setNewAttributeValue] = useState('');
  const [newAttributeType, setNewAttributeType] = useState('string'); // NEW: type state
  const [objectFields, setObjectFields] = useState([{ key: '', value: '' }]); // For object type
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

  // Reset objectFields when type changes
  useEffect(() => {
    if (newAttributeType === 'object') {
      setObjectFields([{ key: '', value: '' }]);
    }
  }, [newAttributeType]);

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
    const attr = attributes[key];
    if (attr && typeof attr === 'object' && attr.type) {
      setNewAttributeType(attr.type);
      setNewAttributeValue(attr.value);
      if (attr.type === 'object' && attr.value && typeof attr.value === 'object' && !Array.isArray(attr.value)) {
        setObjectFields(Object.entries(attr.value).map(([k, v]) => ({ key: k, value: v })));
      }
    } else {
      setNewAttributeType('string');
      setNewAttributeValue(Array.isArray(attr) ? attr.join(', ') : attr);
    }
  };

  const handleAddOrEditAttribute = () => {
    if (!newAttributeKey.trim()) {
      alert("Attribute name cannot be empty.");
      return;
    }
    let newAttrs = { ...attributes };
    let value = newAttributeValue;
    // Basic conversion for number and boolean
    if (newAttributeType === 'number') {
      value = Number(newAttributeValue);
      if (isNaN(value)) {
        alert('Please enter a valid number.');
        return;
      }
    } else if (newAttributeType === 'boolean') {
      value = newAttributeValue === 'true' || newAttributeValue === true;
    } else if (newAttributeType === 'object') {
      // Convert objectFields to object
      const obj = {};
      for (const pair of objectFields) {
        if (pair.key.trim() !== '') {
          obj[pair.key.trim()] = pair.value;
        }
      }
      value = obj;
    }
    const attrObj = { type: newAttributeType, value };
    if (editKey) {
      if (editOriginalKey !== newAttributeKey.trim()) {
        delete newAttrs[editOriginalKey];
      }
    } else if (attributes.hasOwnProperty(newAttributeKey.trim())) {
      alert(`Attribute \"${newAttributeKey.trim()}\" already exists.`);
      return;
    }
    newAttrs[newAttributeKey.trim()] = attrObj;
    persistAttributes(newAttrs);
    setNewAttributeKey('');
    setNewAttributeValue('');
    setObjectFields([{ key: '', value: '' }]);
    setNewAttributeType('string');
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
        {/* Flex row for type and value */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <select
            value={newAttributeType}
            onChange={e => setNewAttributeType(e.target.value)}
            className="p-2 border border-gray-300 rounded-md"
            style={{ minWidth: 110, flex: '0 0 auto' }}
          >
            <option value="string">String</option>
            <option value="number">Number</option>
            <option value="boolean">Boolean</option>
            <option value="object">Object</option>
            <option value="array">Array</option>
          </select>
          {/* Value input (object type gets a subform) */}
          {newAttributeType === 'object' ? (
            <div style={{ flex: 1 }}>
              {objectFields.map((pair, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '0.25rem', marginBottom: 4 }}>
                  <input
                    type="text"
                    placeholder="Key"
                    value={pair.key}
                    onChange={e => {
                      const updated = [...objectFields];
                      updated[idx].key = e.target.value;
                      setObjectFields(updated);
                    }}
                    className="p-1 border border-gray-300 rounded-md"
                    style={{ width: '40%' }}
                  />
                  <input
                    type="text"
                    placeholder="Value"
                    value={pair.value}
                    onChange={e => {
                      const updated = [...objectFields];
                      updated[idx].value = e.target.value;
                      setObjectFields(updated);
                    }}
                    className="p-1 border border-gray-300 rounded-md"
                    style={{ width: '50%' }}
                  />
                  <button
                    type="button"
                    onClick={() => setObjectFields(fields => fields.filter((_, i) => i !== idx))}
                    className="bg-red-200 hover:bg-red-400 text-red-800 rounded px-2"
                    style={{ height: 32 }}
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setObjectFields(fields => [...fields, { key: '', value: '' }])}
                className="bg-blue-200 hover:bg-blue-400 text-blue-800 rounded px-2 mt-1"
                style={{ fontSize: 14 }}
              >
                + Add Pair
              </button>
            </div>
          ) : newAttributeType === 'boolean' ? (
            <select
              value={String(newAttributeValue)}
              onChange={e => setNewAttributeValue(e.target.value === 'true')}
              className="p-2 border border-gray-300 rounded-md"
              style={{ flex: 1 }}
            >
              <option value="true">True</option>
              <option value="false">False</option>
            </select>
          ) : (
            <input
              type={newAttributeType === 'number' ? 'number' : 'text'}
              placeholder="Attribute Value"
              value={newAttributeValue}
              onChange={(e) => setNewAttributeValue(e.target.value)}
              className="p-2 border border-gray-300 rounded-md"
              style={{ flex: 1 }}
            />
          )}
        </div>
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
      {Object.entries(attributes).map(([key, attr]) => (
        <div key={key} className="relative group mb-4 p-3 bg-gray-100 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-extrabold text-gray-700 mb-1">{key}</label>
              <div className={`text-base text-gray-800 bg-white px-2 py-1 rounded select-text ${styles.attributeValueInter}`}>
                {/* Display logic by type */}
                {attr && typeof attr === 'object' && attr.type ? (
                  attr.type === 'boolean' ? (
                    attr.value ? 'True' : 'False'
                  ) : attr.type === 'object' && attr.value && typeof attr.value === 'object' && !Array.isArray(attr.value) ? (
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                      {Object.entries(attr.value).map(([k, v]) => (
                        <li key={k}><span className="font-semibold">{k}:</span> {String(v)}</li>
                      ))}
                    </ul>
                  ) : attr.type === 'array' && Array.isArray(attr.value) ? (
                    attr.value.length > 0 && typeof attr.value[0] === 'object' ? (
                      <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                        {attr.value.map((obj, idx) => (
                          <li key={idx}>
                            {Object.entries(obj).map(([k, v]) => (
                              <span key={k}><span className="font-semibold">{k}:</span> {String(v)}; </span>
                            ))}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      attr.value.join(', ')
                    )
                  ) : (
                    String(attr.value)
                  )
                ) : (
                  // fallback for legacy/simple values
                  Array.isArray(attr) ? attr.join(', ') : String(attr)
                )}
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