// pages/index.js
import { useState, useEffect, useContext } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, onSnapshot, query } from 'firebase/firestore';
import Layout from '../components/Layout';
import AttributeForm from '../components/AttributeForm';
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
  const [loadingFirebase, setLoadingFirebase] = useState(true);
  const [loadingData, setLoadingData] = useState(true); // Keep true initially
  const [processTitles, setProcessTitles] = useState([]);
  const [subProcesses, setSubProcesses] = useState({});
  const [activeProcessTitleId, setActiveProcessTitleId] = useState(null);
  const [selectedSubProcess, setSelectedSubProcess] = useState(null);

  // --- Firebase Authentication Effect ---
  useEffect(() => {
    // If Firebase is not configured via .env.local, skip Firebase auth/data fetching
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
        console.log("Authenticated with user ID:", user.uid);
      } else {
        try {
          // Attempt anonymous sign-in if no user is found
          await signInAnonymously(auth);
        } catch (error) {
          console.error("Firebase authentication error:", error);
          // Handle specific errors like 'auth/network-request-failed' or 'auth/internal-error'
          // You might want to show a user-friendly message here
        }
      }
      setLoadingFirebase(false);
    });

    return () => unsubscribe(); // Cleanup subscription
  }, [auth, firebaseConfig.projectId]); // Depend on auth and projectId to re-run if they become available

  // --- Data Fetching Effects (Firestore) ---
  useEffect(() => {
    // Only proceed with Firestore data fetching if db and currentUserId are available
    // and Firebase is configured (not in demo mode)
    if (!db || !currentUserId || !firebaseConfig.projectId) {
      return;
    }

    setLoadingData(true);
    const processTitlesRef = collection(db, `artifacts/${firebaseConfig.appId}/users/${currentUserId}/processTitles`);
    const unsubscribeProcessTitles = onSnapshot(query(processTitlesRef), (snapshot) => {
      const fetchedTitles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      fetchedTitles.sort((a, b) => a.name.localeCompare(b.name));
      setProcessTitles(fetchedTitles);
      setLoadingData(false);

      // If no active tab or active tab no longer exists, set the first one
      if (fetchedTitles.length > 0 && (!activeProcessTitleId || !fetchedTitles.some(t => t.id === activeProcessTitleId))) {
        setActiveProcessTitleId(fetchedTitles[0].id);
      } else if (fetchedTitles.length === 0) {
        setActiveProcessTitleId(null);
      }
    }, (error) => {
      console.error("Error fetching process titles:", error);
      setLoadingData(false);
    });

    return () => unsubscribeProcessTitles();
  }, [db, currentUserId, firebaseConfig.appId, activeProcessTitleId, firebaseConfig.projectId]);

  useEffect(() => {
    if (!db || !currentUserId || !activeProcessTitleId || !firebaseConfig.projectId) {
      setSubProcesses(prev => ({ ...prev, [activeProcessTitleId]: [] }));
      return;
    }

    setLoadingData(true);
    const subProcessesRef = collection(db, `artifacts/${firebaseConfig.appId}/users/${currentUserId}/processTitles/${activeProcessTitleId}/subProcesses`);
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
      setLoadingData(false);
    });

    return () => unsubscribeSubProcesses();
  }, [db, currentUserId, activeProcessTitleId, selectedSubProcess, firebaseConfig.appId, firebaseConfig.projectId]);

  // --- Handlers ---
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
      await setDoc(doc(db, `artifacts/${firebaseConfig.appId}/users/${currentUserId}/processTitles`, newId), { name, dependsOn: dependsOn || null });
      console.log("Process title added:", name);
      setActiveProcessTitleId(newId); // Switch to new tab
    } catch (e) {
      console.error("Error adding process title: ", e);
      alert("Error saving process title.");
    }
  };

  const handleAddSubProcess = async (name) => {
    if (!db || !currentUserId || !activeProcessTitleId || !firebaseConfig.projectId) {
      alert("Please select a Process Title first or configure Firebase.");
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

  const handleUpdateSubProcess = async (updatedSubProcess) => {
    if (!db || !currentUserId || !activeProcessTitleId || !updatedSubProcess || !firebaseConfig.projectId) {
      alert("Cannot save: Database not ready, no sub-process selected, or Firebase not configured.");
      return;
    }
    try {
      await setDoc(doc(db, `artifacts/${firebaseConfig.appId}/users/${currentUserId}/processTitles/${activeProcessTitleId}/subProcesses`, updatedSubProcess.id), {
        name: updatedSubProcess.name,
        attributes: updatedSubProcess.attributes
      });
      console.log("Sub-process updated:", updatedSubProcess.name);
      alert(`Changes for "${updatedSubProcess.name}" saved!`);
    } catch (e) {
      console.error("Error updating sub-process: ", e);
      alert("Error saving sub-process.");
    }
  };

  if (loadingFirebase) {
    return <Layout><div className="text-center py-8 text-gray-600">Initializing Firebase...</div></Layout>;
  }

  return (
    <FirebaseContext.Provider value={{ db, auth, currentUserId, firebaseAppId: firebaseConfig.appId }}>
      <Layout userId={currentUserId} onAddProcessTitle={handleAddProcessTitle} processTitles={processTitles}>
        <div className="flex flex-col md:flex-row flex-grow p-4 gap-4">
          {/* Tabs Container */}
          <div className="bg-white rounded-xl shadow-md p-4 w-full md:w-64 flex-shrink-0">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Process Titles</h2>
            <div className="flex flex-col gap-2">
              {processTitles.length === 0 ? (
                <p className="text-gray-500 italic">No process titles yet. Add one!</p>
              ) : (
                processTitles.map(pt => (
                  <button
                    key={pt.id}
                    className={`p-3 rounded-lg text-left font-semibold transition-colors duration-200 ${
                      pt.id === activeProcessTitleId ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    onClick={() => setActiveProcessTitleId(pt.id)}
                  >
                    {pt.name}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Main Content Area (Sub-process List and Attribute Form) */}
          <div className="bg-white rounded-xl shadow-md flex-grow flex flex-col md:flex-row overflow-hidden">
            {/* Sub-process List */}
            <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-gray-200 p-4 flex flex-col">
              <h3 className="text-lg font-bold mb-3 text-gray-800">{processTitles.find(pt => pt.id === activeProcessTitleId)?.name || 'Select a Process'}</h3>
              {loadingData && <div className="text-center text-gray-500 text-sm">Loading sub-processes...</div>}
              <ul className="flex-grow overflow-y-auto mb-4">
                {(subProcesses[activeProcessTitleId] || []).length === 0 && !loadingData ? (
                  <li className="text-gray-500 italic p-2">No sub-processes defined for this section.</li>
                ) : (
                  (subProcesses[activeProcessTitleId] || []).map(sp => (
                    <li
                      key={sp.id}
                      className={`p-2 mb-1 rounded-md cursor-pointer transition-colors duration-200 ${
                        selectedSubProcess?.id === sp.id ? 'bg-blue-100 border-blue-500 border font-semibold' : 'hover:bg-gray-50'
                      }`}
                      onClick={() => setSelectedSubProcess(sp)}
                    >
                      {sp.name}
                    </li>
                  ))
                )}
              </ul>
              <button
                className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
                onClick={() => {
                  const subProcessName = prompt("Enter new sub-process name:");
                  if (subProcessName) handleAddSubProcess(subProcessName);
                }}
              >
                Add New Sub-process
              </button>
            </div>

            {/* Attribute Form */}
            <div className="flex-grow p-4 overflow-y-auto">
              <h3 className="text-lg font-bold mb-4 text-gray-800">
                {selectedSubProcess ? `Attributes for: ${selectedSubProcess.name}` : 'Select a Sub-process'}
              </h3>
              {selectedSubProcess ? (
                <AttributeForm subProcess={selectedSubProcess} onSave={handleUpdateSubProcess} />
              ) : (
                <p className="text-gray-500 italic">Click a sub-process to view and edit its attributes.</p>
              )}
            </div>
          </div>
        </div>
      </Layout>
    </FirebaseContext.Provider>
  );
}




// // pages/index.js
// import { useState, useEffect, useContext } from 'react';
// import { initializeApp } from 'firebase/app';
// import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
// import { getFirestore, collection, doc, setDoc, onSnapshot, query } from 'firebase/firestore';
// import Layout from '../components/Layout';
// import AttributeForm from '../components/AttributeForm';
// import FirebaseContext from '../lib/FirebaseContext'; // Import the centralized context

// // --- Firebase Configuration (REPLACE WITH YOUR OWN) ---
// // You will get this from your Firebase project settings after creating it.
// // For local development, create a .env.local file in your project root and add these:
// // NEXT_PUBLIC_FIREBASE_API_KEY=YOUR_API_KEY
// // NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=YOUR_AUTH_DOMAIN
// // NEXT_PUBLIC_FIREBASE_PROJECT_ID=YOUR_PROJECT_ID
// // NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=YOUR_STORAGE_BUCKET
// // NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=YOUR_MESSAGING_SENDER_ID
// // NEXT_PUBLIC_FIREBASE_APP_ID=YOUR_APP_ID
// const firebaseConfig = {
//   apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
//   authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
//   projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
//   storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
//   messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
//   appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
// };

// // Initialize Firebase (only once, safely)
// let app;
// let db;
// let auth;

// if (typeof window !== 'undefined' && firebaseConfig.projectId && !app) {
//   try {
//     app = initializeApp(firebaseConfig);
//     db = getFirestore(app);
//     auth = getAuth(app);
//     console.log("Firebase initialized.");
//   } catch (error) {
//     console.error("Firebase initialization error:", error);
//   }
// } else if (typeof window !== 'undefined' && !firebaseConfig.projectId) {
//   console.warn("Firebase config not found. Running in demo mode without persistence.");
// }

// export default function Home() {
//   const [currentUserId, setCurrentUserId] = useState(null);
//   const [loadingFirebase, setLoadingFirebase] = useState(true);
//   const [loadingData, setLoadingData] = useState(true);
//   const [processTitles, setProcessTitles] = useState([]);
//   const [subProcesses, setSubProcesses] = useState({});
//   const [activeProcessTitleId, setActiveProcessTitleId] = useState(null);
//   const [selectedSubProcess, setSelectedSubProcess] = useState(null);

//   // --- Firebase Authentication Effect ---
//   useEffect(() => {
//     if (!auth) {
//       setLoadingFirebase(false);
//       return; // Firebase not initialized (e.g., missing config)
//     }

//     const unsubscribe = onAuthStateChanged(auth, async (user) => {
//       if (user) {
//         setCurrentUserId(user.uid);
//         console.log("Authenticated with user ID:", user.uid);
//       } else {
//         try {
//           // Sign in anonymously if not already authenticated
//           await signInAnonymously(auth);
//         } catch (error) {
//           console.error("Firebase anonymous sign-in error:", error);
//         }
//       }
//       setLoadingFirebase(false);
//     });

//     return () => unsubscribe(); // Cleanup subscription
//   }, []);
//   // --- Data Fetching Effects (Firestore) ---
  
//     useEffect(() => {
//       // Condition to use in-memory demo data
//       if (!db || !currentUserId || !firebaseConfig.projectId) { // Check all conditions for demo data
//         console.log("Using demo data due to missing db, currentUserId, or projectId.");
//         setProcessTitles([
//           { id: "PT_BOOKING", name: "Booking", dependsOn: null },
//           { id: "PT_CT_SIM", name: "CT SIM", dependsOn: "PT_BOOKING" }
//         ]);
//         setSubProcesses({
//           "PT_BOOKING": [
//             { id: "P_01", name: "Patient consults with RO", attributes: { role: ["RO"], output: ["eBAF (initial)"], description: "Initial consultation with Radiation Oncologist." } },
//             { id: "P_02", name: "RO completes eBAF during consult", attributes: { role: ["RO"], input: ["eBAF (initial)"], output: ["eBAF (completed)"], system: ["Paper/Digital Form"] } },
//             { id: "P_03", name: "Clerk books CT appt", attributes: { role: ["Clerk"], input: ["eBAF (completed)"], output: ["CT Appt (booked)"], system: ["Cerner"] } },
//             { id: "P_04", name: "Enter CT SIM appt details into ARIA", attributes: { system: ["ARIA"], input: ["CT Appt (booked)"], document: ["CT SIM Appt Details"] } },
//             { id: "P_05", name: "CT therapist reviews patient info from EBAF in Cerner", attributes: { role: ["CT Therapist"], system: ["Cerner"], input: ["eBAF (completed)"] } },
//             { id: "P_06", name: "Patient CT SIM and 10 initial treatment appts. booked", attributes: { status: ["Completed"], output: ["Initial Treatment Schedule"] } },
//           ],
//           "PT_CT_SIM": [
//             { id: "P_07", name: "CT therapist reviews next day CT schedule and EBAF in Cerner", attributes: { role: ["CT Therapist"], system: ["Cerner"], input: ["Next Day CT Schedule", "eBAF"] } },
//             { id: "P_08", name: "Review patient demographics, RTT dates, disease codes, RO in ARIA", attributes: { system: ["ARIA"], role: ["CT Therapist", "RO"], input: ["Patient Demographics"] } },
//             { id: "P_09", name: "Assign care path template in ARIA to patient", attributes: { system: ["ARIA"], output: ["Care Path Template"] } },
//             { id: "P_10", name: "Enter patient info in RTP Dosimetry Tracking System", attributes: { system: ["RTP Dosimetry Tracking System"], input: ["Patient Info"] } },
//             { id: "P_11", name: "Enter Patient info into CT Scanner Phillips System", attributes: { system: ["CT Scanner Phillips System"], input: ["Patient Info"] } },
//             { id: "P_12", name: "Document the contrast provided as a journal note", attributes: { document: ["Journal Note (Contrast)"], role: ["CT Therapist"] } },
//             { id: "P_13", name: "Booking clerk checks patient in for CT SIM", attributes: { role: ["Booking Clerk"], status: ["Patient Checked In"] } },
//             { id: "P_14", name: "Complete CT checklist in ARIA", attributes: { system: ["ARIA"], document: ["CT Checklist"], role: ["CT Therapist"] } },
//             { id: "P_15", name: "Scan patient", attributes: { equipment: ["CT Scanner"], output: ["CT Scan Images"] } },
//             { id: "P_16", name: "Indicate set-up instructions in ARIA document", attributes: { system: ["ARIA"], document: ["Set-up Instructions"], role: ["CT Therapist"] } },
//             { id: "P_17", name: "Save loc sheet as document in ARIA", attributes: { system: ["ARIA"], document: ["Loc Sheet"], role: ["CT Therapist"] } },
//             { id: "P_18", name: "Document any journal notes in ARIA", attributes: { system: ["ARIA"], document: ["Journal Notes"], role: ["CT Therapist"] } },
//             { id: "P_19", name: "Complete 'CT' appointment in ARIA", attributes: { system: ["ARIA"], status: ["CT Appt Completed"] } },
//             { id: "P_20", name: "'Pre-RO' task in ARIA is initiated", attributes: { system: ["ARIA"], role: ["RO"] } },
//             { id: "P_21", name: "Booking clerk schedules the remainder of treatment appts.", attributes: { role: ["Booking Clerk"], output: ["Full Treatment Schedule"] } },
//           ]
//         });
//         setLoadingData(false);
//         return; // Exit if using demo data
//       }
  
//       // Only proceed with Firestore if db, currentUserId, and projectId are available
//       setLoadingData(true);
//       const processTitlesRef = collection(db, `artifacts/${firebaseConfig.appId}/users/${currentUserId}/processTitles`);
//       const unsubscribeProcessTitles = onSnapshot(query(processTitlesRef), (snapshot) => {
//         const fetchedTitles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
//         fetchedTitles.sort((a, b) => a.name.localeCompare(b.name));
//         setProcessTitles(fetchedTitles);
//         setLoadingData(false);
  
//         // If no active tab or active tab no longer exists, set the first one
//         if (fetchedTitles.length > 0 && (!activeProcessTitleId || !fetchedTitles.some(t => t.id === activeProcessTitleId))) {
//           setActiveProcessTitleId(fetchedTitles[0].id);
//         } else if (fetchedTitles.length === 0) {
//           setActiveProcessTitleId(null);
//         }
//       }, (error) => {
//         console.error("Error fetching process titles:", error);
//         setLoadingData(false);
//       });
  
//       // Cleanup function for the effect
//       return () => unsubscribeProcessTitles();
//     }, [db, currentUserId, firebaseConfig.appId, activeProcessTitleId, firebaseConfig.projectId, setActiveProcessTitleId]);

//   useEffect(() => {
//     if (!db || !currentUserId || !activeProcessTitleId) {
//       setSubProcesses(prev => ({ ...prev, [activeProcessTitleId]: [] }));
//       return;
//     }

//     setLoadingData(true);
//     const subProcessesRef = collection(db, `artifacts/${firebaseConfig.appId}/users/${currentUserId}/processTitles/${activeProcessTitleId}/subProcesses`);
//     const unsubscribeSubProcesses = onSnapshot(query(subProcessesRef), (snapshot) => {
//       const fetchedSubProcesses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
//       fetchedSubProcesses.sort((a, b) => a.name.localeCompare(b.name));
//       setSubProcesses(prev => ({ ...prev, [activeProcessTitleId]: fetchedSubProcesses }));
//       setLoadingData(false);

//       // Deselect sub-process if it no longer exists in the current tab
//       if (selectedSubProcess && !fetchedSubProcesses.some(sp => sp.id === selectedSubProcess.id)) {
//         setSelectedSubProcess(null);
//       }
//     }, (error) => {
//       console.error(`Error fetching sub-processes for ${activeProcessTitleId}:`, error);
//       setLoadingData(false);
//     });

//     return () => unsubscribeSubProcesses();
//   }, [db, currentUserId, activeProcessTitleId, selectedSubProcess, firebaseConfig.appId]);

//   // --- Handlers ---
//   const handleAddProcessTitle = async (name, dependsOn) => {
//     if (!db || !currentUserId) {
//       alert("Database not ready. Please wait for authentication or configure Firebase.");
//       return;
//     }
//     const newId = "PT_" + name.toUpperCase().replace(/[^A-Z0-9]/g, '_');
//     if (processTitles.some(pt => pt.id === newId)) {
//       alert("A process with a similar name already exists. Please choose a different name.");
//       return;
//     }
//     try {
//       await setDoc(doc(db, `artifacts/${firebaseConfig.appId}/users/${currentUserId}/processTitles`, newId), { name, dependsOn: dependsOn || null });
//       console.log("Process title added:", name);
//       setActiveProcessTitleId(newId); // Switch to new tab
//     } catch (e) {
//       console.error("Error adding process title: ", e);
//       alert("Error saving process title.");
//     }
//   };

//   const handleAddSubProcess = async (name) => {
//     if (!db || !currentUserId || !activeProcessTitleId) {
//       alert("Please select a Process Title first or configure Firebase.");
//       return;
//     }
//     const newId = `SP_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
//     try {
//       await setDoc(doc(db, `artifacts/${firebaseConfig.appId}/users/${currentUserId}/processTitles/${activeProcessTitleId}/subProcesses`, newId), { name, attributes: {} });
//       console.log("Sub-process added:", name);
//     } catch (e) {
//       console.error("Error adding sub-process: ", e);
//       alert("Error saving sub-process.");
//     }
//   };

//   const handleUpdateSubProcess = async (updatedSubProcess) => {
//     if (!db || !currentUserId || !activeProcessTitleId || !updatedSubProcess) {
//       alert("Cannot save: Database not ready, no sub-process selected, or Firebase not configured.");
//       return;
//     }
//     try {
//       await setDoc(doc(db, `artifacts/${firebaseConfig.appId}/users/${currentUserId}/processTitles/${activeProcessTitleId}/subProcesses`, updatedSubProcess.id), {
//         name: updatedSubProcess.name,
//         attributes: updatedSubProcess.attributes
//       });
//       console.log("Sub-process updated:", updatedSubProcess.name);
//       alert(`Changes for "${updatedSubProcess.name}" saved!`);
//     } catch (e) {
//       console.error("Error updating sub-process: ", e);
//       alert("Error saving sub-process.");
//     }
//   };

//   if (loadingFirebase) {
//     return <Layout><div className="text-center py-8 text-gray-600">Initializing Firebase...</div></Layout>;
//   }

//   return (
//     <FirebaseContext.Provider value={{ db, auth, currentUserId, firebaseAppId: firebaseConfig.appId }}>
//       <Layout userId={currentUserId} onAddProcessTitle={handleAddProcessTitle} processTitles={processTitles}>
//         <div className="flex flex-col md:flex-row flex-grow p-4 gap-4">
//           {/* Tabs Container */}
//           <div className="bg-white rounded-xl shadow-md p-4 w-full md:w-64 flex-shrink-0">
//             <h2 className="text-xl font-bold mb-4 text-gray-800">Process Titles</h2>
//             <div className="flex flex-col gap-2">
//               {processTitles.length === 0 ? (
//                 <p className="text-gray-500 italic">No process titles yet. Add one!</p>
//               ) : (
//                 processTitles.map(pt => (
//                   <button
//                     key={pt.id}
//                     className={`p-3 rounded-lg text-left font-semibold transition-colors duration-200 ${
//                       pt.id === activeProcessTitleId ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
//                     }`}
//                     onClick={() => setActiveProcessTitleId(pt.id)}
//                   >
//                     {pt.name}
//                   </button>
//                 ))
//               )}
//             </div>
//           </div>

//           {/* Main Content Area (Sub-process List and Attribute Form) */}
//           <div className="bg-white rounded-xl shadow-md flex-grow flex flex-col md:flex-row overflow-hidden">
//             {/* Sub-process List */}
//             <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-gray-200 p-4 flex flex-col">
//               <h3 className="text-lg font-bold mb-3 text-gray-800">{processTitles.find(pt => pt.id === activeProcessTitleId)?.name || 'Select a Process'}</h3>
//               {loadingData && <div className="text-center text-gray-500 text-sm">Loading sub-processes...</div>}
//               <ul className="flex-grow overflow-y-auto mb-4">
//                 {(subProcesses[activeProcessTitleId] || []).length === 0 && !loadingData ? (
//                   <li className="text-gray-500 italic p-2">No sub-processes defined for this section.</li>
//                 ) : (
//                   (subProcesses[activeProcessTitleId] || []).map(sp => (
//                     <li
//                       key={sp.id}
//                       className={`p-2 mb-1 rounded-md cursor-pointer transition-colors duration-200 ${
//                         selectedSubProcess?.id === sp.id ? 'bg-blue-100 border-blue-500 border font-semibold' : 'hover:bg-gray-50'
//                       }`}
//                       onClick={() => setSelectedSubProcess(sp)}
//                     >
//                       {sp.name}
//                     </li>
//                   ))
//                 )}
//               </ul>
//               <button
//                 className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
//                 onClick={() => {
//                   const subProcessName = prompt("Enter new sub-process name:");
//                   if (subProcessName) handleAddSubProcess(subProcessName);
//                 }}
//               >
//                 Add New Sub-process
//               </button>
//             </div>

//             {/* Attribute Form */}
//             <div className="flex-grow p-4 overflow-y-auto">
//               <h3 className="text-lg font-bold mb-4 text-gray-800">
//                 {selectedSubProcess ? `Attributes for: ${selectedSubProcess.name}` : 'Select a Sub-process'}
//               </h3>
//               {selectedSubProcess ? (
//                 <AttributeForm subProcess={selectedSubProcess} onSave={handleUpdateSubProcess} />
//               ) : (
//                 <p className="text-gray-500 italic">Click a sub-process to view and edit its attributes.</p>
//               )}
//             </div>
//           </div>
//         </div>
//       </Layout>
//     </FirebaseContext.Provider>
//   );
// }