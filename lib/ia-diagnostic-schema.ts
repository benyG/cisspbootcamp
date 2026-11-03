import { z } from "zod";

import { ACTIVITIES, EASE, HOURS, type IaAnswers, TASKS, TOOLS } from "@/lib/ia-diagnostic";

type Keys<T> = [keyof T & string, ...Array<keyof T & string>];
const keys = <T extends object>(o: T) => Object.keys(o) as Keys<T>;

export const iaAnswersSchema = z.object({
  activity: z.enum(keys(ACTIVITIES), { errorMap: () => ({ message: "Choisissez votre activité." }) }),
  tasks: z.array(z.enum(keys(TASKS))).min(1, "Cochez au moins une tâche.").max(Object.keys(TASKS).length).refine((t) => new Set(t).size === t.length, "Tâche en double."),
  hours: z.enum(keys(HOURS), { errorMap: () => ({ message: "Choisissez un nombre d’heures." }) }),
  tools: z.enum(keys(TOOLS), { errorMap: () => ({ message: "Choisissez vos outils actuels." }) }),
  ease: z.enum(keys(EASE), { errorMap: () => ({ message: "Choisissez votre aisance." }) }),
});

// The schema and the hand-written type must stay the same shape.
export const _sameShape: z.ZodType<IaAnswers> = iaAnswersSchema;
