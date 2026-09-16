import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import Character from "@/models/Character";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const characters = await Character.find({ isActive: { $ne: false } }).sort({ name: 1 }).lean();

    return NextResponse.json({ success: true, data: characters });
  } catch (err) {
    console.error("Characters GET error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch characters." } },
      { status: 500 }
    );
  }
}
