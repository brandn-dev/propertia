export type NotificationItem = {
  id: string;
  kind: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  title: string;
  message: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

export type NotificationSummary = {
  unreadCount: number;
  items: NotificationItem[];
};

export type NotificationInbox = NotificationSummary;
