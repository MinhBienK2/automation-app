import { z } from "zod";

export const setGeolocationSchema = z.object({
  type: z.literal("set_geolocation"),
  config: z.object({
    latitude: z.number(),
    longitude: z.number(),
    accuracy: z.number().nullable().optional(),
  }),
});
