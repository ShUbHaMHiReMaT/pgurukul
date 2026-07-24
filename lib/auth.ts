import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import * as schema from "./schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: schema,
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
    autoSignUpCallback: async (user: any, data: any) => {
      // Additional user setup on signup
      return user;
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Update age after 1 day
    absoluteLifetimeInSeconds: 60 * 60 * 24 * 30, // 30 days absolute max
  },
  appName: "PGURUKUL",
});

export type Session = typeof auth.$Inferred.Session;
