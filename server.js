const express = require("express");
const admin = require("firebase-admin");
const crypto = require("crypto");
require("dotenv").config();

const app = express();

// Middleware for body parsing
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Firebase service account from Render env var
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

// Offerwall secret key (set this in Render env vars)
const SECRET_KEY = process.env.OW_SECRET_KEY;

// Postback endpoint
app.post("/api/offerwall/postback", async (req, res) => {
  try {
    // Support both body and query params
    const data = { ...req.query, ...req.body };

    console.log("📩 Offerwall Postback Received:", data);

    const { subId, transId, reward, signature, status } = data;

    if (!subId || !transId || !reward || !signature) {
      console.log("❌ Missing required parameters");
      return res.send("error");
    }

    // Verify signature: md5(subId + transId + reward + secretKey)
    const expectedSignature = crypto
      .createHash("md5")
      .update(subId + transId + reward + SECRET_KEY)
      .digest("hex");

    if (expectedSignature !== signature) {
      console.log("❌ Signature mismatch", { expectedSignature, signature });
      return res.send("error");
    }

    // Handle chargeback (status "2" = subtract)
    let rewardAmount = parseFloat(reward);
    if (status === "2") rewardAmount = -Math.abs(rewardAmount);

    // Prevent duplicates
    const txnRef = db.collection("offerwall_transactions").doc(transId);
    const txnSnap = await txnRef.get();
    if (txnSnap.exists) {
      console.log("⚠️ Duplicate transaction:", transId);
      return res.send("ok");
    }

    // Save transaction log
    await txnRef.set({
      ...data,
      reward: rewardAmount,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Update user balance
    const userRef = db.collection("telegramUsers").doc(subId);
    await userRef.set(
      {
        adsBalance: admin.firestore.FieldValue.increment(rewardAmount),
      },
      { merge: true }
    );

    console.log(`✅ Credited ${rewardAmount} to user ${subId} (tx: ${transId})`);
    return res.send("ok"); // Must be exactly "ok"
  } catch (err) {
    console.error("❌ Postback error:", err);
    return res.send("error");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Backend running on port ${PORT}`));
