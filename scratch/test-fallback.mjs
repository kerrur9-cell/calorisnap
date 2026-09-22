const key = process.env.GEMINI_FALLBACK_API_KEY;
console.log("Using fallback key:", key?.slice(0, 10));

async function run() {
  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": key,
    },
    body: JSON.stringify({
      contents: [{
        role: "user",
        parts: [{ text: "ping" }]
      }]
    })
  });
  console.log("Status:", res.status);
  const text = await res.text();
  console.log("Body:", text.slice(0, 300));
}

run();
