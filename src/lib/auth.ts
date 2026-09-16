import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import Profile from "@/models/Profile";
import PlayerStats from "@/models/PlayerStats";
import { Inventory, Leaderboard, PlayerSettings } from "@/models/index";

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        await connectDB();

        const user = await User.findOne({
          email: (credentials.email as string).toLowerCase(),
        });

        if (!user || !user.passwordHash) return null;

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );
        if (!valid) return null;

        // Update last login
        await User.updateOne(
          { _id: user._id },
          { $set: { lastLoginAt: new Date() } }
        );

        return {
          id: user._id.toString(),
          email: user.email,
          name: user.username,
          username: user.username,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = (user as { username?: string }).username ?? user.name;
        token.role = (user as { role?: string }).role ?? "player";
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        (session.user as { username?: string }).username = token.username as string;
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
});

/**
 * Register a new user and initialize all player data.
 */
export async function registerUser(data: {
  email: string;
  username: string;
  password: string;
}) {
  await connectDB();

  const { email, username, password } = data;

  // Check existing
  const existing = await User.findOne({
    $or: [{ email: email.toLowerCase() }, { username }],
  });

  if (existing) {
    if (existing.email === email.toLowerCase()) {
      throw new Error("EMAIL_TAKEN");
    }
    throw new Error("USERNAME_TAKEN");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await User.create({
    email: email.toLowerCase(),
    username,
    passwordHash,
    role: "player",
  });

  const userId = user._id.toString();

  // Initialize all player data in parallel
  await Promise.all([
    Profile.create({
      userId,
      displayName: username,
      avatar: "default",
      bio: "",
      level: 1,
      xp: 0,
      coins: 500, // Starting coins
      rating: 1000,
      rank: "Bronze I",
    }),
    PlayerStats.create({ userId }),
    Inventory.create({ userId, items: [] }),
    Leaderboard.create({ userId, rating: 1000, wins: 0, kills: 0, level: 1 }),
    PlayerSettings.create({ userId }),
  ]);

  return { id: userId, email: user.email, username: user.username };
}
