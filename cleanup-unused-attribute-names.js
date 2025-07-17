// cleanup-unused-attribute-names.js
// Dry run: Find attribute names in 'attributeNames' that are not used in any subprocess in 'artifacts'.
// Prints unused attribute names, does NOT delete them.

const admin = require('firebase-admin');
const path = require('path');

// TODO: Update this path to your service account key JSON file
// const serviceAccount = require('./serviceAccountKey.json');

// If running in an environment with GOOGLE_APPLICATION_CREDENTIALS set, you can skip the serviceAccount param
admin.initializeApp({
  // credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function main() {
  // 1. Fetch all attribute names
  const attrNamesSnap = await db.collection('attributeNames').get();
  const allAttributeNames = attrNamesSnap.docs.map(doc => doc.id);
  console.log(`Found ${allAttributeNames.length} attribute names in 'attributeNames' collection.`);

  // 2. Fetch all subprocesses from all users in 'artifacts'
  // We'll use a collection group query for 'subProcesses'
  const subProcessesSnap = await db.collectionGroup('subProcesses').get();
  console.log(`Found ${subProcessesSnap.size} subprocesses in all artifacts.`);

  // 3. Aggregate all attribute keys in use
  const usedAttributeNames = new Set();
  subProcessesSnap.forEach(docSnap => {
    const attrs = docSnap.data().attributes || {};
    Object.keys(attrs).forEach(key => usedAttributeNames.add(key));
  });
  console.log(`Found ${usedAttributeNames.size} unique attribute names in use.`);

  // 4. Find unused attribute names
  const unusedAttributeNames = allAttributeNames.filter(name => !usedAttributeNames.has(name));

  if (unusedAttributeNames.length === 0) {
    console.log('No unused attribute names found.');
  } else {
    console.log('Unused attribute names (would be deleted in a real run):');
    unusedAttributeNames.forEach(name => console.log('  -', name));
  }

  // 5. Done
  process.exit(0);
}

main().catch(err => {
  console.error('Error running cleanup script:', err);
  process.exit(1);
}); 