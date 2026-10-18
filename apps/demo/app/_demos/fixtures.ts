import type {
  ActionItem,
  PaymentItem,
  PublishItem,
  ScheduleItem,
  SendItem,
} from "agent-approval-machine/machines";

export const SDR_LEADS: SendItem[] = [
  {
    id: "lead-1",
    to: "ali@acme.com",
    subject: "Your team is hiring 3 SDRs",
    body: "Hi Ali,\n\nNoticed Acme is hiring three SDRs this quarter. Most teams that scale like that lose the first 90 days to list building.\n\nWe do that part. Worth 15 minutes?\n\n— Sam",
  },
  {
    id: "lead-2",
    to: "dana@northwind.io",
    subject: "Northwind + outbound",
    body: "Hi Dana,\n\nSaw the Series A. Congrats.\n\nIf you are standing up outbound this quarter, I can share the exact sequence we used to book 40 meetings in a month.\n\n— Sam",
  },
  {
    id: "lead-3",
    to: "ravi@globex.com",
    subject: "quick question about your stack",
    body: "Hi Ravi,\n\nDo you run enrichment in-house or with a vendor?\n\n— Sam",
  },
  {
    id: "lead-4",
    to: "mei@initech.com",
    subject: "Initech's hiring post",
    body: "Hi Mei,\n\nYour hiring post mentioned pipeline problems. That is usually a data problem, not a rep problem.\n\n— Sam",
  },
  {
    id: "lead-5",
    to: "tom@umbrella.dev",
    subject: "last one, promise",
    body: "Hi Tom,\n\nShort version: 3 meetings a week, no new headcount.\n\n— Sam",
  },
];

export const SUPPORT_REQUESTS: ActionItem[] = [
  {
    id: "refund-1042",
    title: "Refund order #1042 — $49.00",
    description:
      'Customer: "The shirt shrank after the first wash. I do not want a replacement, just the refund." Order is 12 days old, within policy.',
    risk: "high",
  },
];

export const MEETINGS: ScheduleItem[] = [
  {
    id: "meet-ali",
    title: "Book with Ali",
    proposedTimes: ["Tue 10:00", "Wed 14:00"],
    attendees: ["ali@acme.com", "sam@you.dev"],
  },
];

export const PAYMENTS: PaymentItem[] = [
  {
    id: "pay-aws",
    amount: 1200,
    vendor: "AWS",
    description: "Overdue invoice #88213 — production account, final reminder.",
  },
];

export const POSTS: PublishItem[] = [
  {
    id: "publish-x",
    platform: "x",
    content:
      "Every AI agent rebuilds approval state: edit before approve, partial failure, undo, queue.\n\nI built 5 headless machines so nobody has to do it again.",
  },
  {
    id: "publish-blog",
    platform: "blog",
    content:
      "Approval is a state machine, not a button.\n\nMost libraries give you Approve/Deny and call it a day. That is the easy 10%.",
    previewUrl: "https://agent-approval-machine.dev/docs",
  },
];
