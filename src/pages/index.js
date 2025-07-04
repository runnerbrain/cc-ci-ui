// pages/index.js
import { useState, useEffect, useContext, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, onSnapshot, query, deleteDoc, updateDoc, writeBatch, getDocs, collectionGroup } from 'firebase/firestore'; // Added collectionGroup
import Layout from '../components/Layout';
import AttributeForm from '../components/AttributeForm';
import { Modal } from '../components/Modal'; // Import Modal
import { ConfirmModal } from '../components/ConfirmModal'; // Import ConfirmModal
import FirebaseContext from '../lib/FirebaseContext'; // Import the centralized context

// --- Firebase Configuration (REPLACE WITH YOUR OWN) ---
// You will get this from your Firebase project settings after creating it.
// For local development, create a .env.local file in your project root and add these:
// NEXT_PUBLIC_FIREBASE_API_KEY=YOUR_API_KEY
// NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=YOUR_AUTH_DOMAIN
// NEXT_PUBLIC_FIREBASE_PROJECT_ID=YOUR_PROJECT_ID
// NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=YOUR_STORAGE_BUCKET
// NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=YOUR_MESSAGING_SENDER_ID
// NEXT_PUBLIC_FIREBASE_APP_ID=YOUR_APP_ID
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase (only once, safely)
let app;
let db;
let auth;

if (typeof window !== 'undefined' && firebaseConfig.projectId && !app) {
  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    console.log("Firebase initialized.");
  } catch (error) {
    console.error("Firebase initialization error:", error);
  }
} else if (typeof window !== 'undefined' && !firebaseConfig.projectId) {
  console.warn("Firebase config not found. Running in demo mode without persistence.");
}

export default function Home() {
  const [currentUserId, setCurrentUserId] = useState(null);
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

  // Authentication functions
  const signInWithGoogle = async () => {
    if (!auth) {
      console.error("Firebase Auth not available");
      return;
    }
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      console.log("Google sign-in successful:", result.user.email);
    } catch (error) {
      console.error("Google sign-in error:", error);
      alert("Google sign-in failed. Please try again or use anonymous sign-in.");
    }
  };

  const signInAnonymously = async () => {
    if (!auth) {
      console.error("Firebase Auth not available");
      return;
    }
    try {
      await signInAnonymously(auth);
      console.log("Anonymous sign-in successful");
    } catch (error) {
      console.error("Anonymous sign-in error:", error);
      alert("Anonymous sign-in failed. Please try again.");
    }
  };

  const handleSignOut = async () => {
    if (!auth) {
      console.error("Firebase Auth not available");
      return;
    }
    try {
      await signOut(auth);
      console.log("Sign out successful");
      // Clear local state
      setCurrentUserId(null);
      setCurrentUser(null);
    } catch (error) {
      console.error("Sign out error:", error);
      // Even if signOut fails, clear local state to force re-authentication
      setCurrentUserId(null);
      setCurrentUser(null);
    }
  };

  // --- Firebase Authentication Effect ---
  useEffect(() => {
    // If Firebase is NOT configured via .env.local, skip Firebase auth/data fetching
    if (!firebaseConfig.projectId) {
      setLoadingFirebase(false);
      // Set demo data immediately if not configured
      setProcessTitles([
        { id: "PT_BOOKING", name: "Booking", dependsOn: null },
        { id: "PT_CT_SIM", name: "CT SIM", dependsOn: "PT_BOOKING" }
      ]);
      setSubProcesses({
        "PT_BOOKING": [
          { id: "P_01", name: "Patient consults with RO", attributes: { role: ["RO"], output: ["eBAF (initial)"], description: "Initial consultation with Radiation Oncologist." } },
          { id: "P_02", name: "RO completes eBAF during consult", attributes: { role: ["RO"], input: ["eBAF (initial)"], output: ["eBAF (completed)"], system: ["Paper/Digital Form"] } },
          { id: "P_03", name: "Clerk books CT appt", attributes: { role: ["Clerk"], input: ["eBAF (completed)"], output: ["CT Appt (booked)"], system: ["Cerner"] } },
          { id: "P_04", name: "Enter CT SIM appt details into ARIA", attributes: { system: ["ARIA"], input: ["CT Appt (booked)"], document: ["CT SIM Appt Details"] } },
          { id: "P_05", name: "CT therapist reviews patient info from EBAF in Cerner", attributes: { role: ["CT Therapist"], system: ["Cerner"], input: ["eBAF (completed)"] } },
          { id: "P_06", name: "Patient CT SIM and 10 initial treatment appts. booked", attributes: { status: ["Completed"], output: ["Initial Treatment Schedule"] } },
        ],
        "PT_CT_SIM": [
          { id: "P_07", name: "CT therapist reviews next day CT schedule and EBAF in Cerner", attributes: { role: ["CT Therapist"], system: ["Cerner"], input: ["Next Day CT Schedule", "eBAF"] } },
          { id: "P_08", name: "Review patient demographics, RTT dates, disease codes, RO in ARIA", attributes: { system: ["ARIA"], role: ["CT Therapist", "RO"], input: ["Patient Demographics"] } },
          { id: "P_09", name: "Assign care path template in ARIA to patient", attributes: { system: ["ARIA"], output: ["Care Path Template"] } },
          { id: "P_10", name: "Enter patient info in RTP Dosimetry Tracking System", attributes: { system: ["RTP Dosimetry Tracking System"], input: ["Patient Info"] } },
          { id: "P_11", name: "Enter Patient info into CT Scanner Phillips System", attributes: { system: ["CT Scanner Phillips System"], input: ["Patient Info"] } },
          { id: "P_12", name: "Document the contrast provided as a journal note", attributes: { document: ["Journal Note (Contrast)"], role: ["CT Therapist"] } },
          { id: "P_13", name: "Booking clerk checks patient in for CT SIM", attributes: { role: ["Booking Clerk"], status: ["Patient Checked In"] } },
          { id: "P_14", name: "Complete CT checklist in ARIA", attributes: { system: ["ARIA"], document: ["CT Checklist"], role: ["CT Therapist"] } },
          { id: "P_15", name: "Scan patient", attributes: { equipment: ["CT Scanner"], output: ["CT Scan Images"] } },
          { id: "P_16", name: "Indicate set-up instructions in ARIA document", attributes: { system: ["ARIA"], document: ["Set-up Instructions"], role: ["CT Therapist"] } },
          { id: "P_17", name: "Save loc sheet as document in ARIA", attributes: { system: ["ARIA"], document: ["Loc Sheet"], role: ["CT Therapist"] } },
          { id: "P_18", name: "Document any journal notes in ARIA", attributes: { system: ["ARIA"], document: ["Journal Notes"], role: ["CT Therapist"] } },
          { id: "P_19", name: "Complete 'CT' appointment in ARIA", attributes: { system: ["ARIA"], status: ["CT Appt Completed"] } },
          { id: "P_20", name: "'Pre-RO' task in ARIA is initiated", attributes: { system: ["ARIA"], role: ["RO"] } },
          { id: "P_21", name: "Booking clerk schedules the remainder of treatment appts.", attributes: { role: ["Booking Clerk"], output: ["Full Treatment Schedule"] } },
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

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUserId(user.uid);
        setCurrentUser(user);
        console.log("Authenticated with user ID:", user.uid);
        if (user.providerData.length > 0) {
          console.log("User signed in with:", user.providerData[0].providerId);
        } else {
          console.log("User signed in anonymously");
        }
      } else {
        // Don't automatically sign in anonymously - let user choose
        console.log("No user signed in");
      }
      setLoadingFirebase(false);
    });

    return () => unsubscribe(); // Cleanup subscription
  }, [auth, firebaseConfig.projectId]); // Depend on auth and projectId to re-run if they become available

  // --- Data Fetching Effects (Firestore) ---
  // Effect to fetch ALL Process Titles from ALL users using a Collection Group Query
  useEffect(() => {
    // Only proceed with Firestore data fetching if db and currentUserId are available
    // and Firebase is configured (not in demo mode)
    if (!db || !currentUserId || !firebaseConfig.projectId) {
      return;
    }

    setLoadingData(true);
    // Query the 'processTitles' collection group
    // Note: Collection Group Queries require a Firestore index if you use orderBy or where clauses.
    // Firebase console will provide a link to create it if needed.
    const processTitlesCollectionGroupRef = collectionGroup(db, 'processTitles');

    const unsubscribeProcessTitles = onSnapshot(query(processTitlesCollectionGroupRef), (snapshot) => {
      const fetchedTitles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), userId: doc.ref.parent.parent.id })); // Capture userId
      fetchedTitles.sort((a, b) => a.name.localeCompare(b.name));
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
  }, [db, currentUserId, firebaseConfig.appId, activeProcessTitleId, firebaseConfig.projectId]);

  // Effect to fetch Sub-processes for the active tab (now needs to know the owner's userId)
  useEffect(() => {
    if (!db || !currentUserId || !activeProcessTitleId || !firebaseConfig.projectId) {
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

    const subProcessesRef = collection(db, `artifacts/${firebaseConfig.appId}/users/${processTitleOwnerUserId}/processTitles/${activeProcessTitleId}/subProcesses`);
    const unsubscribeSubProcesses = onSnapshot(query(subProcessesRef), (snapshot) => {
      const fetchedSubProcesses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      fetchedSubProcesses.sort((a, b) => a.name.localeCompare(b.name));
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
  }, [db, currentUserId, activeProcessTitleId, selectedSubProcess, firebaseConfig.appId, firebaseConfig.projectId, processTitles]); // Added processTitles to dependencies

  // --- Handlers for Process Titles ---
  const handleAddProcessTitle = async (name, dependsOn) => {
    if (!db || !currentUserId || !firebaseConfig.projectId) {
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
      await setDoc(doc(db, `artifacts/${firebaseConfig.appId}/users/${currentUserId}/processTitles`, newId), { name, dependsOn: dependsOn || null });
      console.log("Process title added:", name);
      // setActiveProcessTitleId(newId); // This will be handled by the onSnapshot listener
    } catch (e) {
      console.error("Error adding process title: ", e);
      alert("Error saving process title.");
    }
  };

  const handleEditProcessTitle = async (id, newName, newDependsOn) => {
    if (!db || !currentUserId || !firebaseConfig.projectId) {
      alert("Database not ready. Please wait for authentication or configure Firebase.");
      return;
    }
    // Find the userId owner of this process title
    const processTitleOwnerUserId = processTitles.find(pt => pt.id === id)?.userId;
    if (!processTitleOwnerUserId || processTitleOwnerUserId !== currentUserId) {
        alert("You can only edit process titles you created.");
        return;
    }
    try {
      await updateDoc(doc(db, `artifacts/${firebaseConfig.appId}/users/${currentUserId}/processTitles`, id), {
        name: newName,
        dependsOn: newDependsOn || null
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
    if (!db || !currentUserId || !firebaseConfig.projectId) {
      alert("Database not ready. Please wait for authentication or configure Firebase.");
      return;
    }
    // Find the userId owner of this process title
    const processTitleOwnerUserId = processTitles.find(pt => pt.id === id)?.userId;
    if (!processTitleOwnerUserId || processTitleOwnerUserId !== currentUserId) {
        alert("You can only delete process titles you created.");
        return;
    }
    try {
      // Delete all sub-processes first (more complex, requires fetching them)
      const subProcessesCollectionRef = collection(db, `artifacts/${firebaseConfig.appId}/users/${currentUserId}/processTitles/${id}/subProcesses`);
      const subProcessDocs = await getDocs(query(subProcessesCollectionRef));
      const batch = writeBatch(db);
      subProcessDocs.forEach((subDoc) => {
        batch.delete(subDoc.ref);
      });
      await batch.commit();

      // Then delete the process title document itself
      await deleteDoc(doc(db, `artifacts/${firebaseConfig.appId}/users/${currentUserId}/processTitles`, id));
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
  const handleAddSubProcess = async (name) => {
    if (!db || !currentUserId || !activeProcessTitleId || !firebaseConfig.projectId) {
      alert("Please select a Process Title first or configure Firebase.");
      return;
    }
    // Ensure sub-process is added under the owner of the active process title
    const processTitleOwnerUserId = processTitles.find(pt => pt.id === activeProcessTitleId)?.userId;
    if (!processTitleOwnerUserId || processTitleOwnerUserId !== currentUserId) {
        alert("You can only add sub-processes to process titles you created.");
        return;
    }

    const newId = `SP_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    try {
      await setDoc(doc(db, `artifacts/${firebaseConfig.appId}/users/${currentUserId}/processTitles/${activeProcessTitleId}/subProcesses`, newId), { name, attributes: {} });
      console.log("Sub-process added:", name);
    } catch (e) {
      console.error("Error adding sub-process: ", e);
      alert("Error saving sub-process.");
    }
  };

  const handleEditSubProcess = async (id, newName) => {
    if (!db || !currentUserId || !activeProcessTitleId || !firebaseConfig.projectId) {
      alert("Database not ready. Please wait for authentication or configure Firebase.");
      return;
    }
    // Ensure sub-process is edited under the owner of its parent process title
    const processTitleOwnerUserId = processTitles.find(pt => pt.id === activeProcessTitleId)?.userId;
    if (!processTitleOwnerUserId || processTitleOwnerUserId !== currentUserId) {
        alert("You can only edit sub-processes of process titles you created.");
        return;
    }
    try {
      await updateDoc(doc(db, `artifacts/${firebaseConfig.appId}/users/${currentUserId}/processTitles/${activeProcessTitleId}/subProcesses`, id), {
        name: newName
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
    if (!db || !currentUserId || !activeProcessTitleId || !firebaseConfig.projectId) {
      alert("Database not ready. Please wait for authentication or configure Firebase.");
      return;
    }
    // Ensure sub-process is deleted under the owner of its parent process title
    const processTitleOwnerUserId = processTitles.find(pt => pt.id === activeProcessTitleId)?.userId;
    if (!processTitleOwnerUserId || processTitleOwnerUserId !== currentUserId) {
        alert("You can only delete sub-processes of process titles you created.");
        return;
    }
    try {
      await deleteDoc(doc(db, `artifacts/${firebaseConfig.appId}/users/${currentUserId}/processTitles/${activeProcessTitleId}/subProcesses`, id));
      console.log(`Sub-process ${id} deleted.`);
      // If the deleted sub-process was selected, deselect it
      if (selectedSubProcess && selectedSubProcess.id === id) {
        setSelectedSubProcess(null);
      }
    } catch (e) {
      console.error("Error deleting sub-process: ", e);
      alert("Error deleting sub-process.");
    } finally {
      setIsDeleteSubProcessModalOpen(false);
      setSubProcessToDelete(null);
    }
  };

  const handleUpdateSubProcessAttributes = useCallback(async (updatedSubProcess) => {
    if (!db || !currentUserId || !activeProcessTitleId || !updatedSubProcess || !firebaseConfig.projectId) {
      alert("Cannot save: Database not ready, no sub-process selected, or Firebase not configured.");
      return;
    }
    // Ensure attributes are updated under the owner of its parent process title
    const processTitleOwnerUserId = processTitles.find(pt => pt.id === activeProcessTitleId)?.userId;
    if (!processTitleOwnerUserId || processTitleOwnerUserId !== currentUserId) {
        alert("You can only update attributes of sub-processes you created.");
        return;
    }
    try {
      await setDoc(doc(db, `artifacts/${firebaseConfig.appId}/users/${currentUserId}/processTitles/${activeProcessTitleId}/subProcesses`, updatedSubProcess.id), {
        name: updatedSubProcess.name, // Ensure name is also saved if it was passed in the updated object
        attributes: JSON.parse(JSON.stringify(updatedSubProcess.attributes)) // Deep copy to ensure no mutation issues
      });
      console.log("Sub-process attributes updated:", updatedSubProcess.name);
      alert(`Changes for "${updatedSubProcess.name}" saved!`);
    } catch (e) {
      console.error("Error updating sub-process attributes: ", e);
      alert("Error saving sub-process attributes.");
    }
  }, [db, currentUserId, activeProcessTitleId, firebaseConfig.appId, firebaseConfig.projectId, processTitles]);


  if (loadingFirebase) {
    return <Layout currentUser={currentUser}><div className="text-center py-8 text-gray-600">Initializing Firebase...</div></Layout>;
  }

  // Show login prompt if not authenticated
  if (!currentUser) {
    return (
      <Layout currentUser={currentUser}>
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
          <div className="max-w-md w-full space-y-8 p-8">
            <div className="text-center">
              <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
                Welcome to Verspeeten CI Management
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                Please sign in to access your process management dashboard
              </p>
            </div>
            <div className="mt-8 space-y-4">
              <button
                onClick={signInWithGoogle}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Sign in with Google
              </button>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-gray-50 text-gray-500">Or</span>
                </div>
              </div>
              
              <button
                onClick={signInAnonymously}
                className="w-full flex justify-center py-3 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
              >
                Continue as Guest
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <FirebaseContext.Provider value={{ 
      db, 
      auth, 
      currentUserId, 
      currentUser,
      signInWithGoogle,
      signInAnonymously,
      handleSignOut,
      firebaseAppId: firebaseConfig.appId 
    }}>
      <Layout
        userId={currentUserId}
        currentUser={currentUser}
        onAddProcessTitle={handleAddProcessTitle}
        processTitles={processTitles}
        onEditProcessTitle={(pt) => { setProcessTitleToEdit(pt); setIsEditProcessTitleModalOpen(true); }}
        onDeleteProcessTitle={(pt) => { setProcessTitleToDelete(pt); setIsDeleteProcessTitleModalOpen(true); }}
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
                      <span className={`flex-grow ${selectedSubProcess?.id === sp.id ? 'text-blue-800' : 'text-gray-800'} font-semibold`}>{sp.name}</span>
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
                <AttributeForm subProcess={selectedSubProcess} onSave={handleUpdateSubProcessAttributes} />
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
            onConfirm={async (newName, newDependsOn) => {
              await handleAddProcessTitle(newName, newDependsOn);
              setIsAddProcessTitleModalOpen(false);
            }}
            initialName=""
            initialDependency=""
            processTitles={processTitles}
          />
        )}

        {/* Edit Process Title Modal */}
        {isEditProcessTitleModalOpen && processTitleToEdit && (
          <Modal
            title="Edit Process Title"
            onClose={() => { setIsEditProcessTitleModalOpen(false); setProcessTitleToEdit(null); }}
            onConfirm={async (newName, newDependsOn) => {
              await handleEditProcessTitle(processTitleToEdit.id, newName, newDependsOn);
            }}
            initialName={processTitleToEdit.name}
            initialDependency={processTitleToEdit.dependsOn}
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
            onConfirm={async (newName) => {
              await handleEditSubProcess(subProcessToEdit.id, newName);
            }}
            initialName={subProcessToEdit.name}
            isSubProcess={true} // Indicate it's a sub-process edit
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
            onConfirm={async (name) => {
              await handleAddSubProcess(name);
              setIsAddSubProcessModalOpen(false);
              setSubProcessNameInput("");
            }}
            initialName={subProcessNameInput}
            isSubProcess={true}
          />
        )}
      </Layout>
    </FirebaseContext.Provider>
  );
}