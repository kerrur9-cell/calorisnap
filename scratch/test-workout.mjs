const key = process.env.GEMINI_API_KEY;
console.log("Using key prefix:", key?.slice(0, 10));

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
          { text: "Пользователь сделал ягодичный мостик 4 подхода по 15 раз. Рассчитай калории для девушки весом 55 кг. Ответь строго валидным JSON: {\"exerciseName\": \"Ягодичный мостик\", \"caloriesBurned\": 35, \"targetMuscles\": [\"Ягодицы\"], \"advice\": \"Отлично!\"}" }
        ]
      }],
      generationConfig: {
        responseMimeType: "application/json"
      }
    })
  });

  console.log("Status:", res.status);
  const json = await res.json();
  console.log("Response:", JSON.stringify(json, null, 2));
}

run();
