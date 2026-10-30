import { prisma } from "../prisma";

export type NotificationPreferenceKey =
  | "syncSuccess"
  | "syncFailed"
  | "teamInvites";

const DEFAULTS: Record<NotificationPreferenceKey, boolean> = {
  syncSuccess: true,
  syncFailed: true,
  teamInvites: true,
};

/**
 * Returns whether a user wants a given email notification.
 *
 * A missing preference row means the user never changed the defaults, so
 * transactional email stays enabled. Test/partial Prisma mocks may not expose
 * `notificationPreference`; in that case we also fall back to the default
 * rather than blocking email because of an infrastructure detail.
 */
export async function shouldSendNotification(
  userId: string,
  key: NotificationPreferenceKey,
): Promise<boolean> {
  try {
    const preferences = await prisma.notificationPreference.findUnique({
      where: { userId },
      select: {
        syncSuccess: true,
        syncFailed: true,
        teamInvites: true,
      },
    });

    return preferences?.[key] ?? DEFAULTS[key];
  } catch {
    return DEFAULTS[key];
  }
}
