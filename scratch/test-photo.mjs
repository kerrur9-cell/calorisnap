const sampleBase64 = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";

// Берем первый непустой ключ
const key = process.env.GEMINI_API_KEY || process.env.GEMINI_FALLBACK_API_KEY;
console.log("Testing with key:", key?.slice(0, 10));

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
        parts: [
          { text: "Определи что на фото и ответь JSON: {\"result\": \"ok\"}" },
          {
            inline_data: {
              mime_type: "image/jpeg",
              data: sampleBase64
            }
          }
        ]
      }],
      generationConfig: {
        responseMimeType: "application/json"
      }
    })
  });
  console.log("Status:", res.status);
  const text = await res.text();
  console.log("Response:", text.slice(0, 300));
}

run();
