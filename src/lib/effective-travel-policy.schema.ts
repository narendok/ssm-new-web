import { z } from "zod";

export const travelBandSchema = z.object({
  id: z.enum(["staff", "manager", "senior"]),
  label: z.string().min(1).max(120),
  hotelMetro: z.number().min(0).max(1_000_000),
  hotelOther: z.number().min(0).max(1_000_000),
  mealsPerDay: z.number().min(0).max(1_000_000),
  localPerDay: z.number().min(0).max(1_000_000),
});

export const travelPolicySchema = z.object({
  currency: z.literal("INR"),
  status: z.enum(["Draft", "Active", "Pending_Admin_Review"]),
  effectiveFrom: z.string().nullable().optional(),
  advancePercent: z.number().min(0).max(100),
  oneOpenAdvance: z.boolean(),
  cityTiers: z.array(z.string()),
  bands: z.array(travelBandSchema).length(3),
});

/**
 * PostgreSQL's `active AND effective_from <= date` expression is NULL when an
 * unpublished draft has no effective date. Treat that SQL NULL as inactive;
 * never let it activate policy enforcement or make an otherwise valid draft
 * response fail client parsing.
 */
export const effectiveTravelPolicyResult = z.object({
  policy: travelPolicySchema,
  isEffective: z.boolean().nullable().transform((value) => value === true),
  // SELECT INTO assigns NULL when no published company/department row exists;
  // that is the initial policy version, not a malformed response.
  policyVersion: z.number().int().nonnegative().nullable().transform((value) => value ?? 0),
  // Profiles may contain historic/custom titles. Only the three configured
  // bands are eligible for active caps; unknown values remain unassigned.
  employeeBand: z.string().nullable().transform((value) =>
    value === "staff" || value === "manager" || value === "senior" ? value : null,
  ),
  band: travelBandSchema.nullable(),
}).transform((result) => ({
  ...result,
  // A stale/mis-mapped profile band must never inherit another role's cap.
  // Returning no band makes the request form block capped travel until HR/Admin
  // fixes the profile-to-policy assignment.
  band: result.employeeBand !== null && result.band?.id === result.employeeBand ? result.band : null,
}));

export type EffectiveTravelPolicy = z.infer<typeof effectiveTravelPolicyResult>;
