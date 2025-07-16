// index.js - HEAVILY LOGGED DIAGNOSTIC VERSION

const express = require("express");
const axios = require("axios");
const app = express();

app.use(express.json());

// --- CONFIGURATION ---
const ROBLOX_COOKIE = process.env.ROBLOX_COOKIE;
const GROUP_ID = process.env.GROUP_ID;
const SECRET_KEY = process.env.SECRET_KEY;

// A simple check to see if the server is running
app.get("/", (req, res) => {
  res.send("Proxy server is alive!");
});

async function getCsrfToken(cookie) {
  console.log("Attempting to get CSRF token...");
  try {
    // We send the request with the cookie provided to this function
    const response = await axios.post("https://auth.roblox.com/v2/logout", {}, {
      headers: { "Cookie": `.ROBLOSECURITY=${cookie}` }
    });
    return response.headers["x-csrf-token"];
  } catch (error) {
    if (error.response && error.response.headers["x-csrf-token"]) {
      console.log("Successfully got CSRF token from a 403 error (this is normal).");
      return error.response.headers["x-csrf-token"];
    }
    console.error("!!! CRITICAL: FAILED to get CSRF token. The cookie might be invalid. Error:", error.message);
    throw new Error("Could not retrieve CSRF token.");
  }
}

// --- API ENDPOINT ---
app.post("/set-rank", async (req, res) => {
  console.log("\n\n--- SERVER RECEIVED A /set-rank REQUEST! ---");
  
  // LOG 1: What did the request contain?
  console.log("Request Body Received:", req.body);
  const { userId, roleId, key } = req.body;

  // LOG 2: What are our environment variables?
  console.log("Server's Environment GROUP_ID:", GROUP_ID);
  console.log("Server's Environment SECRET_KEY:", SECRET_KEY);
  // We only log if the cookie exists and its length, never the full cookie for security.
  if (ROBLOX_COOKIE) {
    console.log("Server's Environment ROBLOX_COOKIE: Exists, Length:", ROBLOX_COOKIE.length);
  } else {
    console.error("!!! CRITICAL: ROBLOX_COOKIE is UNDEFINED or EMPTY in the environment!");
  }

  // LOG 3: Security Check
  console.log("Comparing received key with server's secret key...");
  if (key !== SECRET_KEY) {
    console.error("!!! CRITICAL: SECURITY CHECK FAILED! The keys do not match.");
    console.error(`Received Key: "${key}" | Server Key: "${SECRET_KEY}"`);
    return res.status(401).json({ success: false, message: "Unauthorized: Invalid secret key." });
  }
  console.log("Security check PASSED.");

  // LOG 4: Input Validation
  if (!userId || !roleId) {
    console.error("!!! CRITICAL: Missing userId or roleId in the request.");
    return res.status(400).json({ success: false, message: "Bad Request: userId and roleId are required." });
  }
  console.log(`Processing rank change for userId: ${userId} to roleId: ${roleId}`);

  try {
    const csrfToken = await getCsrfToken(ROBLOX_COOKIE);
    if (!csrfToken) {
      // The getCsrfToken function already logged the error.
      return res.status(500).json({ success: false, message: "Server-side error: Could not get CSRF token." });
    }

    const rankApiUrl = `https://groups.roblox.com/v1/groups/${GROUP_ID}/users/${userId}`;
    console.log("Sending PATCH request to Roblox API:", rankApiUrl);

    await axios.patch(rankApiUrl, { roleId: parseInt(roleId) }, {
      headers: {
        "Cookie": `.ROBLOSECURITY=${ROBLOX_COOKIE}`,
        "x-csrf-token": csrfToken,
        "Content-Type": "application/json"
      }
    });

    console.log("--- SUCCESS! Roblox API call seems to have succeeded. ---");
    return res.status(200).json({ success: true, message: "Rank updated successfully." });

  } catch (error) {
    const errorMessage = error.response ? (error.response.data.errors ? error.response.data.errors[0].message : "Unknown API error") : error.message;
    console.error("!!! CRITICAL: FAILED to rank user. Final Error:", errorMessage);
    return res.status(500).json({ success: false, message: `API Error: ${errorMessage}` });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Diagnostic server listening on port ${PORT}`);
  console.log("Waiting for requests...");
});
