// components/AttributeForm.js
import { useState, useEffect, useContext, useRef } from 'react'; // Corrected this line
import {FirebaseContext} from '../lib/FirebaseContext'; // Import the centralized context
import styles from './AttributeForm.module.css'; // Import the styles module
import { collection, getDocs, setDoc, doc, deleteDoc, query, where, serverTimestamp, updateDoc, collectionGroup } from 'firebase/firestore';
import ReactMarkdown from 'react-markdown'; // You need to install this: npm install react-markdown
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Autocomplete from '@mui/material/Autocomplete';
import Paper from '@mui/material/Paper';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';

// --- AUTOSUGGEST DROPDOWN COMPONENT ---
function AttributeNameAutosuggest({ value, onChange, suggestions, onSuggestionSelect, inputProps }) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [filtered, setFiltered] = useState([]);
  const inputRef = useRef();

  useEffect(() => {
    if (value) {
      const lower = value.toLowerCase();
      setFiltered(suggestions.filter(s => s.name.toLowerCase().includes(lower) && s.name !== value));
      setShowDropdown(suggestions.some(s => s.name.toLowerCase().includes(lower) && s.name !== value));
    } else {
      setFiltered([]);
      setShowDropdown(false);
    }
  }, [value, suggestions]);

  return (
    <div style={{ position: 'relative' }}>
      <input
        {...inputProps}
        ref={inputRef}
        value={value}
        onChange={e => {
          onChange(e.target.value);
        }}
        onFocus={() => setShowDropdown(filtered.length > 0)}
        onBlur={() => setTimeout(() => setShowDropdown(false), 120)}
        autoComplete="off"
      />
      {showDropdown && filtered.length > 0 && (
        <ul style={{
          position: 'absolute',
          zIndex: 10,
          background: 'white',
          border: '1px solid #ccc',
          borderRadius: 4,
          margin: 0,
          padding: 0,
          width: '100%',
          maxHeight: 160,
          overflowY: 'auto',
          listStyle: 'none',
        }}>
          {filtered.map(s => (
            <li
              key={s.name}
              style={{ padding: '6px 12px', cursor: 'pointer' }}
              onMouseDown={e => {
                e.preventDefault();
                onSuggestionSelect(s);
                setShowDropdown(false);
              }}
            >
              {s.name} <span style={{ color: '#888', fontSize: 12 }}>({s.type})</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AttributeForm({ subProcess, onSave, onFupChanged }) {
  const [attributes, setAttributes] = useState({});
  const [newAttributeKey, setNewAttributeKey] = useState('');
  const [newAttributeValue, setNewAttributeValue] = useState('');
  const [newAttributeType, setNewAttributeType] = useState('string'); // NEW: type state
  const [objectFields, setObjectFields] = useState([{ key: '', value: '', type: 'string' }]); // For object type
  const [editKey, setEditKey] = useState(null);
  const [editOriginalKey, setEditOriginalKey] = useState(null);
  // Remove the hardcoded array and restore Firestore-based suggestions
  const [attributeNameSuggestions, setAttributeNameSuggestions] = useState([]); // [{name, type}]
  const attributeNamesFetched = useRef(false);
  // Add notification state
  const [showSaved, setShowSaved] = useState(false);
  // Add error notification state
  const [errorMsg, setErrorMsg] = useState("");
  // Add state for follow-up modal
  const [fupModalOpen, setFupModalOpen] = useState(false);
  const [fupAttributeKey, setFupAttributeKey] = useState(null);
  // Placeholder: map of attributeKey to follow-up status (will be fetched from Firestore)
  const [attributeFupStatus, setAttributeFupStatus] = useState({}); // { [attributeKey]: { exists: bool, status: 'open'|'resolved' } }
  // Add state for follow-ups
  const [attributeFupData, setAttributeFupData] = useState({}); // { [attributeKey]: { id, question, status } }
  const [fupInput, setFupInput] = useState('');
  const [fupLoading, setFupLoading] = useState(false);
  const [fupError, setFupError] = useState('');

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

  // Fetch attribute names from Firestore on mount
  useEffect(() => {
    if (!db || attributeNamesFetched.current) return;
    attributeNamesFetched.current = true;
    getDocs(collection(db, 'attributeNames')).then(snapshot => {
      console.log('Firestore snapshot:', snapshot);
      const names = [];
      snapshot.forEach(docSnap => {
        names.push(docSnap.data());
      });
      console.log('Parsed attribute names:', names);
      setAttributeNameSuggestions(names);
    }).catch(e => {
      console.error('Error fetching attribute names from Firestore:', e);
    });
  }, [db]);

  // Fetch follow-ups for this subprocess on mount or when subProcess changes
  useEffect(() => {
    if (!db || !subProcess || !subProcess.id || !subProcess.processId) return;
    setFupLoading(true);
    setFupError('');
    const q = query(
      collection(db, 'AttributeFUP'),
      where('processId', '==', subProcess.processId),
      where('subProcessId', '==', subProcess.id)
    );
    getDocs(q)
      .then(snapshot => {
        const data = {};
        snapshot.forEach(docSnap => {
          const d = docSnap.data();
          data[d.attributeKey] = { id: docSnap.id, ...d };
        });
        setAttributeFupData(data);
        // Also update status for icon
        const statusMap = {};
        Object.entries(data).forEach(([k, v]) => {
          statusMap[k] = { exists: true, status: v.status };
        });
        setAttributeFupStatus(statusMap);
        setFupLoading(false);
      })
      .catch(e => {
        setFupError('Failed to load follow-ups');
        setFupLoading(false);
      });
  }, [db, subProcess]);

  // Helper to add attribute name/type to Firestore if not present
  const addAttributeNameToFirestore = async (name, type) => {
    if (!db || !name) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    // Check if already in local suggestions
    if (attributeNameSuggestions.some(s => s.name === trimmed && s.type === type)) return;
    // Add to Firestore
    try {
      await setDoc(doc(db, 'attributeNames', trimmed), { name: trimmed, type }, { merge: true });
      // setAttributeNameSuggestions(prev => { // This line is no longer needed
      //   if (prev.some(s => s.name === trimmed && s.type === type)) return prev;
      //   return [...prev, { name: trimmed, type }];
      // });
    } catch (e) {
      // Optionally handle error
    }
  };

  // Helper to clean up attributeNames if not used anywhere else
  const cleanupAttributeNameInFirestore = async (attrName) => {
    if (!db || !attrName) return;
    // Search all subProcesses for this attribute name
    const subProcessSnapshots = await getDocs(collectionGroup(db, 'subProcesses'));
    let found = false;
    subProcessSnapshots.forEach(docSnap => {
      const attrs = docSnap.data().attributes || {};
      if (Object.keys(attrs).includes(attrName)) {
        found = true;
      }
    });
    if (!found) {
      // Delete from attributeNames
      await deleteDoc(doc(db, 'attributeNames', attrName));
    }
  };

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
      console.log('After delete:', newAttrs);
      persistAttributes(newAttrs);
      // Clean up attributeNames if not used elsewhere
      cleanupAttributeNameInFirestore(key).then(() => {
        // After cleanup, re-fetch attribute names from Firestore
        if (db) {
          getDocs(collection(db, 'attributeNames')).then(snapshot => {
            const names = [];
            snapshot.forEach(docSnap => {
              names.push(docSnap.data());
            });
            setAttributeNameSuggestions(names);
          });
        }
      });
      // Delete any FUPs for this attribute
      if (db && subProcess && subProcess.processId && subProcess.id) {
        const fupQuery = query(
          collection(db, 'AttributeFUP'),
          where('processId', '==', subProcess.processId),
          where('subProcessId', '==', subProcess.id)
        );
        getDocs(fupQuery).then(snapshot => {
          const deletePromises = [];
          snapshot.forEach(docSnap => {
            const fupAttrKey = docSnap.data().attributeKey;
            // Delete FUP if it matches the deleted attribute, or if it is now orphaned
            if (fupAttrKey === key || !Object.keys(newAttrs).includes(fupAttrKey)) {
              deletePromises.push(deleteDoc(docSnap.ref));
            }
          });
          Promise.all(deletePromises).then(() => {
            if (onFupChanged) onFupChanged();
          });
        });
      }
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

  const handleAddOrEditAttribute = async () => {
    if (!newAttributeKey.trim()) {
      setErrorMsg("Attribute name cannot be empty.");
      setTimeout(() => setErrorMsg(""), 2000);
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
      setErrorMsg(`Attribute name "${trimmedKey}" already exists. Please choose a unique name.`);
      setTimeout(() => setErrorMsg(""), 2000);
      return;
    }
    // Basic conversion for number and boolean
    if (newAttributeType === 'number') {
      value = Number(newAttributeValue);
      if (isNaN(value)) {
        setErrorMsg('Please enter a valid number.');
        setTimeout(() => setErrorMsg(""), 2000);
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
              setErrorMsg(`Please enter a valid number for key "${pair.key}".`);
              setTimeout(() => setErrorMsg(""), 2000);
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
                  // Add nested object key to Firestore
                  addAttributeNameToFirestore(nestedPair.key.trim(), 'string'); // Default to string, or infer if needed
                }
              }
              convertedValue = nestedObj;
            }
          }
          obj[pair.key.trim()] = convertedValue;
          // Add object key to Firestore
          addAttributeNameToFirestore(pair.key.trim(), pair.type);
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
      setErrorMsg(`Attribute \"${newAttributeKey.trim()}\" already exists.`);
      setTimeout(() => setErrorMsg(""), 2000);
      return;
    }
    newAttrs[newAttributeKey.trim()] = attrObj;
    persistAttributes(newAttrs);
    // Add top-level attribute name to Firestore
    addAttributeNameToFirestore(newAttributeKey.trim(), newAttributeType);
    setNewAttributeKey('');
    setNewAttributeValue('');
    setObjectFields([{ key: '', value: '', type: 'string' }]);
    setNewAttributeType('string');
    setEditKey(null);
    setEditOriginalKey(null);
    // Show saved notification
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 2000);
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
    } else if (type === 'rtf') {
      return (
        <div className="markdown-preview">
          <ReactMarkdown
            components={{
              h1: ({node, ...props}) => <h1 className="text-2xl font-bold my-2" {...props} />,
              h2: ({node, ...props}) => <h2 className="text-xl font-bold my-2" {...props} />,
              h3: ({node, ...props}) => <h3 className="text-lg font-bold my-2" {...props} />,
              ul: ({node, ...props}) => <ul className="list-disc ml-6 my-2" {...props} />,
              ol: ({node, ...props}) => <ol className="list-decimal ml-6 my-2" {...props} />,
              li: ({node, ...props}) => <li className="mb-1" {...props} />,
              strong: ({node, ...props}) => <strong className="font-bold" {...props} />,
              p: ({node, ...props}) => <p className="my-1" {...props} />,
            }}
          >
            {value}
          </ReactMarkdown>
        </div>
      );
    } else {
      return String(value);
    }
  }

  // Helper: open modal and set input if editing
  const openFupModal = (key) => {
    setFupAttributeKey(key);
    setFupModalOpen(true);
    setFupInput(attributeFupData[key]?.question || '');
    setFupError('');
  };

  // Add or update follow-up
  const handleFupSave = async () => {
    console.log('handleFupSave', {
      db,
      subProcess,
      fupAttributeKey,
      fupInput,
      processId: subProcess?.processId,
      subProcessId: subProcess?.id
    });
    if (!db || !subProcess || !subProcess.id || !subProcess.processId || !fupAttributeKey) return;
    if (!fupInput.trim()) {
      setFupError('Question/concern cannot be empty.');
      return;
    }
    setFupLoading(true);
    setFupError('');
    const fupRef = attributeFupData[fupAttributeKey]?.id
      ? doc(db, 'AttributeFUP', attributeFupData[fupAttributeKey].id)
      : doc(collection(db, 'AttributeFUP'));
    const data = {
      processId: subProcess.processId,
      subProcessId: subProcess.id,
      attributeKey: fupAttributeKey,
      question: fupInput.trim(),
      status: 'open',
      updatedAt: serverTimestamp(),
      ...(attributeFupData[fupAttributeKey]?.id ? {} : { createdAt: serverTimestamp() })
    };
    try {
      await setDoc(fupRef, data, { merge: true });
      // Refresh follow-ups
      setFupModalOpen(false);
      if (onFupChanged) onFupChanged();
      setTimeout(() => {
        // Re-fetch follow-ups
        if (!db || !subProcess || !subProcess.id || !subProcess.processId) return;
        const q = query(
          collection(db, 'AttributeFUP'),
          where('processId', '==', subProcess.processId),
          where('subProcessId', '==', subProcess.id)
        );
        getDocs(q).then(snapshot => {
          const data = {};
          snapshot.forEach(docSnap => {
            const d = docSnap.data();
            data[d.attributeKey] = { id: docSnap.id, ...d };
          });
          setAttributeFupData(data);
          const statusMap = {};
          Object.entries(data).forEach(([k, v]) => {
            statusMap[k] = { exists: true, status: v.status };
          });
          setAttributeFupStatus(statusMap);
        });
      }, 500);
    } catch (e) {
      setFupError('Failed to save follow-up.');
    }
    setFupLoading(false);
  };

  // Resolve follow-up
  const handleFupResolve = async () => {
    if (!db || !attributeFupData[fupAttributeKey]?.id) return;
    setFupLoading(true);
    setFupError('');
    try {
      await updateDoc(doc(db, 'AttributeFUP', attributeFupData[fupAttributeKey].id), {
        status: 'resolved',
        updatedAt: serverTimestamp(),
      });
      setFupModalOpen(false);
      if (onFupChanged) onFupChanged();
      setTimeout(() => {
        // Re-fetch follow-ups
        if (!db || !subProcess || !subProcess.id || !subProcess.processId) return;
        const q = query(
          collection(db, 'AttributeFUP'),
          where('processId', '==', subProcess.processId),
          where('subProcessId', '==', subProcess.id)
        );
        getDocs(q).then(snapshot => {
          const data = {};
          snapshot.forEach(docSnap => {
            const d = docSnap.data();
            data[d.attributeKey] = { id: docSnap.id, ...d };
          });
          setAttributeFupData(data);
          const statusMap = {};
          Object.entries(data).forEach(([k, v]) => {
            statusMap[k] = { exists: true, status: v.status };
          });
          setAttributeFupStatus(statusMap);
        });
      }, 500);
    } catch (e) {
      setFupError('Failed to resolve follow-up.');
    }
    setFupLoading(false);
  };

  // Delete follow-up
  const handleFupDelete = async () => {
    if (!db || !attributeFupData[fupAttributeKey]?.id) return;
    setFupLoading(true);
    setFupError('');
    try {
      await deleteDoc(doc(db, 'AttributeFUP', attributeFupData[fupAttributeKey].id));
      setFupModalOpen(false);
      if (onFupChanged) onFupChanged();
      setTimeout(() => {
        // Re-fetch follow-ups
        if (!db || !subProcess || !subProcess.id || !subProcess.processId) return;
        const q = query(
          collection(db, 'AttributeFUP'),
          where('processId', '==', subProcess.processId),
          where('subProcessId', '==', subProcess.id)
        );
        getDocs(q).then(snapshot => {
          const data = {};
          snapshot.forEach(docSnap => {
            const d = docSnap.data();
            data[d.attributeKey] = { id: docSnap.id, ...d };
          });
          setAttributeFupData(data);
          const statusMap = {};
          Object.entries(data).forEach(([k, v]) => {
            statusMap[k] = { exists: true, status: v.status };
          });
          setAttributeFupStatus(statusMap);
        });
      }, 500);
    } catch (e) {
      setFupError('Failed to delete follow-up.');
    }
    setFupLoading(false);
  };

  return (
    <div>
      {/* Error notification */}
      {errorMsg && (
        <div style={{
          background: '#fdecea',
          color: '#a94442',
          border: '1px solid #f5c6cb',
          borderRadius: 6,
          padding: '8px 16px',
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontWeight: 500,
          fontSize: 16
        }}>
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#a94442" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          {errorMsg}
        </div>
      )}
      {/* Notification for attribute saved */}
      {showSaved && (
        <div style={{
          background: '#e6f9ed',
          color: '#217a3c',
          border: '1px solid #b6e2c7',
          borderRadius: 6,
          padding: '8px 16px',
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontWeight: 500,
          fontSize: 16
        }}>
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#217a3c" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
          Attribute saved
        </div>
      )}
      <h4 className="text-md font-bold mb-2 text-gray-800">{editKey ? 'Edit Attribute' : 'Add New Attribute'}</h4>
      <div className="space-y-2 mb-6">
        {/* Replace the attribute name TextField with MUI Autocomplete */}
        <Autocomplete
          freeSolo
          options={attributeNameSuggestions.map(s => s.name)}
          value={newAttributeKey}
          onInputChange={(event, newInputValue, reason) => {
            setNewAttributeKey(newInputValue);
            // If user types a name that matches a suggestion, set the type
            const match = attributeNameSuggestions.find(s => s.name === newInputValue);
            if (match) setNewAttributeType(match.type);
          }}
          onChange={(event, newValue) => {
            if (typeof newValue === 'string') {
              setNewAttributeKey(newValue);
              // If it's a new name, default to string type
              setNewAttributeType('string');
              addAttributeNameToFirestore(newValue, 'string');
            } else if (newValue && newValue.inputValue) {
              setNewAttributeKey(newValue.inputValue);
              setNewAttributeType('string');
              addAttributeNameToFirestore(newValue.inputValue, 'string');
            } else if (newValue) {
              setNewAttributeKey(newValue);
              const match = attributeNameSuggestions.find(s => s.name === newValue);
              if (match) setNewAttributeType(match.type);
            }
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Attribute Name"
              variant="outlined"
              size="small"
              style={{ marginBottom: 8 }}
              fullWidth
            />
          )}
        />
        {/* Flex row for type and value */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Select
            value={newAttributeType}
            onChange={e => setNewAttributeType(e.target.value)}
            variant="outlined"
            size="small"
            style={{ marginBottom: 8, width: 90 }}
          >
            <MenuItem value="string">String</MenuItem>
            <MenuItem value="number">Number</MenuItem>
            <MenuItem value="boolean">Boolean</MenuItem>
            <MenuItem value="object">Object</MenuItem>
            <MenuItem value="array">Array</MenuItem>
            <MenuItem value="rtf">RTF</MenuItem>
          </Select>
          {/* Value input (object type gets a subform) */}
          {newAttributeType === 'object' ? (
            <div style={{ flex: 1 }}>
              {objectFields.map((pair, idx) => (
                <div key={idx} style={{ marginBottom: 8, padding: 8, border: '1px solid #e5e7eb', borderRadius: 6 }}>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: 4, alignItems: 'center' }}>
                    {/* --- Key field as MUI TextField --- */}
                    <TextField
                      label="Key"
                      variant="outlined"
                      size="small"
                      value={pair.key}
                      onChange={e => {
                        const updated = [...objectFields];
                        updated[idx].key = e.target.value;
                        // If suggestion matches, auto-select type
                        const match = attributeNameSuggestions.find(s => s.name === e.target.value);
                        if (match) updated[idx].type = match.type;
                        setObjectFields(updated);
                      }}
                      style={{ flex: 1, minWidth: 120 }}
                    />
                    {/* --- Type field as MUI Select --- */}
                    <Select
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
                      variant="outlined"
                      size="small"
                      style={{ width: 90 }}
                    >
                      <MenuItem value="string">String</MenuItem>
                      <MenuItem value="number">Number</MenuItem>
                      <MenuItem value="boolean">Boolean</MenuItem>
                      <MenuItem value="object">Object</MenuItem>
                      <MenuItem value="array">Array</MenuItem>
                    </Select>
                    {/* Value input based on type as MUI TextField/Select */}
                    {pair.type === 'boolean' ? (
                      <Select
                        value={String(pair.value)}
                        onChange={e => {
                          const updated = [...objectFields];
                          updated[idx].value = e.target.value === 'true';
                          setObjectFields(updated);
                        }}
                        variant="outlined"
                        size="small"
                        style={{ flex: 2, minWidth: 120 }}
                      >
                        <MenuItem value="true">True</MenuItem>
                        <MenuItem value="false">False</MenuItem>
                      </Select>
                    ) : pair.type === 'object' ? (
                      <div style={{ flex: 2, minWidth: 180 }}>
                        {/* Nested object fields (max 2 levels) */}
                        {pair.nestedFields && pair.nestedFields.map((nestedPair, nestedIdx) => (
                          <div key={nestedIdx} style={{ display: 'flex', gap: '0.5rem', marginBottom: 16, alignItems: 'center' }}>
                            <TextField
                              label="Nested Key"
                              variant="outlined"
                              size="small"
                              value={nestedPair.key}
                              onChange={e => {
                                const updated = [...objectFields];
                                updated[idx].nestedFields[nestedIdx].key = e.target.value;
                                setObjectFields(updated);
                              }}
                              style={{ flex: 1, minWidth: 90 }}
                            />
                            <Select
                              value={nestedPair.type || 'string'}
                              onChange={e => {
                                const updated = [...objectFields];
                                updated[idx].nestedFields[nestedIdx].type = e.target.value;
                                // Reset value when type changes
                                if (e.target.value === 'boolean') {
                                  updated[idx].nestedFields[nestedIdx].value = false;
                                } else {
                                  updated[idx].nestedFields[nestedIdx].value = '';
                                }
                                setObjectFields(updated);
                              }}
                              variant="outlined"
                              size="small"
                              style={{ width: 90 }}
                            >
                              <MenuItem value="string">String</MenuItem>
                              <MenuItem value="number">Number</MenuItem>
                              <MenuItem value="boolean">Boolean</MenuItem>
                              <MenuItem value="array">Array</MenuItem>
                            </Select>
                            {nestedPair.type === 'boolean' ? (
                              <Select
                                value={String(nestedPair.value)}
                                onChange={e => {
                                  const updated = [...objectFields];
                                  updated[idx].nestedFields[nestedIdx].value = e.target.value === 'true';
                                  setObjectFields(updated);
                                }}
                                variant="outlined"
                                size="small"
                                style={{ flex: 2, minWidth: 90 }}
                              >
                                <MenuItem value="true">True</MenuItem>
                                <MenuItem value="false">False</MenuItem>
                              </Select>
                            ) : (
                              <TextField
                                label="Nested Value"
                                variant="outlined"
                                size="small"
                                type={nestedPair.type === 'number' ? 'number' : 'text'}
                                value={nestedPair.value}
                                onChange={e => {
                                  const updated = [...objectFields];
                                  updated[idx].nestedFields[nestedIdx].value = e.target.value;
                                  setObjectFields(updated);
                                }}
                                style={{ flex: 2, minWidth: 90 }}
                              />
                            )}
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
                            updated[idx].nestedFields.push({ key: '', value: '', type: 'string' });
                            setObjectFields(updated);
                          }}
                          className="bg-blue-200 hover:bg-blue-400 text-blue-800 rounded px-2 mt-1"
                          style={{ fontSize: 12 }}
                        >
                          + Add Nested Pair
                        </button>
                      </div>
                    ) : pair.type === 'array' ? (
                      <TextField
                        label="Comma-separated values"
                        variant="outlined"
                        size="small"
                        value={Array.isArray(pair.value) ? pair.value.join(', ') : pair.value}
                        onChange={e => {
                          const updated = [...objectFields];
                          updated[idx].value = e.target.value;
                          setObjectFields(updated);
                        }}
                        style={{ flex: 2, minWidth: 120 }}
                      />
                    ) : (
                      <TextField
                        label="Value"
                        variant="outlined"
                        size="small"
                        type={pair.type === 'number' ? 'number' : 'text'}
                        value={pair.value}
                        onChange={e => {
                          const updated = [...objectFields];
                          updated[idx].value = e.target.value;
                          setObjectFields(updated);
                        }}
                        style={{ flex: 2, minWidth: 120 }}
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
          ) : (
            <div style={{ flex: 2, minWidth: 180 }}>
              {/* Value input based on type as MUI TextField/Select */}
              {newAttributeType === 'rtf' ? (
                <div style={{ flex: 2, minWidth: 180 }}>
                  <TextField
                    label="Markdown Text"
                    variant="outlined"
                    size="small"
                    value={newAttributeValue}
                    onChange={e => setNewAttributeValue(e.target.value)}
                    multiline
                    minRows={5}
                    style={{ width: '100%', marginBottom: 8 }}
                    fullWidth
                  />
                  <Paper elevation={1} style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 6, padding: 8, marginTop: 4, color: '#1f2937' }} className="markdown-preview">
                    <div style={{ fontWeight: 600, marginBottom: 4, color: '#555' }}>Preview:</div>
                    <ReactMarkdown
                      components={{
                        h1: ({node, ...props}) => <h1 className="text-2xl font-bold my-2" {...props} />,
                        h2: ({node, ...props}) => <h2 className="text-xl font-bold my-2" {...props} />,
                        h3: ({node, ...props}) => <h3 className="text-lg font-bold my-2" {...props} />,
                        ul: ({node, ...props}) => <ul className="list-disc ml-6 my-2" {...props} />,
                        ol: ({node, ...props}) => <ol className="list-decimal ml-6 my-2" {...props} />,
                        li: ({node, ...props}) => <li className="mb-1" {...props} />,
                        strong: ({node, ...props}) => <strong className="font-bold" {...props} />,
                        p: ({node, ...props}) => <p className="my-1" {...props} />,
                      }}
                    >
                      {newAttributeValue}
                    </ReactMarkdown>
                  </Paper>
                </div>
              ) : (
                <TextField
                  label="Attribute Value"
                  variant="outlined"
                  size="small"
                  value={newAttributeValue}
                  onChange={e => setNewAttributeValue(e.target.value)}
                  style={{ marginBottom: 8 }}
                  fullWidth
                />
              )}
            </div>
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
              {/* Soccer corner flag icon for follow-up */}
              <button
                onClick={() => openFupModal(key)}
                className="p-1"
                title={attributeFupStatus[key]?.exists ? (attributeFupStatus[key].status === 'resolved' ? 'Follow-up resolved' : 'View follow-up') : 'Add follow-up'}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {attributeFupStatus[key]?.exists && attributeFupStatus[key].status === 'open' ? (
                  // Solid red soccer corner flag
                  <svg width="18" height="18" viewBox="0 0 18 18" style={{ display: 'block' }}>
                    <rect x="3" y="3" width="2" height="12" rx="1" fill="#b91c1c" />
                    <polygon points="5,3 14,6 5,9" fill="#b91c1c" />
                  </svg>
                ) : (
                  // Faint outline soccer corner flag
                  <svg width="18" height="18" viewBox="0 0 18 18" style={{ display: 'block' }}>
                    <rect x="3" y="3" width="2" height="12" rx="1" fill="none" stroke="#aaa" strokeWidth="1.2" />
                    <polygon points="5,3 14,6 5,9" fill="none" stroke="#aaa" strokeWidth="1.2" />
                  </svg>
                )}
              </button>
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
                className="text-gray-500 hover:text-red-600 p-1"
                title="Delete Attribute"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {/* Door/logout icon */}
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <rect x="3" y="4" width="12" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M16 12h5m-2-2v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      ))}
      {/* Follow-up modal */}
      <Dialog open={fupModalOpen} onClose={() => setFupModalOpen(false)}>
        <DialogTitle>Attribute Follow-up</DialogTitle>
        <DialogContent>
          {fupLoading ? (
            <div style={{ minWidth: 260, minHeight: 60 }}>Loading...</div>
          ) : attributeFupData[fupAttributeKey]?.id ? (
            <div style={{ minWidth: 260 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Question/Concern:</div>
              <textarea
                value={fupInput}
                onChange={e => setFupInput(e.target.value)}
                rows={4}
                style={{ width: '100%', border: '1px solid #ccc', borderRadius: 4, padding: 8, marginBottom: 8 }}
              />
              <div style={{ color: '#888', fontSize: 13, marginBottom: 8 }}>
                Status: <b>{attributeFupData[fupAttributeKey]?.status}</b>
              </div>
              {fupError && <div style={{ color: 'red', marginBottom: 8 }}>{fupError}</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <Button onClick={handleFupSave} variant="contained" color="primary" size="small">Save</Button>
                {attributeFupData[fupAttributeKey]?.status === 'open' && (
                  <Button onClick={handleFupResolve} variant="outlined" color="success" size="small">Resolve</Button>
                )}
                <Button onClick={handleFupDelete} variant="outlined" color="error" size="small">Delete</Button>
              </div>
            </div>
          ) : (
            <div style={{ minWidth: 260 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Add a question or concern for follow-up:</div>
              <textarea
                value={fupInput}
                onChange={e => setFupInput(e.target.value)}
                rows={4}
                style={{ width: '100%', border: '1px solid #ccc', borderRadius: 4, padding: 8, marginBottom: 8 }}
              />
              {fupError && <div style={{ color: 'red', marginBottom: 8 }}>{fupError}</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <Button onClick={handleFupSave} variant="contained" color="primary" size="small">Save</Button>
              </div>
            </div>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFupModalOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}