# Firebase Rules Management

This project uses version-controlled Firebase security rules for better collaboration and tracking.

## Files

- `firestore.rules` - Main security rules file
- `firebase.json` - Firebase configuration
- `firestore.indexes.json` - Firestore indexes configuration

## How to Deploy Rules

### Option 1: Using Firebase CLI (Recommended)

1. **Install Firebase CLI globally:**
   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase:**
   ```bash
   firebase login
   ```

3. **Initialize Firebase (if not already done):**
   ```bash
   firebase init firestore
   ```

4. **Deploy rules:**
   ```bash
   npm run firebase:deploy-rules
   ```

### Option 2: Manual Deployment

1. Copy the contents of `firestore.rules`
2. Go to [Firebase Console](https://console.firebase.google.com)
3. Navigate to Firestore Database → Rules
4. Paste the rules and click "Publish"

## Version Control Benefits

✅ **Track changes** - See when and why rules were modified  
✅ **Rollback capability** - Revert to previous rule versions  
✅ **Team collaboration** - Multiple people can review rule changes  
✅ **Documentation** - Rules are documented alongside code  
✅ **Deployment consistency** - Same rules across environments  

## Current Rules Summary

The current rules allow:
- Only authenticated users from the allowed editors list
- Full read/write access to all data for collaboration
- No user-specific restrictions (all editors can edit all content)

## Allowed Editors

- runnerbrain@gmail.com
- editor2@gmail.com  
- samra.nasser@gmail.com
- ali.akkila@gmail.com

## Making Changes

1. Edit `firestore.rules`
2. Test locally (if possible)
3. Deploy using one of the methods above
4. Commit changes to git with descriptive message

Example commit message:
```
feat: Update Firebase rules to allow collaboration between editors

- Remove user-specific write restrictions
- Allow all authorized editors to modify any content
- Maintain security with email-based authentication
``` 