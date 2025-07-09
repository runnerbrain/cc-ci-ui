// components/AttributeForm.js
import { useState, useEffect, useContext } from 'react'; // Corrected this line
import FirebaseContext from '../lib/FirebaseContext'; // Import the centralized context
import styles from './AttributeForm.module.css'; // Import the styles module

export default function AttributeForm({ subProcess, onSave }) {
  const [attributes, setAttributes] = useState({});
  const [newAttributeKey, setNewAttributeKey] = useState('');
  const [newAttributeValue, setNewAttributeValue] = useState('');
  const [newAttributeType, setNewAttributeType] = useState('string'); // NEW: type state
  const [objectFields, setObjectFields] = useState([{ key: '', value: '', type: 'string' }]); // For object type
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

  // Remove the useEffect that resets objectFields on type change

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
        setObjectFields(
          Object.entries(attr.value).map(([k, v]) => {
            let type = 'string';
            let nestedFields = undefined;
            if (typeof v === 'number') type = 'number';
            else if (typeof v === 'boolean') type = 'boolean';
            else if (Array.isArray(v)) type = 'array';
            else if (v && typeof v === 'object') {
              type = 'object';
              // Populate nestedFields for second-level object
              nestedFields = Object.entries(v).map(([nk, nv]) => ({ key: nk, value: nv }));
            }
            return { key: k, value: type === 'object' ? '' : v, type, ...(nestedFields ? { nestedFields } : {}) };
          })
        );
      } else {
        setObjectFields([{ key: '', value: '', type: 'string' }]);
      }
    } else {
      setNewAttributeType('string');
      setNewAttributeValue(Array.isArray(attr) ? attr.join(', ') : attr);
      setObjectFields([{ key: '', value: '', type: 'string' }]);
    }
  };

  const handleAddOrEditAttribute = () => {
    if (!newAttributeKey.trim()) {
      alert("Attribute name cannot be empty.");
      return;
    }
    let newAttrs = { ...attributes };
    let value = newAttributeValue;
    // Uniqueness check for attribute name
    const trimmedKey = newAttributeKey.trim();
    if (
      (editKey && editOriginalKey !== trimmedKey && attributes.hasOwnProperty(trimmedKey)) ||
      (!editKey && attributes.hasOwnProperty(trimmedKey))
    ) {
      alert(`Attribute name "${trimmedKey}" already exists. Please choose a unique name.`);
      return;
    }
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
          // Convert value based on its type
          let convertedValue = pair.value;
          if (pair.type === 'number') {
            convertedValue = Number(pair.value);
            if (isNaN(convertedValue)) {
              alert(`Please enter a valid number for key "${pair.key}".`);
              return;
            }
          } else if (pair.type === 'boolean') {
            convertedValue = pair.value === 'true' || pair.value === true;
          } else if (pair.type === 'array') {
            // Handle array values (comma-separated for now)
            convertedValue = pair.value.split(',').map(v => v.trim()).filter(v => v !== '');
          } else if (pair.type === 'object') {
            // Handle nested object values
            if (pair.nestedFields) {
              const nestedObj = {};
              for (const nestedPair of pair.nestedFields) {
                if (nestedPair.key.trim() !== '') {
                  nestedObj[nestedPair.key.trim()] = nestedPair.value;
                }
              }
              convertedValue = nestedObj;
            }
          }
          obj[pair.key.trim()] = convertedValue;
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
    setObjectFields([{ key: '', value: '', type: 'string' }]);
    setNewAttributeType('string');
    setEditKey(null);
    setEditOriginalKey(null);
  };

  // Helper function to render attribute values recursively
  function renderAttributeValue(value, type, level = 0) {
    if (type === 'boolean') {
      return value ? 'True' : 'False';
    } else if (type === 'object' && value && typeof value === 'object' && !Array.isArray(value)) {
      return (
        <ul style={{ margin: 0, paddingLeft: 16 * (level + 1), listStyle: 'none' }}>
          {Object.entries(value).map(([k, v]) => (
            <li key={k}>
              <span className="font-semibold">{k}:</span> {renderAttributeValue(v, typeof v, level + 1)}
            </li>
          ))}
        </ul>
      );
    } else if (type === 'array' && Array.isArray(value)) {
      return value.length > 0 && typeof value[0] === 'object'
        ? (
          <ul style={{ margin: 0, paddingLeft: 16 * (level + 1), listStyle: 'none' }}>
            {value.map((obj, idx) => (
              <li key={idx}>{renderAttributeValue(obj, typeof obj, level + 1)}</li>
            ))}
          </ul>
        )
        : value.join(', ');
    } else {
      return String(value);
    }
  }

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
                <div key={idx} style={{ marginBottom: 8, padding: 8, border: '1px solid #e5e7eb', borderRadius: 6 }}>
                  <div style={{ display: 'flex', gap: '0.25rem', marginBottom: 4 }}>
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
                      style={{ width: '30%' }}
                    />
                    <select
                      value={pair.type}
                      onChange={e => {
                        const updated = [...objectFields];
                        updated[idx].type = e.target.value;
                        // Reset value and nested fields when type changes
                        if (e.target.value === 'object') {
                          updated[idx].nestedFields = [{ key: '', value: '' }];
                        } else if (e.target.value === 'array') {
                          updated[idx].value = '';
                        } else {
                          updated[idx].value = '';
                          delete updated[idx].nestedFields;
                        }
                        setObjectFields(updated);
                      }}
                      className="p-1 border border-gray-300 rounded-md"
                      style={{ width: '25%' }}
                    >
                      <option value="string">String</option>
                      <option value="number">Number</option>
                      <option value="boolean">Boolean</option>
                      <option value="object">Object</option>
                      <option value="array">Array</option>
                    </select>
                    {/* Value input based on type */}
                    {pair.type === 'boolean' ? (
                      <select
                        value={String(pair.value)}
                        onChange={e => {
                          const updated = [...objectFields];
                          updated[idx].value = e.target.value === 'true';
                          setObjectFields(updated);
                        }}
                        className="p-1 border border-gray-300 rounded-md"
                        style={{ width: '35%' }}
                      >
                        <option value="true">True</option>
                        <option value="false">False</option>
                      </select>
                    ) : pair.type === 'object' ? (
                      <div style={{ width: '35%' }}>
                        {/* Nested object fields */}
                        {pair.nestedFields && pair.nestedFields.map((nestedPair, nestedIdx) => (
                          <div key={nestedIdx} style={{ display: 'flex', gap: '0.25rem', marginBottom: 2 }}>
                            <input
                              type="text"
                              placeholder="Nested Key"
                              value={nestedPair.key}
                              onChange={e => {
                                const updated = [...objectFields];
                                updated[idx].nestedFields[nestedIdx].key = e.target.value;
                                setObjectFields(updated);
                              }}
                              className="p-1 border border-gray-300 rounded-md"
                              style={{ width: '40%' }}
                            />
                            <input
                              type="text"
                              placeholder="Nested Value"
                              value={nestedPair.value}
                              onChange={e => {
                                const updated = [...objectFields];
                                updated[idx].nestedFields[nestedIdx].value = e.target.value;
                                setObjectFields(updated);
                              }}
                              className="p-1 border border-gray-300 rounded-md"
                              style={{ width: '50%' }}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...objectFields];
                                updated[idx].nestedFields = updated[idx].nestedFields.filter((_, i) => i !== nestedIdx);
                                setObjectFields(updated);
                              }}
                              className="bg-red-200 hover:bg-red-400 text-red-800 rounded px-1"
                              style={{ height: 28 }}
                              title="Remove"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...objectFields];
                            if (!updated[idx].nestedFields) updated[idx].nestedFields = [];
                            updated[idx].nestedFields.push({ key: '', value: '' });
                            setObjectFields(updated);
                          }}
                          className="bg-blue-200 hover:bg-blue-400 text-blue-800 rounded px-2 mt-1"
                          style={{ fontSize: 12 }}
                        >
                          + Add Nested Pair
                        </button>
                      </div>
                    ) : pair.type === 'array' ? (
                      <input
                        type="text"
                        placeholder="Comma-separated values"
                        value={Array.isArray(pair.value) ? pair.value.join(', ') : pair.value}
                        onChange={e => {
                          const updated = [...objectFields];
                          updated[idx].value = e.target.value;
                          setObjectFields(updated);
                        }}
                        className="p-1 border border-gray-300 rounded-md"
                        style={{ width: '35%' }}
                      />
                    ) : (
                      <input
                        type={pair.type === 'number' ? 'number' : 'text'}
                        placeholder="Value"
                        value={pair.value}
                        onChange={e => {
                          const updated = [...objectFields];
                          updated[idx].value = e.target.value;
                          setObjectFields(updated);
                        }}
                        className="p-1 border border-gray-300 rounded-md"
                        style={{ width: '35%' }}
                      />
                    )}
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
                </div>
              ))}
              <button
                type="button"
                onClick={() => setObjectFields(fields => [...fields, { key: '', value: '', type: 'string' }])}
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
              setObjectFields([{ key: '', value: '', type: 'string' }]);
              setNewAttributeType('string');
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
                {/* Improved recursive display logic for nested objects */}
                {attr && typeof attr === 'object' && attr.type
                  ? renderAttributeValue(attr.value, attr.type)
                  : Array.isArray(attr) ? attr.join(', ') : String(attr)
                }
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