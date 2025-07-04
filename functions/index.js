const functions = require("firebase-functions"); // Keep this
const admin = require("firebase-admin"); // Add admin for initialization
admin.initializeApp(); // Initialize Admin SDK

const ALLOWED_EMAILS = [
  "your.email@example.com",
  "colleague@example.com",
];

// V1 blocking function syntax
exports.beforeSignIn = functions.auth.user().beforeSignIn((event) => {
  const email = event.data.email;
  console.log("Attempted sign-in:", email);
  if (!ALLOWED_EMAILS.includes(email)) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "This email is not allowed to sign in."
    );
  }
  // Allow sign-in
  return event.data;
});