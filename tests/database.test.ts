import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { uuid_ossp } from "@electric-sql/pglite/contrib/uuid_ossp";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";

const alice = "00000000-0000-4000-8000-000000000001";
const bob = "00000000-0000-4000-8000-000000000002";
const row = { custom_food_name: "Рис", weight_grams: 100, calories: 130, protein_g: 2.7, fat_g: 0.3, carbs_g: 28.2, weight_source: "manual" };
let db: PGlite;
async function asUser(id: string) {
  await db.exec("RESET ROLE");
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec("SET ROLE authenticated");
}
async function save(id: string, items = [row]) {
  return db.query("SELECT public.save_meal($1,'2026-09-17','lunch',$2::jsonb)", [id, JSON.stringify(items)]);
}
beforeAll(async () => {
  db = new PGlite({ extensions: { pg_trgm, uuid_ossp } });
  await db.exec(`CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE SCHEMA storage;
    CREATE TABLE auth.users(id uuid PRIMARY KEY,raw_user_meta_data jsonb DEFAULT '{}');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(),bucket_id text,name text);
    CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT string_to_array($1,'/') $$;
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;`);
  for (const file of readdirSync("supabase/migrations").filter((name) => name.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
  }
  await db.exec(`GRANT USAGE ON SCHEMA public,auth,storage TO authenticated;
    GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public,storage TO authenticated;`);
});
beforeEach(async () => {
  await db.exec(`RESET ROLE; TRUNCATE auth.users CASCADE;
    INSERT INTO auth.users(id) VALUES('${alice}'),('${bob}');`);
  await asUser(alice);
});
afterAll(async () => { await db?.close(); });
describe("migrations and RLS on PostgreSQL", () => {
  it("imports thousands of public products and finds a typo", async () => {
    await db.exec("RESET ROLE");
    await db.exec(readFileSync("supabase/migrations/0004_open_food_facts.sql", "utf8"));
    await asUser(alice);
    const count = await db.query<{ count: string }>("SELECT count(*)::text AS count FROM public.food_items WHERE source = 'open_food_facts'");
    expect(Number(count.rows[0].count)).toBeGreaterThanOrEqual(4700);
    const found = await db.query<{ name: string }>("SELECT name FROM public.search_foods('драникк', 20)");
    expect(found.rows.some((food) => food.name.toLowerCase().includes("драник"))).toBe(true);
  });
  it("seeds repeatedly without duplicate catalog entries", async () => {
    await db.exec("RESET ROLE");
    const sql = readFileSync("supabase/seed/0001_foods.sql", "utf8");
    await db.exec(sql);
    const first = (await db.query("SELECT * FROM food_items WHERE created_by IS NULL")).rows.length;
    await db.exec(sql);
    expect((await db.query("SELECT * FROM food_items WHERE created_by IS NULL")).rows).toHaveLength(first);
  });
  it("rolls weight history back when profile target validation fails", async () => {
    await expect(db.query("SELECT save_weight(75,'2026-09-17',$1)", [JSON.stringify({ daily_calorie_target: -1 })])).rejects.toThrow();
    expect((await db.query("SELECT * FROM weight_entries")).rows).toHaveLength(0);
  });
  it("saves one meal and its items atomically and retries without duplicates", async () => {
    const id = randomUUID(); await save(id); await save(id);
    expect((await db.query("SELECT * FROM meal_entries")).rows).toHaveLength(1);
    expect((await db.query("SELECT * FROM meal_items")).rows).toHaveLength(1);
    expect((await db.query<{ total_calories: string }>("SELECT total_calories FROM daily_stats")).rows[0].total_calories).toBe("130.0");
  });
  it("rolls the entire meal back if one item is invalid", async () => {
    await expect(save(randomUUID(), [row, { ...row, calories: -10 }])).rejects.toThrow();
    expect((await db.query("SELECT * FROM meal_entries")).rows).toHaveLength(0);
  });
  it("blocks cross-account children and hides another user's meals and stats", async () => {
    const id = randomUUID(); await save(id); await asUser(bob);
    expect((await db.query("SELECT * FROM meal_entries")).rows).toHaveLength(0);
    expect((await db.query("SELECT * FROM daily_stats")).rows).toHaveLength(0);
    await expect(db.query(`INSERT INTO meal_items(meal_entry_id,user_id,weight_grams,calories,protein_g,fat_g,carbs_g)
      VALUES($1,$2,100,1,1,1,1)`, [id,bob])).rejects.toThrow(/row-level security/);
    await expect(save(id)).rejects.toThrow();
  });
  it("prevents self-verification of custom foods", async () => {
    await expect(db.query(`INSERT INTO food_items(name,created_by,source,is_verified,calories_per_100g,protein_per_100g,fat_per_100g,carbs_per_100g)
      VALUES('Fake',$1,'user_custom',true,100,1,1,1)`,[alice])).rejects.toThrow(/row-level security/);
  });
  it("enforces a quota across repeated function calls", async () => {
    expect((await db.query<{ allowed: boolean }>("SELECT consume_ai_quota() AS allowed")).rows[0].allowed).toBe(true);
    expect((await db.query<{ allowed: boolean }>("SELECT consume_ai_quota() AS allowed")).rows[0].allowed).toBe(false);
    await expect(db.query("UPDATE ai_usage SET count=0")).resolves.toMatchObject({ affectedRows: 0 });
  });
  it("upserts today's weight using its actual unique key", async () => {
    const sql = "INSERT INTO weight_entries(user_id,weight_kg,recorded_at) VALUES($1,$2,'2026-09-17') ON CONFLICT(user_id,recorded_at) DO UPDATE SET weight_kg=excluded.weight_kg";
    await db.query(sql,[alice,75]); await db.query(sql,[alice,76]);
    expect((await db.query("SELECT * FROM weight_entries")).rows).toHaveLength(1);
  });
  it("generates, connects, shares diary with friend, and enforces read-only RLS", async () => {
    // 1. Alice generates her friend code
    await asUser(alice);
    const aliceRes1 = await db.query<{ code: string }>("SELECT public.generate_or_get_friend_code() AS code");
    const aliceCode = aliceRes1.rows[0].code;
    expect(aliceCode).toMatch(/^CAL-[0-9A-HJ-NP-Z]{4}-[0-9A-HJ-NP-Z]{4}$/);

    // Calling it again returns the same code
    const aliceRes2 = await db.query<{ code: string }>("SELECT public.generate_or_get_friend_code() AS code");
    expect(aliceRes2.rows[0].code).toBe(aliceCode);

    // 2. Alice saves a meal
    const mealId = randomUUID();
    await save(mealId);

    // 3. Bob cannot yet see Alice's meal
    await asUser(bob);
    expect((await db.query("SELECT * FROM meal_entries WHERE user_id = $1", [alice])).rows).toHaveLength(0);

    // Bob cannot connect with his own code
    const bobCodeRes = await db.query<{ code: string }>("SELECT public.generate_or_get_friend_code() AS code");
    await expect(db.query("SELECT public.connect_friend_by_code($1)", [bobCodeRes.rows[0].code])).rejects.toThrow(/Нельзя добавить свой собственный код/);

    // Bob connects to Alice
    const connectRes = await db.query<{ connect_friend_by_code: { owner_id: string } }>("SELECT public.connect_friend_by_code($1)", [aliceCode]);
    expect(connectRes.rows[0].connect_friend_by_code.owner_id).toBe(alice);

    // 4. Bob can now SELECT Alice's meal and daily stats
    const bobSeesAliceMeals = await db.query("SELECT * FROM meal_entries WHERE user_id = $1", [alice]);
    expect(bobSeesAliceMeals.rows).toHaveLength(1);
    const bobSeesAliceItems = await db.query("SELECT * FROM meal_items WHERE user_id = $1", [alice]);
    expect(bobSeesAliceItems.rows).toHaveLength(1);
    const bobSeesAliceStats = await db.query("SELECT * FROM daily_stats WHERE user_id = $1", [alice]);
    expect(bobSeesAliceStats.rows).toHaveLength(1);

    // 5. Bob CANNOT insert, update, or delete Alice's data (strictly read-only)
    await expect(db.query("DELETE FROM meal_entries WHERE id = $1", [mealId])).resolves.toMatchObject({ affectedRows: 0 });
    await expect(db.query("UPDATE meal_entries SET meal_type = 'dinner' WHERE id = $1", [mealId])).resolves.toMatchObject({ affectedRows: 0 });
    await expect(db.query(`INSERT INTO meal_items(meal_entry_id,user_id,weight_grams,calories,protein_g,fat_g,carbs_g)
      VALUES($1,$2,100,1,1,1,1)`, [mealId, bob])).rejects.toThrow(/row-level security/);

    // 6. Friends lists
    const bobFriends = await db.query<{ owner_id: string }>("SELECT * FROM public.get_my_friends()");
    expect(bobFriends.rows).toHaveLength(1);
    expect(bobFriends.rows[0].owner_id).toBe(alice);

    await asUser(alice);
    const aliceViewers = await db.query<{ viewer_id: string }>("SELECT * FROM public.get_my_viewers()");
    expect(aliceViewers.rows).toHaveLength(1);
    expect(aliceViewers.rows[0].viewer_id).toBe(bob);

    // 7. Alice revokes Bob's access
    await db.query("SELECT public.revoke_viewer_access($1)", [bob]);

    await asUser(bob);
    expect((await db.query("SELECT * FROM meal_entries WHERE user_id = $1", [alice])).rows).toHaveLength(0);
    expect((await db.query("SELECT * FROM public.get_my_friends()")).rows).toHaveLength(0);
  });
});
