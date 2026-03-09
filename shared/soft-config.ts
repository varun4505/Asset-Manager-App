import { z } from "zod";

export const fatigueLevelSchema = z.enum(["low", "medium", "high"]);
export type FatigueLevel = z.infer<typeof fatigueLevelSchema>;

export const weatherConditionSchema = z.enum(["clear", "cloudy", "rain", "storm"]);
export type WeatherCondition = z.infer<typeof weatherConditionSchema>;

export const timeOfDaySchema = z.enum(["morning", "afternoon", "evening", "night"]);
export type TimeOfDay = z.infer<typeof timeOfDaySchema>;

const labeledOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
  icon: z.string(),
  color: z.string().optional(),
});

const numericOptionSchema = z.object({
  value: z.number(),
  label: z.string(),
  icon: z.string(),
  color: z.string(),
});

const riskGuideSchema = z.object({
  range: z.string(),
  level: fatigueLevelSchema,
  description: z.string(),
});

const tipCardSchema = z.object({
  title: z.string(),
  body: z.string(),
  icon: z.string(),
  color: z.string(),
});

const breakPolicySchema = z.object({
  low: z.object({
    recommendedDurationMinutes: z.number(),
    nextBreakMinutes: z.number(),
  }),
  medium: z.object({
    recommendedDurationMinutes: z.number(),
    triggerMinutes: z.number(),
    soonWindowMinutes: z.number(),
  }),
  high: z.object({
    recommendedDurationMinutes: z.number(),
  }),
});

const asoConfigSchema = z.object({
  ants: z.number(),
  iterations: z.number(),
  alpha: z.number(),
  beta: z.number(),
  evaporation: z.number(),
  q: z.number(),
  distanceWeight: z.number(),
  riskWeight: z.number(),
  priorityWeight: z.number(),
});

export const appConfigSchema = z.object({
  weatherOptions: z.array(labeledOptionSchema),
  timeOptions: z.array(labeledOptionSchema),
  hungerOptions: z.array(numericOptionSchema),
  vehicleOptions: z.array(labeledOptionSchema),
  riskGuide: z.array(riskGuideSchema),
  safetyTips: z.record(fatigueLevelSchema, z.array(z.string())),
  generalTips: z.array(tipCardSchema),
  fatigueThresholds: z.object({
    lowMax: z.number(),
    mediumMax: z.number(),
  }),
  fatigueFactors: z.object({
    weather: z.object({
      clear: z.number(),
      cloudy: z.number(),
      rain: z.number(),
      storm: z.number(),
    }),
    timeOfDay: z.object({
      morning: z.number(),
      afternoon: z.number(),
      evening: z.number(),
      night: z.number(),
    }),
    hungerStep: z.number(),
  }),
  breakPolicy: breakPolicySchema,
  aso: asoConfigSchema,
});

export type AppConfig = z.infer<typeof appConfigSchema>;

export const defaultAppConfig: AppConfig = {
  weatherOptions: [
    { value: "clear", label: "Clear", icon: "sunny-outline", color: "safe" },
    { value: "cloudy", label: "Cloudy", icon: "cloudy-outline", color: "textSecondary" },
    { value: "rain", label: "Rain", icon: "rainy-outline", color: "caution" },
    { value: "storm", label: "Storm", icon: "thunderstorm-outline", color: "danger" },
  ],
  timeOptions: [
    { value: "morning", label: "Morning", icon: "partly-sunny-outline", color: "safe" },
    { value: "afternoon", label: "Afternoon", icon: "sunny", color: "accent" },
    { value: "evening", label: "Evening", icon: "sunset-outline", color: "caution" },
    { value: "night", label: "Night", icon: "moon-outline", color: "danger" },
  ],
  hungerOptions: [
    { value: 1, label: "Full", icon: "happy-outline", color: "safe" },
    { value: 2, label: "Ok", icon: "smile", color: "safe" },
    { value: 3, label: "Hungry", icon: "sad-outline", color: "caution" },
    { value: 4, label: "Very", icon: "sad", color: "danger" },
    { value: 5, label: "Starving", icon: "alert-circle-outline", color: "danger" },
  ],
  vehicleOptions: [
    { value: "Motorcycle", label: "Motorcycle", icon: "motorbike", color: "accent" },
    { value: "Bicycle", label: "Bicycle", icon: "bicycle", color: "accent" },
    { value: "Car", label: "Car", icon: "car-side", color: "accent" },
    { value: "Van", label: "Van", icon: "van-utility", color: "accent" },
    { value: "Scooter", label: "Scooter", icon: "scooter", color: "accent" },
  ],
  riskGuide: [
    { range: "0-35", level: "low", description: "Performing well. Stay hydrated." },
    { range: "36-65", level: "medium", description: "Take a break soon. Reduce speed." },
    { range: "66-100", level: "high", description: "Stop immediately. High accident risk." },
  ],
  safetyTips: {
    low: [
      "Keep your mirrors checked every 5-8 seconds.",
      "Stay hydrated and drink water every 30 minutes.",
      "Maintain consistent following distance.",
      "Use your turn signals early and predictably.",
      "Keep the cabin well ventilated to stay alert.",
    ],
    medium: [
      "Reduce speed by 10-15% in current conditions.",
      "Avoid phone use because attention is already reduced.",
      "Plan your next break location now.",
      "Keep windows slightly open to increase alertness.",
      "If yawning repeatedly, stop as soon as it is safe.",
    ],
    high: [
      "Pull over immediately when it is safe to do so.",
      "Do not rely on caffeine. Only rest resolves fatigue.",
      "Alert your dispatcher or supervisor.",
      "Turn on hazard lights if stopping roadside.",
      "A short nap can significantly restore alertness.",
    ],
  },
  generalTips: [
    {
      title: "The 2-Second Rule",
      body: "Maintain at least a 2-second gap from the vehicle ahead. In bad weather use 4 seconds.",
      icon: "speedometer-outline",
      color: "accent",
    },
    {
      title: "Hydration Matters",
      body: "Even mild dehydration can reduce cognitive performance. Drink water every 30 minutes.",
      icon: "water-outline",
      color: "accent",
    },
    {
      title: "Microsleep is Silent",
      body: "A 2-3 second microsleep at city speed can be dangerous. Never ignore drowsiness.",
      icon: "moon-outline",
      color: "accent",
    },
    {
      title: "Caffeine is Temporary",
      body: "Coffee delays fatigue but does not remove it. Planned rest is the only reliable fix.",
      icon: "cafe-outline",
      color: "caution",
    },
    {
      title: "Night Driving Risk",
      body: "Fatigue risk peaks late night and post-lunch hours. Be extra careful in these windows.",
      icon: "star-outline",
      color: "danger",
    },
    {
      title: "Physical Warning Signs",
      body: "Repeated yawning, heavy eyelids, lane drift, or missed turns are strong danger signals.",
      icon: "alert-circle-outline",
      color: "danger",
    },
  ],
  fatigueThresholds: {
    lowMax: 35,
    mediumMax: 65,
  },
  fatigueFactors: {
    weather: {
      clear: 0,
      cloudy: 15,
      rain: 30,
      storm: 50,
    },
    timeOfDay: {
      morning: 5,
      afternoon: 10,
      evening: 20,
      night: 35,
    },
    hungerStep: 5,
  },
  breakPolicy: {
    low: {
      recommendedDurationMinutes: 10,
      nextBreakMinutes: 120,
    },
    medium: {
      recommendedDurationMinutes: 15,
      triggerMinutes: 90,
      soonWindowMinutes: 20,
    },
    high: {
      recommendedDurationMinutes: 30,
    },
  },
  aso: {
    ants: 24,
    iterations: 40,
    alpha: 1,
    beta: 3,
    evaporation: 0.35,
    q: 120,
    distanceWeight: 1,
    riskWeight: 0.6,
    priorityWeight: 0.4,
  },
};
