import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const registrationSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name").max(80),
  phone: z.string().trim().min(7, "Enter a valid phone number").max(20),
  email: z.string().trim().email("Enter a valid email address").max(254),
  password: z.string().min(6, "Password must be at least 6 characters").max(72),
  referral_code: z.string().trim().max(40).optional(),
});

/**
 * Creates the account with the service role so registration never waits on email
 * confirmation and is not rejected by the project's strong-password policy.
 * The client signs in with the same credentials right after.
 */
export const registerAccount = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => registrationSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.full_name,
        phone: data.phone,
        referral_code: data.referral_code ?? "",
      },
    });

    if (error) {
      const message = error.message || "";
      if (/already|registered|exists/i.test(message)) {
        throw new Error("An account with this email already exists.");
      }
      throw new Error(message || "Could not create your account. Please try again.");
    }

    return { userId: created.user?.id ?? null };
  });
