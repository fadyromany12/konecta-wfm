import { z } from "zod";

export const registerSchema = z
  .object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email().refine((v) => v.toLowerCase().endsWith("@konecta.com"), {
      message: "Email must be a Konecta address (@konecta.com)",
    }),
    password: z
      .string()
      .min(8)
      .regex(/\d/, "Password must contain at least one number"),
    confirmPassword: z.string().min(8),
    managerId: z.string().uuid().nullable().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(8)
    .regex(/\d/, "Password must contain at least one number"),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z
    .string()
    .min(8)
    .regex(/\d/, "Password must contain at least one number"),
});

