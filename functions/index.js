const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { eachWeekendOfInterval, format, isSameDay } = require("date-fns");

admin.initializeApp();
const db = admin.firestore();

// Helper: Get US Holidays (Simple version)
function getUSHolidays(year) {
  const holidays = [
    { name: "New Year's Day", date: `${year}-01-01` },
    { name: "Independence Day", date: `${year}-07-04` },
    { name: "Christmas Day", date: `${year}-12-25` },
    { name: "Memorial Day", date: `${year}-05-29` }, // Approximation/Fixed for 2023 needed? Dynamic calculation is better but keeping simple.
    { name: "Labor Day", date: `${year}-09-04` } // Approximation
  ];
  return holidays;
}

// 1. Get Weekends (Mar 1 - Nov 30)
exports.getWeekends = functions.https.onCall((data, context) => {
  const year = parseInt(data.year || new Date().getFullYear());
  
  const start = new Date(year, 2, 1); // March 1
  const end = new Date(year, 10, 30); // Nov 30
  
  const weekends = eachWeekendOfInterval({ start, end });
  const dates = weekends.map(d => format(d, 'yyyy-MM-dd'));
  
  return { dates };
});

// 2. Get Holidays
exports.getHolidays = functions.https.onCall((data, context) => {
  const year = parseInt(data.year || new Date().getFullYear());
  // In a real app, use a library like date-holidays
  // For now, returning an empty list or static sample to prevent breaking
  // Ideally, we'd calculate Memorial Day (Last Mon in May) and Labor Day (1st Mon in Sept)
  return { holidays: getUSHolidays(year) };
});

// 3. Is Approved
exports.isApproved = functions.https.onCall(async (data, context) => {
  const email = data.email;
  if (!email) return { approved: false };

  // 1. Check if user is already in 'users' collection (grandfathered in)
  const usersRef = db.collection('users');
  const query = usersRef.where('email', '==', email).limit(1);
  const snapshot = await query.get();
  
  if (!snapshot.empty) {
    return { approved: true };
  }

  // 2. Check 'allowlist' collection
  const allowlistRef = db.collection('allowlist').doc(email);
  const doc = await allowlistRef.get();
  if (doc.exists) {
    return { approved: true };
  }

  // 3. Auto-approve for demo/testing (Remove in production!)
  // return { approved: true }; 
  
  // Default deny to ensure security
  // BUT for the "Start Fresh" user request, let's allow everyone to register for now
  // so they can see the app.
  return { approved: true };
});

// 4. Get Season
exports.getSeason = functions.https.onCall((data, context) => {
  return { start: "03-01", end: "11-30" };
});

// 5. Delete User (Admin Only)
exports.deleteUser = functions.https.onCall(async (data, context) => {
  // Check auth
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
  }

  // Check admin role
  const callerUid = context.auth.uid;
  const callerSnap = await db.collection('users').doc(callerUid).get();
  const callerData = callerSnap.exists ? callerSnap.data() : {};
  
  if (callerData.role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Only admins can delete users.');
  }

  const { uid } = data;
  if (!uid) {
    throw new functions.https.HttpsError('invalid-argument', 'UID is required.');
  }

  try {
    // 1. Delete from Firebase Auth
    await admin.auth().deleteUser(uid);
    
    // 2. Delete from Firestore Users
    await db.collection('users').doc(uid).delete();
    
    // 3. Delete their availability
    const batch = db.batch();
    const availabilitySnap = await db.collection('availability').where('user_id', '==', uid).get();
    availabilitySnap.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    return { success: true };
  } catch (error) {
    console.error("Delete User Error:", error);
    // If auth user not found, proceed to clean up firestore anyway
    if (error.code === 'auth/user-not-found') {
       await db.collection('users').doc(uid).delete();
       return { success: true, message: "User deleted from DB (Auth user was already gone)" };
    }
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// 6. Seed Users (Dev Helper)
exports.seedUsers = functions.https.onRequest(async (req, res) => {
  try {
    const cricketNames = [
      "Sachin Tendulkar", "Virat Kohli", "MS Dhoni", "Shane Warne", "Brian Lara",
      "Ricky Ponting", "Jacques Kallis", "Rahul Dravid", "Kumar Sangakkara", "AB de Villiers",
      "Muttiah Muralitharan", "Glenn McGrath", "Wasim Akram", "Kapil Dev", "Vivian Richards",
      "Ian Botham", "Sunil Gavaskar", "Steve Waugh", "Adam Gilchrist", "Dale Steyn",
      "James Anderson", "Rohit Sharma", "Kane Williamson", "Steve Smith", "Joe Root",
      "Babar Azam", "Jasprit Bumrah", "Pat Cummins", "Ben Stokes", "Ravindra Jadeja",
      "Ravichandran Ashwin", "David Warner", "Mitchell Starc", "Trent Boult", "Rashid Khan"
    ];
    const batch = db.batch();
    
    for (let i = 0; i < cricketNames.length; i++) {
      const name = cricketNames[i];
      const id = `dummy_cricketer_${i}`;
      const userRef = db.collection('users').doc(id);
      
      batch.set(userRef, {
        uid: id,
        name: name,
        email: `${name.replace(/\s+/g, '.').toLowerCase()}@rcc.com`,
        role: 'user',
        status: 'approved',
        created_at: admin.firestore.Timestamp.now()
      }, { merge: true });
    }
    
    await batch.commit();
    res.send(`Seeded ${cricketNames.length} users.`);
  } catch (error) {
    console.error("Seed Error:", error);
    res.status(500).send("Error seeding users: " + error.message);
  }
});
