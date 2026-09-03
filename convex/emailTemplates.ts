/**
 * Email templates for Shelton Springs HOA.
 * Styling matches sheltonsprings.homes (contact.html, app theme).
 */

import {
  formatNoticeNumber,
  sortViolationsForDisplay,
} from "./adminNoticeTemplates";

export type ResidentNoticeTemplateType = "notice" | "action_request" | "reminder";

export type ResidentNoticeEmailParams = {
  templateType: ResidentNoticeTemplateType;
  recipientName: string;
  address: string;
  body: string;
  badgeLabel: string;
  ctaLabel?: string;
  ctaUrl?: string;
  noticeDateMs?: number;
  noticeNumber?: number;
  selectedViolations?: string[];
};

export function getPasswordResetHtml(resetUrl: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Password reset for Shelton Springs HOA Community">
  <title>Reset Your Password - Shelton Springs</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px 40px 24px 40px; border-bottom: 3px solid #3b82f6;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #1f2937;">Shelton Springs</h1>
              <p style="margin: 8px 0 0 0; font-size: 14px; color: #6b7280;">HOA Community</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #1f2937;">Reset Your Password</h2>
              <p style="margin: 0 0 16px 0; font-size: 16px; color: #4b5563;">You requested a password reset for your Shelton Springs HOA account.</p>
              <p style="margin: 0 0 24px 0; font-size: 16px; color: #4b5563;">Click the button below to set a new password. This link will expire in 1 hour.</p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 0 24px 0;">
                <tr>
                  <td style="border-radius: 8px; background-color: #2563eb;">
                    <a href="${resetUrl}" style="display: inline-block; padding: 14px 28px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none;">Reset Password</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 16px 0; font-size: 14px; color: #6b7280;">If you didn't request this, you can safely ignore this email.</p>
              <div style="margin-top: 24px; padding: 16px; background-color: #f3f4f6; border-radius: 6px; border-left: 4px solid #3b82f6;">
                <p style="margin: 0; font-size: 13px; color: #6b7280;">Or copy this link:</p>
                <p style="margin: 8px 0 0 0; font-size: 13px; color: #3b82f6; word-break: break-all;">${resetUrl}</p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 40px 40px 40px; border-top: 1px solid #e5e7eb; background-color: #f9fafb; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center;">Shelton Springs HOA Community · sheltonsprings.homes</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatNoticeDate(noticeDateMs?: number): string {
  const date = noticeDateMs ? new Date(noticeDateMs) : new Date();
  return date.toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "2-digit",
  });
}

function renderChecklistItem(label: string, checked = true): string {
  const safe = escapeHtml(label);
  const box = checked ? "&#9745;" : "&#9744;";
  return `<tr>
    <td style="padding: 4px 0; font-size: 15px; color: #111827; vertical-align: top; width: 28px;">${box}</td>
    <td style="padding: 4px 0; font-size: 15px; color: #111827;">${safe}</td>
  </tr>`;
}

/** Formal HOA letter matching the Shelton Springs yard maintenance compliance notice. */
export function getYardMaintenanceComplianceHtml(params: {
  address: string;
  noticeDateMs?: number;
  noticeNumber?: number;
  isReminder?: boolean;
  selectedViolations?: string[];
}): string {
  const address = escapeHtml(params.address);
  const noticeDate = escapeHtml(formatNoticeDate(params.noticeDateMs));
  const noticeNoLine =
    params.noticeNumber != null && params.noticeNumber > 0
      ? `<p style="margin: 0 0 10px 0; font-size: 15px;"><strong>Notice No.:</strong> ${escapeHtml(formatNoticeNumber(params.noticeNumber))}</p>`
      : "";
  const reminderBanner = params.isReminder
    ? `<p style="margin: 0 0 16px 0; padding: 10px 12px; background-color: #fef3c7; font-size: 15px; font-weight: 700; color: #92400e;">REMINDER — PRIOR COMPLIANCE NOTICE STILL OPEN</p>`
    : "";
  const rawChecklistItems =
    params.selectedViolations && params.selectedViolations.length > 0
      ? params.selectedViolations
      : [
          "Lawn needs mowing",
          "Weeds need to be removed",
          "Flower beds need maintenance/manicuring",
          "Trees or shrubs need trimming",
          "Yard or driveway contains debris, trash, or other accumulated materials",
          "Other: __________",
        ];
  const checklistItems = sortViolationsForDisplay(rawChecklistItems);
  const showAsChecked = Boolean(
    params.selectedViolations && params.selectedViolations.length > 0
  );
  const checklist = checklistItems
    .map((item) => renderChecklistItem(item, showAsChecked))
    .join("");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Yard Maintenance Compliance Notice</title>
</head>
<body style="margin: 0; padding: 0; font-family: Georgia, 'Times New Roman', Times, serif; line-height: 1.55; color: #111827; background-color: #f3f4f6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f3f4f6; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="640" cellspacing="0" cellpadding="0" border="0" style="max-width: 640px; width: 100%; background-color: #ffffff; border: 1px solid #d1d5db;">
          <tr>
            <td style="padding: 40px 44px 32px 44px;">
              <p style="margin: 0 0 6px 0; font-size: 22px; font-weight: 700;">Shelton Springs Homeowners Association</p>
              <p style="margin: 0 0 28px 0; font-size: 22px; font-weight: 700;">Yard Maintenance Compliance Notice</p>

              <p style="margin: 0 0 10px 0; font-size: 15px;"><strong>Date:</strong> ${noticeDate}</p>
              ${noticeNoLine}
              <p style="margin: 0 0 24px 0; font-size: 15px;"><strong>Property Address:</strong> ${address}</p>

              <p style="margin: 0 0 16px 0; font-size: 15px;">Dear Homeowner,</p>

              ${reminderBanner}

              <p style="margin: 0 0 16px 0; font-size: 15px;">
                The purpose of routine maintenance is to ensure all properties continue to meet community standards for appearance, safety, and upkeep, which benefits all homeowners by preserving property values and the overall quality of our neighborhood.
              </p>

              <p style="margin: 0 0 16px 0; font-size: 15px;">
                It is important to note that the homeowner is responsible for all yard maintenance including, but not limited to, mowing, weed removal, manicuring and edging flower beds, and trimming bushes, shrubs and trees.
              </p>

              <p style="margin: 0 0 16px 0; font-size: 15px;">
                During our monthly community inspection, your property was found <strong>not in compliance</strong> with the Association's yard maintenance standards.
              </p>

              <p style="margin: 0 0 20px 0; padding: 10px 12px; background-color: #dcfce7; font-size: 15px; font-weight: 700; color: #166534;">
                THE HOA WALK THROUGH IS LAST WEEK OF EVERY MONTH
              </p>

              <p style="margin: 0 0 10px 0; font-size: 15px; font-weight: 700;">The following items require attention:</p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 0 20px 0; width: 100%;">
                ${checklist}
              </table>

              <p style="margin: 0 0 16px 0; font-size: 15px;">
                Please ensure the noted maintenance is completed <span style="color: #dc2626; font-weight: 700;">within 30 days</span> from the date of this notice.
              </p>

              <p style="margin: 0 0 16px 0; font-size: 15px;">
                Failure to comply within this timeframe may result in the Association contracting the required work to remedy the violation, and the <span style="color: #dc2626; font-weight: 700;">full cost of such work will be billed directly to the homeowner</span>. Additionally, a <span style="color: #dc2626; font-weight: 700;">fine of $50.00 will be assessed for each month the violation remains unresolved</span>.
              </p>

              <p style="margin: 0 0 16px 0; font-size: 15px;">
                As outlined in the community guidelines, maintaining your yard helps keep Shelton Springs a clean and welcoming community for everyone.
              </p>

              <p style="margin: 0 0 16px 0; font-size: 15px;">
                Thank you for your attention to this matter and for helping keep Shelton Springs a clean and welcoming community.
              </p>

              <p style="margin: 0 0 28px 0; font-size: 15px;">
                If you believe this notice was sent in error, please contact the HOA Board so we can review the matter with you.
              </p>

              <p style="margin: 0; font-size: 15px;">Sincerely,</p>
              <p style="margin: 8px 0 0 0; font-size: 15px; font-weight: 700;">Shelton Springs Homeowners Association</p>
              <p style="margin: 4px 0 0 0; font-size: 15px; font-weight: 700;">Board of Directors</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 16px 44px 24px 44px; border-top: 1px solid #e5e7eb; background-color: #f9fafb;">
              <p style="margin: 0; font-size: 12px; color: #6b7280; text-align: center;">Shelton Springs HOA Community · sheltonsprings.homes</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

export function getNoticeEmailHtml(params: ResidentNoticeEmailParams): string {
  if (params.templateType === "action_request" || params.templateType === "reminder") {
    return getYardMaintenanceComplianceHtml({
      address: params.address,
      noticeDateMs: params.noticeDateMs,
      noticeNumber: params.noticeNumber,
      isReminder: params.templateType === "reminder",
      selectedViolations: params.selectedViolations,
    });
  }

  return getResidentNoticeHtml(params);
}

export function getResidentNoticeHtml(params: ResidentNoticeEmailParams): string {
  const firstName = escapeHtml(params.recipientName.split(" ")[0] || "Resident");
  const address = escapeHtml(params.address);
  const body = escapeHtml(params.body);
  const badgeLabel = escapeHtml(params.badgeLabel);
  const ctaLabel = params.ctaLabel ? escapeHtml(params.ctaLabel) : "";
  const ctaUrl = params.ctaUrl ? escapeHtml(params.ctaUrl) : "";

  const ctaBlock =
    ctaLabel && ctaUrl
      ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 0 24px 0;">
                <tr>
                  <td style="border-radius: 8px; background-color: #2563eb;">
                    <a href="${ctaUrl}" style="display: inline-block; padding: 14px 28px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none;">${ctaLabel}</a>
                  </td>
                </tr>
              </table>`
      : "";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Shelton Springs HOA</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px 40px 24px 40px; border-bottom: 3px solid #0B1A12;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #1f2937;">Shelton Springs</h1>
              <p style="margin: 8px 0 0 0; font-size: 14px; color: #6b7280;">HOA Community</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 16px 0; font-size: 13px; font-weight: 600; color: #2563eb; text-transform: uppercase; letter-spacing: 0.04em;">${badgeLabel}</p>
              <p style="margin: 0 0 16px 0; font-size: 16px; color: #4b5563;">Hello ${firstName},</p>
              <p style="margin: 0 0 24px 0; font-size: 16px; color: #4b5563;">${body}</p>
              <div style="margin: 0 0 24px 0; padding: 16px; background-color: #f3f4f6; border-radius: 6px; border-left: 4px solid #2563eb;">
                <p style="margin: 0; font-size: 13px; color: #6b7280;">Property on file</p>
                <p style="margin: 8px 0 0 0; font-size: 14px; color: #1f2937; font-weight: 500;">${address}</p>
              </div>
              ${ctaBlock}
              <p style="margin: 0; font-size: 14px; color: #6b7280;">Questions? Reply to this email or contact the board through the Shelton Springs app.</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 40px 40px 40px; border-top: 1px solid #e5e7eb; background-color: #f9fafb; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center;">Shelton Springs HOA Community · sheltonsprings.homes</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}
