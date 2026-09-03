export type NoticeTemplateType = "notice" | "action_request" | "reminder";

export type NoticeTemplate = {
  type: NoticeTemplateType;
  label: string;
  emailSubject: string;
  pushTitle: string;
  pushBody: string;
  emailBody: string;
  badgeLabel: string;
  ctaLabel?: string;
  ctaUrl?: string;
};

/** Checklist items shown on the yard maintenance compliance notice. */
export const YARD_MAINTENANCE_CHECKLIST = [
  "Lawn needs mowing",
  "Weeds need to be removed",
  "Flower beds need maintenance/manicuring",
  "Trees or shrubs need trimming",
  "Yard or driveway contains debris, trash, or other accumulated materials",
  "Other: __________",
] as const;

export const NOTICE_TEMPLATES: Record<NoticeTemplateType, NoticeTemplate> = {
  notice: {
    type: "notice",
    label: "Community Notice",
    emailSubject: "Shelton Springs — Community Notice",
    pushTitle: "Community Notice",
    pushBody:
      "The Shelton Springs HOA has posted a new community notice. Open the app for details.",
    emailBody:
      "You have a new notice from the Shelton Springs HOA. Please review the information below and open the Shelton Springs app for full community updates.",
    badgeLabel: "Notice",
    ctaLabel: "Open Shelton Springs",
    ctaUrl: "https://sheltonsprings.homes",
  },
  action_request: {
    type: "action_request",
    label: "Yard Maintenance Compliance",
    emailSubject: "Shelton Springs — Yard Maintenance Compliance Notice",
    pushTitle: "Yard Maintenance Notice",
    pushBody:
      "Your property requires yard maintenance attention per HOA standards. Please check your email for the compliance notice.",
    emailBody:
      "During our monthly community inspection, your property was found not in compliance with the Association's yard maintenance standards. Please review the attached compliance notice for required items and deadlines.",
    badgeLabel: "Compliance Notice",
  },
  reminder: {
    type: "reminder",
    label: "Compliance Reminder",
    emailSubject: "Reminder — Shelton Springs HOA Yard Maintenance",
    pushTitle: "HOA Reminder",
    pushBody:
      "Reminder: yard maintenance compliance is still required for your property. Please check your email for details.",
    emailBody:
      "This is a reminder that yard maintenance noted in your prior compliance notice must still be completed. Please address the items listed to avoid additional fines or contracted work billed to your account.",
    badgeLabel: "Reminder",
  },
};

export function getNoticeTemplate(type: NoticeTemplateType): NoticeTemplate {
  return NOTICE_TEMPLATES[type];
}

export function isValidSelectedViolation(item: string): boolean {
  if ((YARD_MAINTENANCE_CHECKLIST as readonly string[]).includes(item)) {
    return item !== "Other: __________";
  }
  if (item.startsWith("Other: ")) {
    return item.slice("Other: ".length).trim().length > 0;
  }
  return false;
}

export function formatNoticeNumber(noticeNumber: number): string {
  return `#${String(noticeNumber).padStart(4, "0")}`;
}

export function sortViolationsForDisplay(items: string[]): string[] {
  const otherItems = items.filter(
    (item) => item.startsWith("Other: ") && item !== "Other: __________"
  );
  const standardItems = items.filter(
    (item) => !item.startsWith("Other: ") && item !== "Other: __________"
  );
  return [...otherItems, ...standardItems];
}

export async function allocateNextNoticeNumber(ctx: {
  db: { query: (table: "adminNoticeTickets") => any };
}): Promise<number> {
  const tickets = await ctx.db.query("adminNoticeTickets").collect();
  const max = tickets.reduce(
    (highest: number, ticket: { noticeNumber?: number }) =>
      Math.max(highest, ticket.noticeNumber ?? 0),
    0
  );
  return max + 1;
}
