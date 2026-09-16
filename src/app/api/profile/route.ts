import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import Profile from "@/models/Profile";
import PlayerStats from "@/models/PlayerStats";
import { UpdateProfileSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

// GET /api/profile — current user's profile
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated." } },
        { status: 401 }
      );
    }

    const userId = (session.user as { id: string }).id;
    await connectDB();

    const [profile, stats] = await Promise.all([
      Profile.findOne({ userId }).lean(),
      PlayerStats.findOne({ userId }).lean(),
    ]);

    if (!profile) {
      return NextResponse.json(
        { success: false, error: { code: "PROFILE_NOT_FOUND", message: "Profile not found." } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: { profile, stats } });
  } catch (err) {
    console.error("Profile GET error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch profile." } },
      { status: 500 }
    );
  }
}

// PATCH /api/profile — update current user's profile
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated." } },
        { status: 401 }
      );
    }

    const userId = (session.user as { id: string }).id;
    const body = await req.json();
    const parsed = UpdateProfileSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message } },
        { status: 400 }
      );
    }

    await connectDB();
    const profile = await Profile.findOneAndUpdate(
      { userId },
      { $set: parsed.data },
      { new: true }
    ).lean();

    return NextResponse.json({ success: true, data: profile });
  } catch (err) {
    console.error("Profile PATCH error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to update profile." } },
      { status: 500 }
    );
  }
}
