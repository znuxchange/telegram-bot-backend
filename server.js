const express = require("express");
const admin = require("firebase-admin");
require("dotenv").config();
const app = express();

// Parse service account from env
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// ✅ Postback endpoint
app.get("/api/offerwall/postback", async (req, res) => {
  try {
    const { user_id, transaction_id, amount, offer_name } = req.query;

    if (!user_id || !transaction_id || !amount) {
      return res.status(400).send("Missing params");
    }

    // 🔐 Prevent double-credit
    const txnRef = db.collection("offerwall_transactions").doc(transaction_id);
    const txnSnap = await txnRef.get();
    if (txnSnap.exists) {
      return res.status(200).send("Duplicate"); // already processed
    }

    // Save transaction log
    await txnRef.set({
      user_id,
      transaction_id,
      amount: Number(amount),
      offer_name: offer_name || "unknown",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Update user balance in Firestore
    const userRef = db.collection("telegramUsers").doc(user_id);
    await userRef.set(
      {
        balance: admin.firestore.FieldValue.increment(Number(amount)),
        adsBalance: admin.firestore.FieldValue.increment(Number(amount)),
      },
      { merge: true }
    );

    console.log(`✅ Credited ${amount} to user ${user_id}`);
    res.status(200).send("OK");
  } catch (err) {
    console.error("❌ Postback error:", err);
    res.status(500).send("Server error");
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Backend running on port ${PORT}`));
