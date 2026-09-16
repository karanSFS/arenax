import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { PlayerSettings } from "@/models/index";
import { UpdateSettingsSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated." } }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    await connectDB();

    let settings = await PlayerSettings.findOne({ userId }).lean();
    if (!settings) {
      settings = await PlayerSettings.create({ userId });
    }

    return NextResponse.json({ success: true, data: settings });
  } catch (err) {
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed." } }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated." } }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const body = await req.json();
    const parsed = UpdateSettingsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message } },
        { status: 400 }
      );
    }

    await connectDB();

    const settings = await PlayerSettings.findOneAndUpdate(
      { userId },
      { $set: parsed.data },
      { new: true, upsert: true }
    ).lean();

    return NextResponse.json({ success: true, data: settings });
  } catch (err) {
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed." } }, { status: 500 });
  }
}
