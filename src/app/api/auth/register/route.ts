import { NextRequest, NextResponse } from "next/server";
import { registerUser } from "@/lib/auth";
import { RegisterSchema } from "@/lib/validation/schemas";
import { checkRateLimit } from "@/lib/utils/progression";

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 5 registrations per IP per 15 min
    const ip = req.headers.get("x-forwarded-for") ?? "anonymous";
    const { allowed } = checkRateLimit(`register:${ip}`, 5, 15 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: { code: "RATE_LIMIT", message: "Too many registration attempts. Try again later." } },
        { status: 429 }
      );
    }

    const body = await req.json();
    const parsed = RegisterSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.issues[0]?.message ?? "Invalid input",
          },
        },
        { status: 400 }
      );
    }

    const user = await registerUser(parsed.data);

    return NextResponse.json({ success: true, data: { id: user.id, username: user.username } }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Registration failed";
    if (message === "EMAIL_TAKEN") {
      return NextResponse.json(
        { success: false, error: { code: "EMAIL_TAKEN", message: "This email is already registered." } },
        { status: 409 }
      );
    }
    if (message === "USERNAME_TAKEN") {
      return NextResponse.json(
        { success: false, error: { code: "USERNAME_TAKEN", message: "This username is already taken." } },
        { status: 409 }
      );
    }
    console.error("Register error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } },
      { status: 500 }
    );
  }
}
