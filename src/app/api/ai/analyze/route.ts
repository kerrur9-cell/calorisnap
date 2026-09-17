import { NextRequest, NextResponse } from "next/server";
import { analyzeFoodPhoto } from "@/lib/ai/gemini";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 30; // Netlify: максимум из доступного для синхронных функций

const MAX_IMAGE_SIZE = 4 * 1024 * 1024; // 4 МБ после сжатия на клиенте

/** Тело запроса: фото (base64) + опциональный общий вес */
interface AnalyzeRequest {
  data: string;
  mime_type?: string;
  total_weight_grams?: number;
}

async function analyzeRequest(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Войдите в аккаунт" }, { status: 401 });
  let body: AnalyzeRequest;
  try {
    const reader = request.body?.getReader();
    if (!reader) throw new Error("No body");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_IMAGE_SIZE * 1.4) {
        await reader.cancel();
        return NextResponse.json({ error: "Фото слишком большое" }, { status: 413 });
      }
      chunks.push(value);
    }
    body = z.object({
      data: z.string().min(4).regex(/^[A-Za-z0-9+/]+={0,2}$/),
      mime_type: z.enum(["image/jpeg", "image/png", "image/webp"]).default("image/jpeg"),
      total_weight_grams: z.number().finite().positive().max(5000).optional(),
    }).parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  } catch {
    return NextResponse.json({ error: "Невалидный JSON" }, { status: 400 });
  }

  const dataBase64 = typeof body?.data === "string" ? body.data : null;
  const mimeType =
    typeof body?.mime_type === "string" ? body.mime_type : "image/jpeg";
  const totalWeightGrams =
    typeof body?.total_weight_grams === "number"
      ? body.total_weight_grams
      : undefined;

  if (!dataBase64) {
    return NextResponse.json({ error: "Нет фото" }, { status: 400 });
  }
  const image = Buffer.from(dataBase64, "base64");
  const isJpeg = image.subarray(0, 3).equals(Buffer.from([255,216,255]));
  const isPng = image.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const isWebp = image.subarray(0, 4).toString() === "RIFF" && image.subarray(8, 12).toString() === "WEBP";
  if (dataBase64.length % 4 !== 0 || image.length > MAX_IMAGE_SIZE ||
    !((mimeType === "image/jpeg" && isJpeg) || (mimeType === "image/png" && isPng) || (mimeType === "image/webp" && isWebp))) {
    return NextResponse.json({ error: "Нужна фотография JPEG, PNG или WebP до 4 МБ" }, { status: 400 });
  }

  if (dataBase64.length > MAX_IMAGE_SIZE * 1.4) {
    return NextResponse.json(
      { error: "Фото слишком большое (более 4 МБ). Попробуйте ещё раз." },
      { status: 413 },
    );
  }

  try {
    const result = await analyzeFoodPhoto({
      dataBase64,
      mimeType,
      totalWeightGrams,
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    // The provider code intentionally exposes only human-safe messages; showing
    // them here lets the user distinguish an overloaded model from a bad photo.
    const message = error instanceof Error && error.message.length <= 180
      ? error.message
      : "Не удалось распознать фото. Попробуйте ещё раз или добавьте еду вручную.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try { return await analyzeRequest(request); }
  catch { return NextResponse.json({ error: "Сервис временно недоступен" }, { status: 503 }); }
}
