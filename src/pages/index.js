// pages/index.js
import { useState, useEffect, useContext, useCallback } from 'react';
import { getAuth, signInAnonymously, onAuthStateChanged, signOut, setPersistence, browserSessionPersistence } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, onSnapshot, query, deleteDoc, updateDoc, writeBatch, getDocs, collectionGroup, where } from 'firebase/firestore'; // Added collectionGroup
import Layout from '../components/Layout';
import AttributeForm from '../components/AttributeForm';
import { Modal } from '../components/Modal'; // Import Modal
import { ConfirmModal } from '../components/ConfirmModal'; // Import ConfirmModal
import { FirebaseContext } from '../lib/FirebaseContext'; // Import the centralized context
import { useRouter } from 'next/router';
import { ALLOWED_EDITORS } from '../lib/allowedEditors';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

// Helper to clean up attributeNames after subprocess delete
const cleanupAttributeNamesAfterSubprocessDelete = async (attrNames) => {
  if (!db || !attrNames || attrNames.length === 0) return;
  const subProcessSnapshots = await getDocs(collectionGroup(db, 'subProcesses'));
  for (const attrName of attrNames) {
    let found = false;
    subProcessSnapshots.forEach(docSnap => {
      const attrs = docSnap.data().attributes || {};
      if (Object.keys(attrs).includes(attrName)) {
        found = true;
      }
    });
    if (!found) {
      await deleteDoc(doc(db, 'attributeNames', attrName));
    }
  }
};

export default function Home() {
  const firebaseApp = useContext(FirebaseContext);
  const db = firebaseApp ? getFirestore(firebaseApp) : null;
  const auth = firebaseApp ? getAuth(firebaseApp) : null;
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState(null);
  const [loadingFirebase, setLoadingFirebase] = useState(true);
  const [loadingData, setLoadingData] = useState(true);
  const [processTitles, setProcessTitles] = useState([]);
  const [subProcesses, setSubProcesses] = useState({});
  const [activeProcessTitleId, setActiveProcessTitleId] = useState(null);
  const [selectedSubProcess, setSelectedSubProcess] = useState(null);

  // Modals state
  const [isEditProcessTitleModalOpen, setIsEditProcessTitleModalOpen] = useState(false);
  const [processTitleToEdit, setProcessTitleToEdit] = useState(null);
  const [isDeleteProcessTitleModalOpen, setIsDeleteProcessTitleModalOpen] = useState(false);
  const [processTitleToDelete, setProcessTitleToDelete] = useState(null);

  const [isEditSubProcessModalOpen, setIsEditSubProcessModalOpen] = useState(false);
  const [subProcessToEdit, setSubProcessToEdit] = useState(null);
  const [isDeleteSubProcessModalOpen, setIsDeleteSubProcessModalOpen] = useState(false);
  const [subProcessToDelete, setSubProcessToDelete] = useState(null);

  // Add state for add modal
  const [isAddProcessTitleModalOpen, setIsAddProcessTitleModalOpen] = useState(false);

  // Add state for add sub-process modal
  const [isAddSubProcessModalOpen, setIsAddSubProcessModalOpen] = useState(false);
  const [subProcessNameInput, setSubProcessNameInput] = useState("");

  // Add state for access denied
  const [accessDenied, setAccessDenied] = useState(false);

  // Add state to track FUP counts per subprocess
  const [subProcessFupCounts, setSubProcessFupCounts] = useState({}); // { [subProcessId]: count }

  // --- Firebase Authentication Effect ---
  useEffect(() => {
    // If Firebase is NOT configured via .env.local, skip Firebase auth/data fetching
    if (!firebaseApp) {
      setLoadingFirebase(false);
      // Set demo data immediately if not configured
      setProcessTitles([
        { id: "PT_BOOKING", name: "Booking", dependsOn: null },
        { id: "PT_CT_SIM", name: "CT SIM", dependsOn: "PT_BOOKING" }
      ]);
      setSubProcesses({
        "PT_BOOKING": [
          { id: "P_01", name: "Patient consults with RO", seq: 1, attributes: { role: ["RO"], output: ["eBAF (initial)"], description: "Initial consultation with Radiation Oncologist." } },
          { id: "P_02", name: "RO completes eBAF during consult", seq: 2, attributes: { role: ["RO"], input: ["eBAF (initial)"], output: ["eBAF (completed)"], system: ["Paper/Digital Form"] } },
          { id: "P_03", name: "Clerk books CT appt", seq: 3, attributes: { role: ["Clerk"], input: ["eBAF (completed)"], output: ["CT Appt (booked)"], system: ["Cerner"] } },
          { id: "P_04", name: "Enter CT SIM appt details into ARIA", seq: 4, attributes: { system: ["ARIA"], input: ["CT Appt (booked)"], document: ["CT SIM Appt Details"] } },
          { id: "P_05", name: "CT therapist reviews patient info from EBAF in Cerner", seq: 5, attributes: { role: ["CT Therapist"], system: ["Cerner"], input: ["eBAF (completed)"] } },
          { id: "P_06", name: "Patient CT SIM and 10 initial treatment appts. booked", seq: 6, attributes: { status: ["Completed"], output: ["Initial Treatment Schedule"] } },
        ],
        "PT_CT_SIM": [
          { id: "P_07", name: "CT therapist reviews next day CT schedule and EBAF in Cerner", seq: 1, attributes: { role: ["CT Therapist"], system: ["Cerner"], input: ["Next Day CT Schedule", "eBAF"] } },
          { id: "P_08", name: "Review patient demographics, RTT dates, disease codes, RO in ARIA", seq: 2, attributes: { system: ["ARIA"], role: ["CT Therapist", "RO"], input: ["Patient Demographics"] } },
          { id: "P_09", name: "Assign care path template in ARIA to patient", seq: 3, attributes: { system: ["ARIA"], output: ["Care Path Template"] } },
          { id: "P_10", name: "Enter patient info in RTP Dosimetry Tracking System", seq: 4, attributes: { system: ["RTP Dosimetry Tracking System"], input: ["Patient Info"] } },
          { id: "P_11", name: "Enter Patient info into CT Scanner Phillips System", seq: 5, attributes: { system: ["CT Scanner Phillips System"], input: ["Patient Info"] } },
          { id: "P_12", name: "Document the contrast provided as a journal note", seq: 6, attributes: { document: ["Journal Note (Contrast)"], role: ["CT Therapist"] } },
          { id: "P_13", name: "Booking clerk checks patient in for CT SIM", seq: 7, attributes: { role: ["Booking Clerk"], status: ["Patient Checked In"] } },
          { id: "P_14", name: "Complete CT checklist in ARIA", seq: 8, attributes: { system: ["ARIA"], document: ["CT Checklist"], role: ["CT Therapist"] } },
          { id: "P_15", name: "Scan patient", seq: 9, attributes: { equipment: ["CT Scanner"], output: ["CT Scan Images"] } },
          { id: "P_16", name: "Indicate set-up instructions in ARIA document", seq: 10, attributes: { system: ["ARIA"], document: ["Set-up Instructions"], role: ["CT Therapist"] } },
          { id: "P_17", name: "Save loc sheet as document in ARIA", seq: 11, attributes: { system: ["ARIA"], document: ["Loc Sheet"], role: ["CT Therapist"] } },
          { id: "P_18", name: "Document any journal notes in ARIA", seq: 12, attributes: { system: ["ARIA"], document: ["Journal Notes"], role: ["CT Therapist"] } },
          { id: "P_19", name: "Complete 'CT' appointment in ARIA", seq: 13, attributes: { system: ["ARIA"], status: ["CT Appt Completed"] } },
          { id: "P_20", name: "'Pre-RO' task in ARIA is initiated", seq: 14, attributes: { system: ["ARIA"], role: ["RO"] } },
          { id: "P_21", name: "Booking clerk schedules the remainder of treatment appts.", seq: 15, attributes: { role: ["Booking Clerk"], output: ["Full Treatment Schedule"] } },
        ]
      });
      setLoadingData(false);
      return; // Exit the effect if using demo data
    }

    // Only proceed with Firebase authentication if Firebase is configured
    if (!auth) {
      setLoadingFirebase(false);
      console.error("Firebase Auth instance is not available.");
      return;
    }

    // Set session-only persistence
    setPersistence(auth, browserSessionPersistence).then(() => {
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
          setCurrentUser({ email: user.email, uid: user.uid });
          // Debug log for email and allowed editors
          const normalizedUserEmail = user.email ? user.email.toLowerCase().trim() : '';
          const normalizedAllowed = ALLOWED_EDITORS.map(e => e.toLowerCase().trim());
          console.log('[DEBUG] Normalized user email:', normalizedUserEmail);
          console.log('[DEBUG] Normalized allowed editors:', normalizedAllowed);
          // Check allowed editors (normalized)
          if (!normalizedUserEmail || !normalizedAllowed.includes(normalizedUserEmail)) {
            setAccessDenied(true);
          } else {
            setAccessDenied(false);
          }
          console.log("Authenticated with user:", user.email || user.uid);
        } else {
          setCurrentUser(null);
          setAccessDenied(false);
          try {
            // Attempt anonymous sign-in if no user is found
            await signInAnonymously(auth);
          } catch (error) {
            console.error("Firebase authentication error:", error);
          }
        }
        setLoadingFirebase(false);
      });

      return () => unsubscribe(); // Cleanup subscription
    });
  }, [auth, firebaseApp]); // Depend on auth and projectId to re-run if they become available

  // --- Data Fetching Effects (Firestore) ---
  // Effect to fetch ALL Process Titles from ALL users using a Collection Group Query
  useEffect(() => {
    // Only proceed with Firestore data fetching if db and currentUserId are available
    // and Firebase is configured (not in demo mode)
    if (!db || !currentUser?.uid) {
      return;
    }

    setLoadingData(true);
    // Query the 'processTitles' collection group
    // Note: Collection Group Queries require a Firestore index if you use orderBy or where clauses.
    // Firebase console will provide a link to create it if needed.
    const processTitlesCollectionGroupRef = collectionGroup(db, 'processTitles');

    const unsubscribeProcessTitles = onSnapshot(query(processTitlesCollectionGroupRef), (snapshot) => {
      const fetchedTitles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), userId: doc.ref.parent.parent.id })); // Capture userId
      // Sort by sequence number, then by name as fallback
      fetchedTitles.sort((a, b) => {
        const seqA = a.seq || 999;
        const seqB = b.seq || 999;
        if (seqA !== seqB) {
          return seqA - seqB;
        }
        return a.name.localeCompare(b.name);
      });
      setProcessTitles(fetchedTitles);
      setLoadingData(false);

      // IMPORTANT: Set activeProcessTitleId here if it's the first load or current one is invalid
      if (fetchedTitles.length > 0 && (!activeProcessTitleId || !fetchedTitles.some(t => t.id === activeProcessTitleId))) {
        setActiveProcessTitleId(fetchedTitles[0].id);
      } else if (fetchedTitles.length === 0) {
        setActiveProcessTitleId(null);
      }
    }, (error) => {
      console.error("Error fetching all process titles:", error);
      setLoadingData(false);
    });

    return () => unsubscribeProcessTitles();
  }, [db, currentUser?.uid, activeProcessTitleId]);

  // Effect to fetch Sub-processes for the active tab (now needs to know the owner's userId)
  useEffect(() => {
    if (!db || !currentUser?.uid || !activeProcessTitleId) {
      setSubProcesses(prev => ({ ...prev, [activeProcessTitleId]: [] })); // Clear sub-processes for current tab if conditions not met
      return;
    }

    setLoadingData(true);
    // Find the userId owner of the activeProcessTitleId from the processTitles state
    // This is crucial because the processTitle might belong to a different anonymous user ID
    const processTitleOwnerUserId = processTitles.find(pt => pt.id === activeProcessTitleId)?.userId;

    if (!processTitleOwnerUserId) {
        // If we don't know the owner yet (e.g., processTitles array is still loading),
        // or if the activeProcessTitleId doesn't exist in the fetched list,
        // then we can't fetch sub-processes.
        setSubProcesses(prev => ({ ...prev, [activeProcessTitleId]: [] }));
        setLoadingData(false);
        return;
    }

    const subProcessesRef = collection(db, `artifacts/${firebaseApp.options.appId}/users/${processTitleOwnerUserId}/processTitles/${activeProcessTitleId}/subProcesses`);
    const unsubscribeSubProcesses = onSnapshot(query(subProcessesRef), (snapshot) => {
      const fetchedSubProcesses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort by sequence number, then by name as fallback
      fetchedSubProcesses.sort((a, b) => {
        const seqA = a.seq || 999; // Default to high number if no seq
        const seqB = b.seq || 999;
        if (seqA !== seqB) {
          return seqA - seqB;
        }
        return a.name.localeCompare(b.name);
      });
      setSubProcesses(prev => ({ ...prev, [activeProcessTitleId]: fetchedSubProcesses }));
      setLoadingData(false);

      // Deselect sub-process if it no longer exists in the current tab
      if (selectedSubProcess && !fetchedSubProcesses.some(sp => sp.id === selectedSubProcess.id)) {
        setSelectedSubProcess(null);
      }
    }, (error) => {
      console.error(`Error fetching sub-processes for ${activeProcessTitleId}:`, error);
      setSubProcesses(prev => ({ ...prev, [activeProcessTitleId]: [] })); // Clear data on error
      setLoadingData(false);
    });

    return () => unsubscribeSubProcesses();
  }, [db, currentUser?.uid, activeProcessTitleId, selectedSubProcess, firebaseApp.options.appId, processTitles]); // Added processTitles to dependencies

  // Move FUP count fetching logic into a function
  const refreshFupCounts = async () => {
    if (!db || !activeProcessTitleId || !subProcesses[activeProcessTitleId]) return;
    const subProcessIds = (subProcesses[activeProcessTitleId] || []).map(sp => sp.id);
    if (subProcessIds.length === 0) return;
    const q = query(
      collection(db, 'AttributeFUP'),
      where('processId', '==', activeProcessTitleId)
    );
    const snapshot = await getDocs(q);
    const counts = {};
    snapshot.forEach(docSnap => {
      const d = docSnap.data();
      if (d.subProcessId && d.status === 'open') {
        counts[d.subProcessId] = (counts[d.subProcessId] || 0) + 1;
      }
    });
    setSubProcessFupCounts(counts);
  };

  // Call refreshFupCounts in the effect
  useEffect(() => {
    refreshFupCounts();
  }, [db, activeProcessTitleId, subProcesses]);

  // --- Handlers for Process Titles ---
  const handleAddProcessTitle = async (name, dependsOn, seq) => {
    if (!db || !currentUser?.uid) {
      alert("Database not ready. Please wait for authentication or configure Firebase.");
      return;
    }
    const newId = "PT_" + name.toUpperCase().replace(/[^A-Z0-9]/g, '_');
    if (processTitles.some(pt => pt.id === newId)) {
      alert("A process with a similar name already exists. Please choose a different name.");
      return;
    }
    try {
      // Save new process title under the CURRENT user's ID
      await setDoc(doc(db, `artifacts/${firebaseApp.options.appId}/users/${currentUser?.uid}/processTitles`, newId), { name, dependsOn: dependsOn || null, seq: seq || 1 });
      console.log("Process title added:", name);
      // setActiveProcessTitleId(newId); // This will be handled by the onSnapshot listener
    } catch (e) {
      console.error("Error adding process title: ", e);
      alert("Error saving process title.");
    }
  };

  const handleEditProcessTitle = async (id, newName, newDependsOn, newSeq) => {
    if (!db || !currentUser?.uid) {
      alert("Database not ready. Please wait for authentication or configure Firebase.");
      return;
    }
    // Find the userId owner of this process title
    const processTitleOwnerUserId = processTitles.find(pt => pt.id === id)?.userId;
    if (!processTitleOwnerUserId) {
      alert("Process title not found.");
      return;
    }
    try {
      await updateDoc(doc(db, `artifacts/${firebaseApp.options.appId}/users/${processTitleOwnerUserId}/processTitles`, id), {
        name: newName,
        dependsOn: newDependsOn || null,
        seq: newSeq || 1
      });
      console.log(`Process title ${newName} updated.`);
    } catch (e) {
      console.error("Error updating process title: ", e);
      alert("Error updating process title.");
    } finally {
      setIsEditProcessTitleModalOpen(false);
      setProcessTitleToEdit(null);
    }
  };

  const handleDeleteProcessTitle = async (id) => {
    if (!db || !currentUser?.uid) {
      alert("Database not ready. Please wait for authentication or configure Firebase.");
      return;
    }
    // Find the userId owner of this process title
    const processTitleOwnerUserId = processTitles.find(pt => pt.id === id)?.userId;
    if (!processTitleOwnerUserId) {
      alert("Process title not found.");
      return;
    }
    try {
      // Delete all sub-processes first (more complex, requires fetching them)
      const subProcessesCollectionRef = collection(db, `artifacts/${firebaseApp.options.appId}/users/${processTitleOwnerUserId}/processTitles/${id}/subProcesses`);
      const subProcessDocs = await getDocs(query(subProcessesCollectionRef));
      const batch = writeBatch(db);
      subProcessDocs.forEach((subDoc) => {
        batch.delete(subDoc.ref);
      });
      await batch.commit();

      // Then delete the process title document itself
      await deleteDoc(doc(db, `artifacts/${firebaseApp.options.appId}/users/${processTitleOwnerUserId}/processTitles`, id));
      console.log(`Process title ${id} and its sub-processes deleted.`);
      // If the deleted tab was active, switch to the first available tab
      if (activeProcessTitleId === id) {
        setActiveProcessTitleId(processTitles.length > 1 ? processTitles[0].id : null);
      }
    } catch (e) {
      console.error("Error deleting process title: ", e);
      alert("Error deleting process title.");
    } finally {
      setIsDeleteProcessTitleModalOpen(false);
      setProcessTitleToDelete(null);
    }
  };

  // --- Handlers for Sub-processes ---
  const handleAddSubProcess = async (name, dependsOn, seq) => {
    if (!db || !currentUser?.uid || !activeProcessTitleId) {
      alert("Please select a Process Title first or configure Firebase.");
      return;
    }
    // Find the userId owner of the active process title
    const processTitleOwnerUserId = processTitles.find(pt => pt.id === activeProcessTitleId)?.userId;
    if (!processTitleOwnerUserId) {
      alert("Process title not found.");
      return;
    }
    const newId = `SP_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    try {
      await setDoc(doc(db, `artifacts/${firebaseApp.options.appId}/users/${processTitleOwnerUserId}/processTitles/${activeProcessTitleId}/subProcesses`, newId), { 
        name, 
        attributes: {}, 
        dependsOn: dependsOn || null,
        seq: seq || 1
      });
      console.log("Sub-process added:", name);
    } catch (e) {
      console.error("Error adding sub-process: ", e);
      alert("Error saving sub-process.");
    }
  };

  const handleEditSubProcess = async (id, newName, newSeq) => {
    if (!db || !currentUser?.uid || !activeProcessTitleId) {
      alert("Database not ready. Please wait for authentication or configure Firebase.");
      return;
    }
    // Find the userId owner of the active process title
    const processTitleOwnerUserId = processTitles.find(pt => pt.id === activeProcessTitleId)?.userId;
    if (!processTitleOwnerUserId) {
      alert("Process title not found.");
      return;
    }
    try {
      await updateDoc(doc(db, `artifacts/${firebaseApp.options.appId}/users/${processTitleOwnerUserId}/processTitles/${activeProcessTitleId}/subProcesses`, id), {
        name: newName,
        seq: newSeq || 1
      });
      console.log(`Sub-process ${newName} updated.`);
    } catch (e) {
      console.error("Error updating sub-process: ", e);
      alert("Error updating sub-process.");
    } finally {
      setIsEditSubProcessModalOpen(false);
      setSubProcessToEdit(null);
    }
  };

  const handleDeleteSubProcess = async (id) => {
    if (!db || !currentUser?.uid || !activeProcessTitleId) {
      alert("Database not ready. Please wait for authentication or configure Firebase.");
      return;
    }
    // Find the userId owner of the active process title
    const processTitleOwnerUserId = processTitles.find(pt => pt.id === activeProcessTitleId)?.userId;
    if (!processTitleOwnerUserId) {
      alert("Process title not found.");
      return;
    }
    try {
      // Get the attributes of the subprocess before deleting
      const subProcessDoc = await getDocs(query(collection(db, `artifacts/${firebaseApp.options.appId}/users/${processTitleOwnerUserId}/processTitles/${activeProcessTitleId}/subProcesses`), where('id', '==', id)));
      let attrNames = [];
      subProcessDoc.forEach(docSnap => {
        const attrs = docSnap.data().attributes || {};
        attrNames = attrNames.concat(Object.keys(attrs));
      });
      await deleteDoc(doc(db, `artifacts/${firebaseApp.options.appId}/users/${processTitleOwnerUserId}/processTitles/${activeProcessTitleId}/subProcesses`, id));
      console.log(`Sub-process ${id} deleted.`);
      // If the deleted sub-process was selected, deselect it
      if (selectedSubProcess && selectedSubProcess.id === id) {
        setSelectedSubProcess(null);
      }
      // Clean up attributeNames
      await cleanupAttributeNamesAfterSubprocessDelete(attrNames);
    } catch (e) {
      console.error("Error deleting sub-process: ", e);
      alert("Error deleting sub-process.");
    } finally {
      setIsDeleteSubProcessModalOpen(false);
      setSubProcessToDelete(null);
    }
  };

  const handleUpdateSubProcessAttributes = useCallback(async (updatedSubProcess) => {
    if (!db || !currentUser?.uid || !activeProcessTitleId || !updatedSubProcess) {
      alert("Cannot save: Database not ready, no sub-process selected, or Firebase not configured.");
      return;
    }
    // Find the userId owner of the active process title
    const processTitleOwnerUserId = processTitles.find(pt => pt.id === activeProcessTitleId)?.userId;
    if (!processTitleOwnerUserId) {
      alert("Process title not found.");
      return;
    }
    try {
      await setDoc(doc(db, `artifacts/${firebaseApp.options.appId}/users/${processTitleOwnerUserId}/processTitles/${activeProcessTitleId}/subProcesses`, updatedSubProcess.id), {
        name: updatedSubProcess.name, // Ensure name is also saved if it was passed in the updated object
        attributes: JSON.parse(JSON.stringify(updatedSubProcess.attributes)), // Deep copy to ensure no mutation issues
        seq: updatedSubProcess.seq || 1, // Preserve sequence number
        dependsOn: updatedSubProcess.dependsOn || null // Preserve dependency
      });
      console.log("Sub-process attributes updated:", updatedSubProcess.name);
      // Update the subprocess in the local list
      setSubProcesses(prev => {
        const updatedList = (prev[activeProcessTitleId] || []).map(sp =>
          sp.id === updatedSubProcess.id
            ? { ...sp, attributes: JSON.parse(JSON.stringify(updatedSubProcess.attributes)) }
            : sp
        );
        return { ...prev, [activeProcessTitleId]: updatedList };
      });
      // Update the selected subprocess if needed
      if (selectedSubProcess && selectedSubProcess.id === updatedSubProcess.id) {
        setSelectedSubProcess({
          ...selectedSubProcess,
          attributes: JSON.parse(JSON.stringify(updatedSubProcess.attributes))
        });
      }
      // alert(`Changes for "${updatedSubProcess.name}" saved!`); // Removed alert, notification handled in UI
    } catch (e) {
      console.error("Error updating sub-process attributes: ", e);
      alert("Error saving sub-process attributes.");
    }
  }, [db, currentUser?.uid, activeProcessTitleId, firebaseApp.options.appId, processTitles, selectedSubProcess]);

  const handleLogout = async () => {
    if (auth) {
      await signOut(auth);
      setCurrentUser(null);
      router.push('/login');
    }
  };

  // Render only a fullscreen spinner (no Layout) while loadingFirebase is true
  if (loadingFirebase) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f3f4f6'
      }}>
        <div className="text-center py-8 text-gray-600 text-xl font-semibold">Initializing Firebase...</div>
      </div>
    );
  }

  // If not authenticated, redirect to /login immediately (no flash)
  if (!currentUser || !currentUser.email) {
    if (typeof window !== 'undefined') {
      window.location.replace('/login');
    }
    return null;
  }

  // If access denied, show message and hide all editing features
  if (accessDenied) {
    return (
      <Layout user={currentUser} onLogout={handleLogout}>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h2>
          <p className="text-gray-700 mb-6">You do not have permission to edit this app. Please contact the administrator if you believe this is an error.</p>
          <button
            className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <FirebaseContext.Provider value={{ db, auth, currentUser, firebaseApp }}>
      <Layout
        user={currentUser}
        onAddProcessTitle={handleAddProcessTitle}
        processTitles={processTitles}
        onEditProcessTitle={(pt) => { setProcessTitleToEdit(pt); setIsEditProcessTitleModalOpen(true); }}
        onDeleteProcessTitle={(pt) => { setProcessTitleToDelete(pt); setIsDeleteProcessTitleModalOpen(true); }}
        onLogout={handleLogout}
      >
        <div className="flex flex-col md:flex-row flex-grow p-4 gap-4">
          {/* Tabs Container */}
          <div className="bg-white rounded-xl shadow-md p-4 w-full md:w-64 flex-shrink-0">
            <div className="flex items-center mb-4 justify-between">
              <h2 className="text-xl font-bold text-gray-800">Process Titles</h2>
              <button
                className="p-2 rounded-full bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center shadow transition-colors duration-200"
                title="Add Process Title"
                onClick={() => setIsAddProcessTitleModalOpen(true)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {processTitles.length === 0 ? (
                <p className="text-gray-500 italic">No process titles yet. Add one!</p>
              ) : (
                processTitles.map(pt => (
                  <div key={pt.id} className="flex items-center group">
                    <button
                      className={`flex-grow p-3 rounded-lg text-left font-semibold transition-colors duration-200 ${
                        pt.id === activeProcessTitleId ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                      onClick={() => setActiveProcessTitleId(pt.id)}
                    >
                      <span className="text-sm text-gray-500 font-mono mr-2 min-w-[2rem]">{pt.seq || 1} →</span>
                      {pt.name}
                    </button>
                    <button
                      className={`ml-2 p-2 rounded-full text-gray-500 hover:bg-gray-200 ${pt.id === activeProcessTitleId ? 'text-white hover:bg-blue-700' : ''} opacity-0 group-hover:opacity-100 transition-opacity duration-200`}
                      onClick={(e) => { e.stopPropagation(); setProcessTitleToEdit(pt); setIsEditProcessTitleModalOpen(true); }}
                      title="Edit Process Title"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.38-2.828-2.828z" />
                      </svg>
                    </button>
                    <button
                      className={`ml-1 p-2 rounded-full text-gray-500 hover:bg-red-200 ${pt.id === activeProcessTitleId ? 'text-white hover:bg-red-700' : ''} opacity-0 group-hover:opacity-100 transition-opacity duration-200`}
                      onClick={(e) => { e.stopPropagation(); setProcessTitleToDelete(pt); setIsDeleteProcessTitleModalOpen(true); }}
                      title="Delete Process Title"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Main Content Area (Sub-process List and Attribute Form) */}
          <div className="bg-white rounded-xl shadow-md flex-grow flex flex-col md:flex-row overflow-hidden">
            {/* Sub-process List */}
            <div className="w-full md:w-2/5 border-b md:border-b-0 md:border-r border-gray-200 p-4 flex flex-col">
              <div className="flex items-center mb-3 justify-between">
                <h3 className="text-lg font-bold text-gray-800">{processTitles.find(pt => pt.id === activeProcessTitleId)?.name || 'Select a Process'}</h3>
                <button
                  className="p-2 rounded-full bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center shadow transition-colors duration-200"
                  title="Add Sub-process"
                  onClick={() => setIsAddSubProcessModalOpen(true)}
                  disabled={!activeProcessTitleId}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
              {loadingData && <div className="text-center text-gray-500 text-sm">Loading sub-processes...</div>}
              <ul className="flex-grow overflow-y-auto mb-4">
                {(subProcesses[activeProcessTitleId] || []).length === 0 && !loadingData ? (
                  <li className="text-gray-500 italic p-2">No sub-processes defined for this section.</li>
                ) : (
                  (subProcesses[activeProcessTitleId] || []).map(sp => (
                    <li
                      key={sp.id}
                      className={`p-2 mb-1 rounded-md cursor-pointer transition-colors duration-200 flex items-center justify-between group ${
                        selectedSubProcess?.id === sp.id ? 'bg-blue-100 border-blue-500 border font-semibold' : 'hover:bg-gray-50'
                      }`}
                      onClick={() => setSelectedSubProcess(sp)}
                    >
                      <div className="flex items-center flex-grow">
                        <span className="text-sm text-gray-500 font-mono mr-2 min-w-[2rem]">{sp.seq || 1} →</span>
                        <span className={`${selectedSubProcess?.id === sp.id ? 'text-blue-800' : 'text-gray-800'} font-semibold`}>
                          {sp.name}
                          {subProcessFupCounts[sp.id] ? (
                            <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', ml: 1 }}>
                              <svg width="14" height="14" viewBox="0 0 18 18" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 2 }}>
                                <rect x="3" y="3" width="2" height="12" rx="1" fill="#b91c1c" />
                                <polygon points="5,3 14,6 5,9" fill="#b91c1c" />
                              </svg>
                              {subProcessFupCounts[sp.id] > 1 && (
                                <Typography component="span" sx={{ ml: 0.5, fontWeight: 400, color: '#b91c1c', fontSize: '0.95em' }}>
                                  ({subProcessFupCounts[sp.id]})
                                </Typography>
                              )}
                            </Box>
                          ) : null}
                        </span>
                      </div>
                      <div className="flex-shrink-0 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <button
                          className="p-1 rounded-full text-gray-500 hover:bg-gray-200"
                          onClick={(e) => { e.stopPropagation(); setSubProcessToEdit(sp); setIsEditSubProcessModalOpen(true); }}
                          title="Edit Sub-process"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.38-2.828-2.828z" />
                          </svg>
                        </button>
                        <button
                          className="p-1 rounded-full text-gray-500 hover:bg-red-200"
                          onClick={(e) => { e.stopPropagation(); setSubProcessToDelete(sp); setIsDeleteSubProcessModalOpen(true); }}
                          title="Delete Sub-process"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>

            {/* Attribute Form */}
            <div className="w-full md:w-3/5 p-4 overflow-y-auto">
              <h3 className="text-lg font-bold mb-4 text-gray-800">
                {selectedSubProcess ? `Attributes for: ${selectedSubProcess.name}` : 'Select a Sub-process'}
              </h3>
              {selectedSubProcess ? (
                <AttributeForm subProcess={{ ...selectedSubProcess, processId: activeProcessTitleId }} onSave={handleUpdateSubProcessAttributes} onFupChanged={refreshFupCounts} />
              ) : (
                <p className="text-gray-500 italic">Click a sub-process to view and edit its attributes.</p>
              )}
            </div>
          </div>
        </div>

        {/* Add Process Title Modal */}
        {isAddProcessTitleModalOpen && (
          <Modal
            title="Add Process Title"
            onClose={() => setIsAddProcessTitleModalOpen(false)}
            onConfirm={async (newName, newDependsOn, newSeq) => {
              await handleAddProcessTitle(newName, newDependsOn, newSeq);
              setIsAddProcessTitleModalOpen(false);
            }}
            initialName=""
            initialDependency=""
            initialSeq={1}
            processTitles={processTitles}
          />
        )}

        {/* Edit Process Title Modal */}
        {isEditProcessTitleModalOpen && processTitleToEdit && (
          <Modal
            title="Edit Process Title"
            onClose={() => { setIsEditProcessTitleModalOpen(false); setProcessTitleToEdit(null); }}
            onConfirm={async (newName, newDependsOn, newSeq) => {
              await handleEditProcessTitle(processTitleToEdit.id, newName, newDependsOn, newSeq);
            }}
            initialName={processTitleToEdit.name}
            initialDependency={processTitleToEdit.dependsOn}
            initialSeq={processTitleToEdit.seq || 1}
            processTitles={processTitles}
          />
        )}

        {/* Delete Process Title Confirmation Modal */}
        {isDeleteProcessTitleModalOpen && processTitleToDelete && (
          <ConfirmModal
            title="Confirm Delete Process Title"
            message={`Are you sure you want to delete "${processTitleToDelete.name}"? All its sub-processes will also be deleted.`}
            onClose={() => { setIsDeleteProcessTitleModalOpen(false); setProcessTitleToDelete(null); }}
            onConfirm={async () => await handleDeleteProcessTitle(processTitleToDelete.id)}
          />
        )}

        {/* Edit Sub-process Modal */}
        {isEditSubProcessModalOpen && subProcessToEdit && (
          <Modal
            title="Edit Sub-process"
            onClose={() => { setIsEditSubProcessModalOpen(false); setSubProcessToEdit(null); }}
            onConfirm={async (newName, dependsOn, newSeq) => {
              await handleEditSubProcess(subProcessToEdit.id, newName, newSeq);
            }}
            initialName={subProcessToEdit.name}
            initialDependency={subProcessToEdit.dependsOn}
            initialSeq={subProcessToEdit.seq || 1}
            isSubProcess={true} // Indicate it's a sub-process edit
            subProcesses={(subProcesses[activeProcessTitleId] || [])}
          />
        )}

        {/* Delete Sub-process Confirmation Modal */}
        {isDeleteSubProcessModalOpen && subProcessToDelete && (
          <ConfirmModal
            title="Confirm Delete Sub-process"
            message={`Are you sure you want to delete "${subProcessToDelete.name}"?`}
            onClose={() => { setIsDeleteSubProcessModalOpen(false); setSubProcessToDelete(null); }}
            onConfirm={async () => await handleDeleteSubProcess(subProcessToDelete.id)}
          />
        )}

        {/* Add Sub-process Modal */}
        {isAddSubProcessModalOpen && (
          <Modal
            title="Add Sub-process"
            onClose={() => { setIsAddSubProcessModalOpen(false); setSubProcessNameInput(""); }}
            onConfirm={async (name, dependsOn, seq) => {
              await handleAddSubProcess(name, dependsOn, seq);
              setIsAddSubProcessModalOpen(false);
              setSubProcessNameInput("");
            }}
            initialName={subProcessNameInput}
            initialSeq={1}
            isSubProcess={true}
            subProcesses={(subProcesses[activeProcessTitleId] || [])}
          />
        )}
      </Layout>
    </FirebaseContext.Provider>
  );
}