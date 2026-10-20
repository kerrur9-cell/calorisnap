import { randomInt } from "node:crypto";

export async function makeLovingMessage(previous: string[] = [], occasion = "напоминание записать еду") {
  const names = ["Даша", "Дашуля", "Дашенька", "Дашунь"];
  const name = names[randomInt(names.length)];
  const nonce = randomInt(1_000_000);
  try {
    if (!process.env.GROQ_API_KEY) throw new Error("AI unavailable");
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.GROQ_CHAT_MODEL || "openai/gpt-oss-20b",
        messages: [{ role: "system", content: "Ты пишешь нежное, живое push-сообщение Даше. Всегда обращайся к Даше ласково. Любовь и дружеская забота, немного юмора; никаких обвинений, давления, диетических или медицинских обещаний. Не требуй есть, если она не голодна. Не упоминай лимиты и похудение. Не повторяй конструкции предыдущих сообщений. Не выдумывай её действия. Максимум 180 символов, 1–2 эмодзи. Только JSON {\"message\":\"...\"}." }, { role: "user", content: JSON.stringify({ preferredName: name, occasion, previous, creativeSeed: nonce }) }],
        response_format: { type: "json_object" }, temperature: 1, max_completion_tokens: 1024,
      }), signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) throw new Error("AI unavailable");
    const data = await response.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");
    const text = typeof parsed.message === "string" ? parsed.message.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 180) : "";
    if (text && /даш/i.test(text) && !previous.includes(text)) return { text, generated: true };
  } catch { /* Push remains useful when the AI provider is unavailable. */ }
  const openings = ["обнимаю тебя через экран", "посылаю маленькую порцию заботы", "пусть сегодня будет чуть уютнее", "ты заслуживаешь доброй паузы", "лови сердечко от своего дневника", "я тут тихонько напоминаю", "маленький привет с большой нежностью", "забота о тебе уже в пути"];
  const endings = ["Если проголодалась — перекуси и запиши еду 💚", "Загляни в дневник, когда будет удобно 🌸", "Уже поела? Сохраним этот момент в дневнике ✨", "Не забудь отметить еду, солнышко 🫶", "Дневник подождёт минутку твоего внимания 🍓", "Поешь, если голодна, а запись оставь нам 🌿"];
  const options = names.flatMap(n => openings.flatMap(o => endings.map(e => `${n}, ${o}. ${e}`)));
  const fresh = options.filter(text => !previous.includes(text));
  return { text: fresh[randomInt(fresh.length)] || options[0], generated: false };
}
