// Seed conversations for the SOS chat. Each session lists messages oldest -> newest and `end` is how many
// minutes ago the session's last message was sent (earlier messages are spaced 2-6 minutes apart).
// Message: [senderKey, text, { files: [assetKey], voice: assetKey, deleted: true }]
// `unread: { userKey: n }` = the last n messages the *other* person sent are still unread by userKey.
const M = (days, hours = 0, minutes = 0) => days * 1440 + hours * 60 + minutes;

module.exports = ({ web, api }) => [
  {
    between: ["admin", "manager"],
    sessions: [
      {
        end: M(9, 3),
        msgs: [
          ["manager", "Good morning Mona, the Q3 operations numbers are almost final."],
          ["admin", "Morning Karim! Great, what does fulfilment look like?"],
          ["manager", "On-time delivery is at 94%, up from 89% last quarter. Warehouse costs are down 6%."],
          ["admin", "That's a solid improvement. Any risks I should know about before the board meeting?"],
          ["manager", "The courier contract in Alexandria expires on October 15th. We need to decide whether to renew or switch."],
          ["admin", "Let's compare two offers. Can you prepare a short summary?"],
          ["manager", "Sure, I'll have it ready by Thursday."],
        ],
      },
      {
        end: M(6, 5),
        msgs: [
          ["manager", "Here's the full Q3 operations report 📊", { files: ["doc-q3-report"] }],
          ["admin", "Thanks! Reading it now."],
          ["admin", "Page 3 — the returns rate jumped in August. Do we know why?"],
          ["manager", "Mostly the Nile Foods seasonal campaign. 70% of returns were damaged packaging, we've switched suppliers since."],
          ["admin", "Good call. Please add that note to the appendix."],
          ["manager", "تمام، هضيفها النهارده"],
        ],
      },
      {
        end: M(3, 6),
        msgs: [
          ["manager", "", { voice: "voice-karim" }],
          ["manager", "Sorry, quick voice note from the warehouse — the new scanners arrived 🎉"],
          ["admin", "Amazing! Are they already set up in the task manager?"],
          ["manager", `Yes, the rollout board is here: ${web("tasks")}/en`],
          ["admin", "Perfect. Let's make sure the team gets a 30-minute training."],
        ],
      },
      {
        end: M(1, 7),
        msgs: [
          ["admin", "Karim, can you join the weekly sync tomorrow at 10?"],
          ["manager", "Yes, I'll be there. Should I invite Sherif for the delivery timeline?"],
          ["admin", "Yes please, and bring the courier comparison."],
          ["manager", "Will do 👍"],
        ],
      },
      {
        end: M(0, 1, 35),
        msgs: [
          ["manager", `Uploaded the courier comparison to the shared folder: ${web("files")}/en`],
          ["admin", "Great, let's review it in the sync. شكراً يا كريم 🙏"],
        ],
      },
    ],
  },
  {
    between: ["admin", "employee"],
    sessions: [
      {
        end: M(12, 2),
        msgs: [
          ["employee", "Hi Mona, I started working on the new SOS home dashboard."],
          ["admin", "Hi Salma! Which KPIs are you showing?"],
          ["employee", "Active systems, total members, CMS platforms and system health."],
          ["admin", "Love it. Keep it simple and readable on mobile too."],
        ],
      },
      {
        end: M(8, 4),
        msgs: [
          ["employee", "Here are the first screens for the dashboard and the People page 👇", { files: ["img-sos-dashboard", "img-people-page"] }],
          ["admin", "These look great! Can the KPI cards link to the related pages?"],
          ["employee", "Good idea, I'll add that."],
          ["admin", "Also on the People page, can we filter by scope and user type?"],
          ["employee", "Already there ✅ plus active/inactive status."],
        ],
      },
      {
        end: M(4, 5),
        msgs: [
          ["employee", "The impersonation banner is done — admins can now 'Login as' any user and exit safely."],
          ["admin", "That will save support a lot of time. Any security concerns?"],
          ["employee", "Only super admins can use it, and the token carries who is impersonating."],
          ["admin", "Perfect."],
        ],
      },
      {
        end: M(1, 3),
        msgs: [
          ["employee", `Deployed everything to staging: ${web("sos")}/people`],
          ["admin", "Checking it now."],
          ["admin", "Works nicely. Let's ship it on Sunday 🚀"],
          ["employee", "Great! I'll prepare the release notes tonight."],
        ],
      },
    ],
  },
  {
    between: ["admin", "finance"],
    unread: { admin: 2 },
    sessions: [
      {
        end: M(10, 6),
        msgs: [
          ["finance", "Hi Mona, the vendor invoices for September are ready for review."],
          ["admin", "Thanks Hany. Anything unusual?"],
          ["finance", "One invoice from the cloud provider is 18% higher because of the new backup storage."],
          ["admin", "That's expected, we approved the extra storage in August."],
        ],
      },
      {
        end: M(5, 2),
        msgs: [
          ["finance", "Here's invoice INV-2026-1042 from Delta Print for the Nile Foods brochures.", { files: ["doc-invoice"] }],
          ["admin", "Approved ✅"],
          ["finance", "Great, I'll schedule the payment for Thursday."],
          ["admin", "Please also share the Q3 budget variance when you can."],
        ],
      },
      {
        end: M(2, 4),
        msgs: [
          ["finance", "Budget variance: we're 4% under budget overall, marketing is 7% over."],
          ["admin", "OK, let's discuss marketing spend with Dina next week."],
        ],
      },
      {
        end: M(0, 0, 25),
        msgs: [
          ["finance", "Also the September payroll summary is ready for your approval."],
          ["finance", "Can you approve before 3 PM? The bank cut-off is today."],
        ],
      },
    ],
  },
  {
    between: ["admin", "sales"],
    unread: { admin: 1 },
    sessions: [
      {
        end: M(11, 5),
        msgs: [
          ["sales", "Mona, I had a great meeting with Nile Foods today."],
          ["admin", "Nice! What are they interested in?"],
          ["sales", "A 12-month digital marketing retainer plus the new customer portal."],
          ["admin", "That's a big one. Prepare a proposal and send it to me first."],
        ],
      },
      {
        end: M(7, 3),
        msgs: [
          ["sales", "Here's the draft proposal.", { files: ["doc-proposal"] }],
          ["admin", "Looks good. Let's offer 10% off if they sign the annual plan."],
          ["sales", "تمام، هعدّل العرض وأبعته لهم النهارده"],
          ["sales", "Sorry, wrong chat 🙈", { deleted: true }],
        ],
      },
      {
        end: M(2, 2),
        msgs: [
          ["sales", "العميل وافق مبدئياً على العرض 🎉"],
          ["admin", "ممتاز يا عمر! ابعتلي العقد النهائي لما يجهز"],
          ["sales", "", { voice: "voice-omar" }],
          ["sales", "Just sent you a voice note with the details of their requests."],
        ],
      },
      {
        end: M(0, 0, 50),
        msgs: [
          ["admin", "Listened — their onboarding requests are fine."],
          ["sales", "They want to start on October 5th. Shall I confirm?"],
        ],
      },
    ],
  },
  {
    between: ["admin", "u14"],
    sessions: [
      {
        end: M(9, 1),
        msgs: [
          ["u14", "Hi Mona, I've drafted three blog posts for the Nile Foods website."],
          ["admin", "Great Hoda, what are the topics?"],
          ["u14", "Healthy breakfast ideas, the new product line, and a behind-the-scenes story from the factory."],
          ["admin", "Love the factory story. Let's publish it first."],
        ],
      },
      {
        end: M(4, 2),
        msgs: [
          ["admin", "Please follow the updated brand guidelines for tone and imagery.", { files: ["doc-brand"] }],
          ["u14", "Got it, I'll update the drafts."],
          ["u14", `First post is live on the CMS: ${api}/local-cms/nile-foods`],
          ["admin", "Beautiful work 👏"],
        ],
      },
      {
        end: M(2, 6),
        msgs: [
          ["admin", "Can you also help Dina with the October content calendar?"],
          ["u14", "Of course, we're meeting tomorrow morning."],
        ],
      },
    ],
  },
  {
    between: ["employee", "u7"],
    sessions: [
      {
        end: M(13, 4),
        msgs: [
          ["u7", "Salma, the chat API is ready on the dev server."],
          ["employee", "Nice! Are attachments supported?"],
          ["u7", "Yes, up to 10 files per message, 10 MB each."],
          ["employee", "And voice notes?"],
          ["u7", "Separate endpoint: POST /conversations/:id/messages/voice"],
        ],
      },
      {
        end: M(6, 2),
        msgs: [
          ["employee", "الـ endpoint بتاع الرسايل بيرجّع 500 معايا لما أبعت صورة"],
          ["u7", "ثواني هشوف اللوجز"],
          ["u7", "Found it — the mime type check was too strict. Fixed and deployed."],
          ["employee", "Works now, thanks! 🙌"],
        ],
      },
      {
        end: M(3, 3),
        msgs: [
          ["employee", "Can the socket send typing indicators?"],
          ["u7", "Yes: emit typing_start / typing_stop with the conversationId."],
          ["employee", "Perfect, implementing it now."],
          ["u7", `I also created a task for read receipts: ${web("tasks")}/en`],
        ],
      },
      {
        end: M(1, 5),
        msgs: [
          ["employee", "Read receipts are working: one tick sent, two ticks delivered, green when read ✅"],
          ["u7", "Awesome 🔥"],
          ["employee", "Let's demo it in the sprint review."],
          ["u7", "Sounds good."],
          ["u7", "PS: I'm on leave Thursday, Ahmed will cover QA questions."],
        ],
      },
    ],
  },
  {
    between: ["employee", "u8"],
    unread: { employee: 3 },
    sessions: [
      {
        end: M(10, 2),
        msgs: [
          ["u8", "Hi Salma! I finished the mobile chat designs."],
          ["employee", "Yay, send them over 😍"],
          ["u8", "Here's the conversation screen and the Nile Foods campaign moodboard.", { files: ["img-mobile-chat", "img-moodboard"] }],
          ["employee", "These are beautiful. What's the bubble radius?"],
          ["u8", "16px with a 6px tail corner. The colours are in the design tokens file."],
        ],
      },
      {
        end: M(5, 3),
        msgs: [
          ["employee", "Where can I find the exported icons?"],
          ["u8", `In the design assets folder: ${web("files")}/en`],
          ["employee", "Found them, thanks!"],
          ["u8", "I also updated the empty states for the chat list."],
        ],
      },
      {
        end: M(2, 1),
        msgs: [
          ["employee", "Quick question: should deleted messages show a placeholder?"],
          ["u8", "Yes — 'This message was deleted' in italic, 60% opacity."],
          ["employee", "Done ✅"],
        ],
      },
      {
        end: M(0, 0, 40),
        msgs: [
          ["u8", "I shared the sprint board sketch from today's workshop.", { files: ["img-sprint-board"] }],
          ["u8", "Can you check if the new tabs fit on small screens?"],
          ["u8", "No rush, anytime before Thursday 🙂"],
        ],
      },
    ],
  },
  {
    between: ["employee", "manager"],
    unread: { manager: 1 },
    unreadStatus: "sent",
    sessions: [
      {
        end: M(3, 7),
        msgs: [
          ["manager", "صباح الخير يا سلمى، إيه أخبار صفحة الـ People؟"],
          ["employee", "صباح النور يا كريم، خلصت الفلاتر وفاضل الـ pagination"],
          ["manager", "تمام، محتاجينها قبل اجتماع الأحد"],
          ["employee", "إن شاء الله هتكون جاهزة يوم الخميس"],
        ],
      },
      {
        end: M(0, 3),
        msgs: [
          ["manager", "Great work on the release notes, very clear."],
          ["employee", "Thanks Karim! 🙏"],
          ["employee", "The People page pagination is merged, you can test it on staging."],
        ],
      },
    ],
  },
  {
    between: ["sales", "customer"],
    sessions: [
      {
        end: M(8, 5),
        msgs: [
          ["sales", "Hi Nour, thanks for your time today. As promised, here's our proposal.", { files: ["doc-proposal"] }],
          ["customer", "Thanks Omar, we'll review it internally and get back to you."],
        ],
      },
      {
        end: M(4, 4),
        msgs: [
          ["customer", "Hi Omar, we reviewed the proposal. The team likes the customer portal idea."],
          ["sales", "Great to hear! Any questions about the timeline?"],
          ["customer", "Can the portal support Arabic and English from day one?"],
          ["sales", "Yes, both languages are included in phase 1."],
          ["customer", "ممتاز، ده كان أهم طلب عندنا"],
        ],
      },
      {
        end: M(1, 2),
        msgs: [
          ["sales", "I've shared the updated pricing with the 10% annual discount."],
          ["customer", "Perfect. Our finance team will confirm by Sunday."],
          ["customer", "Can we schedule a call on Thursday?"],
          ["sales", "Sure! Thursday 11 AM works for me. I'll send an invite."],
        ],
      },
    ],
  },
  {
    between: ["u14", "u12"],
    unread: { u14: 1 },
    sessions: [
      {
        end: M(5, 1),
        msgs: [
          ["u12", "Hoda, can we plan the October content calendar together?"],
          ["u14", "Yes! Tomorrow at 10 works for me."],
          ["u12", "Great, I'll prepare the channels and dates."],
        ],
      },
      {
        end: M(2, 3),
        msgs: [
          ["u12", "Here's the first draft of the calendar.", { files: ["doc-content-calendar"] }],
          ["u14", "Looks good! I'll write the blog posts for weeks 1 and 3."],
          ["u12", "And I'll handle the Instagram posts."],
          ["u14", "Let's add a post about World Food Day on October 16th 🍞"],
          ["u12", "Great idea, added!"],
        ],
      },
      {
        end: M(0, 0, 15),
        msgs: [["u12", "I added the Instagram captions in column F."]],
      },
    ],
  },
];

// Minutes since each person was last seen (until they connect to the chat socket).
module.exports.LAST_SEEN = { admin: 6, manager: 32, employee: 11, sales: 47, customer: 1500, finance: 19, u7: 190, u8: 36, u9: 2900, u10: 400, u11: 1300, u12: 13, u13: 3100, u14: 62, u15: 250, u16: 4400 };
