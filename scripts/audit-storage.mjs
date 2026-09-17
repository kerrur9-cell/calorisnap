// Read-only: supply SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.
import { createClient } from "@supabase/supabase-js";
const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Never expose this key in a public variable.");
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const referenced = new Set();
for (let offset = 0; ; offset += 1000) {
  const { data, error } = await db.from("meal_entries").select("photo_storage_path").order("id").range(offset, offset + 999);
  if (error) throw error;
  data.forEach((meal) => { if (meal.photo_storage_path) referenced.add(meal.photo_storage_path); });
  if (data.length < 1000) break;
}
const cutoff = Date.now() - 24 * 60 * 60 * 1000;
async function inspect(prefix) {
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.storage.from("food-photos").list(prefix, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw error;
    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (!item.id) await inspect(path);
      else if (!referenced.has(path) && new Date(item.created_at).getTime() < cutoff) console.log(JSON.stringify({ candidate: path, createdAt: item.created_at }));
    }
    if (data.length < 1000) break;
  }
}
await inspect("");
console.log("Read-only audit complete. No files deleted.");
