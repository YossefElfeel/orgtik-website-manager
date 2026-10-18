"""Seed document content (fictional Orgtik data). Used by generate_assets.py.

Block format shared by PDF/DOCX/PPTX builders:
  ("h1", text) ("h2", text) ("p", text) ("small", text) ("bullets", [..])
  ("table", [header_row, *rows]) ("kv", [(label, value), ...]) ("rtl", text) ("rtl_h", text)
  ("note", text) ("sign", [(name, role), ...]) ("pagebreak",)
"""

ORG = "Orgtik LLC"
ORG_ADDR = "Building 14, 90th Street, Fifth Settlement, New Cairo, Egypt"
ORG_TAX = "Tax Reg. No. 512-883-201"


def money(v, cur="EGP"):
    return f"{cur} {v:,.2f}"


# ------------------------------------------------------------------ invoices
INVOICES = {
    "pdf_inv_0098": dict(number="INV-2026-0098", issued="2026-05-28", due="2026-06-27", status="PAID",
                         client=("Nile Foods S.A.E.", "12 El Nasr Road, Nasr City, Cairo, Egypt", "Tax ID 204-551-778"),
                         cur="EGP", vat=0.14,
                         lines=[("Digital marketing retainer - May 2026", 1, 120000), ("Social media content production (24 posts)", 24, 1850),
                                ("Paid media management fee", 1, 18500)]),
    "pdf_inv_0142": dict(number="INV-2026-0142", issued="2026-08-03", due="2026-09-02", status="PAID",
                         client=("Nile Foods S.A.E.", "12 El Nasr Road, Nasr City, Cairo, Egypt", "Tax ID 204-551-778"),
                         cur="EGP", vat=0.14,
                         lines=[("Digital marketing retainer - July 2026", 1, 120000), ("Q3 campaign landing page", 1, 42000),
                                ("Product photography session (1 day)", 1, 26000), ("Paid media management fee", 1, 18500)]),
    "pdf_inv_0157": dict(number="INV-2026-0157", issued="2026-09-01", due="2026-10-01", status="DUE",
                         client=("Riyadh Logistics Co.", "King Fahd Road, Al Olaya, Riyadh 12211, Saudi Arabia", "VAT No. 310245887600003"),
                         cur="SAR", vat=0.15,
                         lines=[("Orgtik Fleet dashboard - annual licence (50 seats)", 50, 420), ("Onboarding and data migration", 1, 9500),
                                ("Premium support (12 months)", 1, 6000)]),
    "pdf_inv_draft": dict(number="INV-2026-0160", issued="2026-09-18", due="2026-10-18", status="DRAFT",
                          client=("Gulf Retail Co.", "Sheikh Zayed Road, Trade Centre 1, Dubai, UAE", "TRN 100384562900003"),
                          cur="AED", vat=0.05,
                          lines=[("Retail analytics workshop (2 days)", 2, 7500), ("Custom Power BI dashboard", 1, 12800)]),
}


def invoice_blocks(inv):
    rows = [["Description", "Qty", "Unit price", "Amount"]]
    subtotal = 0
    for desc, qty, price in inv["lines"]:
        amt = qty * price
        subtotal += amt
        rows.append([desc, str(qty), money(price, inv["cur"]), money(amt, inv["cur"])])
    vat = subtotal * inv["vat"]
    rows.append(["", "", "Subtotal", money(subtotal, inv["cur"])])
    rows.append(["", "", f"VAT {int(inv['vat'] * 100)}%", money(vat, inv["cur"])])
    rows.append(["", "", "Total due", money(subtotal + vat, inv["cur"])])
    c = inv["client"]
    blocks = []
    if inv["status"] == "DRAFT":
        blocks.append(("draft", "DRAFT - NOT FOR PAYMENT"))
    blocks += [
        ("h1", f"Tax Invoice {inv['number']}"),
        ("kv", [("Issue date", inv["issued"]), ("Due date", inv["due"]), ("Status", inv["status"]), ("Currency", inv["cur"])]),
        ("h2", "Billed to"),
        ("p", f"<b>{c[0]}</b><br/>{c[1]}<br/>{c[2]}"),
        ("h2", "From"),
        ("p", f"<b>{ORG}</b><br/>{ORG_ADDR}<br/>{ORG_TAX}"),
        ("table", rows),
        ("h2", "Payment details"),
        ("kv", [("Bank", "Commercial International Bank (CIB) - New Cairo branch"), ("Account name", ORG),
                ("IBAN", "EG38 0019 0005 0000 0000 2631 8000 2"), ("SWIFT", "CIBEEGCX"), ("Terms", "Net 30 days from issue date")]),
        ("note", "Thank you for your business. Please quote the invoice number on your transfer."),
    ]
    return blocks


# ------------------------------------------------------------------ PDFs
PDFS = {
    "pdf_msa_nilefoods": dict(title="Master Service Agreement", subtitle="Orgtik LLC and Nile Foods S.A.E. - 2026", blocks=[
        ("h1", "Master Service Agreement"),
        ("kv", [("Agreement no.", "MSA-2026-007"), ("Effective date", "1 January 2026"), ("Term", "12 months, renewable"),
                ("Client", "Nile Foods S.A.E., Cairo"), ("Provider", "Orgtik LLC, New Cairo")]),
        ("h2", "1. Scope of services"),
        ("p", "Orgtik will provide digital marketing, marketing technology and analytics services to Nile Foods as described in the "
              "statements of work (SOWs) signed under this agreement. Each SOW defines deliverables, milestones and acceptance criteria."),
        ("bullets", ["Always-on social media management for the Nile Juice and Nile Dairy brands",
                     "Quarterly campaign planning, production and paid media management",
                     "Monthly performance dashboards and a quarterly business review",
                     "Maintenance of the nilefoods.com.eg product catalogue"]),
        ("h2", "2. Fees and payment"),
        ("p", "The annual retainer is EGP 1,450,000 excluding VAT, invoiced monthly in arrears. Media spend is billed at cost "
              "with a 7.5% management fee. Invoices are payable within thirty (30) days of issue."),
        ("table", [["Item", "Basis", "Amount (EGP)"], ["Retainer", "Monthly", "120,833"], ["Media management fee", "% of spend", "7.5%"],
                   ["Additional production", "Day rate", "18,000"]]),
        ("h2", "3. Service levels"),
        ("p", "Urgent requests raised by the client's marketing director are acknowledged within four business hours. "
              "Standard requests are acknowledged within one business day (Sunday to Thursday, 9:00-17:00 Cairo time)."),
        ("h2", "4. Confidentiality"),
        ("p", "Each party shall keep confidential all non-public information received from the other party and use it only "
              "for the purpose of this agreement. This obligation survives termination for three (3) years."),
        ("h2", "5. Intellectual property"),
        ("p", "Upon full payment, all campaign deliverables created specifically for Nile Foods are assigned to Nile Foods. "
              "Orgtik retains ownership of its pre-existing tools, templates and know-how."),
        ("h2", "6. Termination"),
        ("p", "Either party may terminate this agreement with sixty (60) days' written notice. Fees for work performed "
              "up to the termination date remain payable."),
        ("h2", "7. Governing law"),
        ("p", "This agreement is governed by the laws of the Arab Republic of Egypt. Disputes shall be referred to the "
              "competent courts of Cairo."),
        ("sign", [("Mona Adel", "Chief Executive Officer, Orgtik LLC"), ("Nour Khaled", "Marketing Director, Nile Foods S.A.E.")]),
    ]),
    "pdf_sla_gulf": dict(title="SLA Addendum", subtitle="Gulf Retail Co. - Retail Analytics Platform", blocks=[
        ("h1", "Service Level Addendum"),
        ("kv", [("Customer", "Gulf Retail Co., Dubai, UAE"), ("Service", "Orgtik Retail Analytics (SaaS)"), ("Addendum to", "Subscription Agreement SA-2025-031"), ("Effective", "1 September 2026")]),
        ("h2", "Availability commitment"),
        ("p", "Orgtik commits to a monthly availability of 99.9% for the production environment, excluding scheduled maintenance "
              "announced at least 48 hours in advance (Fridays 02:00-04:00 GST)."),
        ("table", [["Priority", "Definition", "First response", "Target resolution"],
                   ["P1 - Critical", "Platform unavailable for all users", "30 minutes", "4 hours"],
                   ["P2 - High", "Key feature degraded, no workaround", "2 hours", "1 business day"],
                   ["P3 - Normal", "Issue with a workaround", "1 business day", "5 business days"],
                   ["P4 - Low", "Question or cosmetic issue", "2 business days", "Next release"]]),
        ("h2", "Service credits"),
        ("table", [["Monthly availability", "Credit (% of monthly fee)"], ["99.0% - 99.9%", "5%"], ["95.0% - 99.0%", "10%"], ["Below 95.0%", "25%"]]),
        ("p", "Credits must be requested within 30 days of the end of the affected month and are the customer's sole remedy "
              "for availability shortfalls."),
        ("sign", [("Karim Hassan", "Operations Manager, Orgtik"), ("Faisal Al Mansoori", "IT Director, Gulf Retail Co.")]),
    ]),
    "pdf_delta_ar": dict(title="Supply Agreement - عقد توريد", subtitle="Orgtik LLC and Delta Trading Co.", blocks=[
        ("h1", "Supply Agreement"),
        ("rtl_h", "عقد توريد أجهزة ومستلزمات مكتبية"),
        ("kv", [("Supplier", "Delta Trading Co., Tanta, Egypt"), ("Buyer", "Orgtik LLC, New Cairo"), ("Contract value", "EGP 685,000 (incl. VAT)"), ("Delivery", "Within 21 days of the purchase order")]),
        ("rtl", "إنه في يوم الأحد الموافق ١٣ سبتمبر ٢٠٢٦ تم الاتفاق بين كل من شركة أورجتيك (الطرف الأول) وشركة الدلتا للتجارة (الطرف الثاني) على توريد الأجهزة والمستلزمات المكتبية الموضحة في الجدول التالي لمقر الشركة الجديد بالتجمع الخامس."),
        ("table", [["Item / الصنف", "Qty / الكمية", "Unit price / سعر الوحدة", "Total / الإجمالي"],
                   ["Laptop 14\" (Core i7, 16GB)", "20", "EGP 26,500", "EGP 530,000"],
                   ["27\" monitor", "20", "EGP 5,400", "EGP 108,000"],
                   ["Ergonomic chair", "12", "EGP 3,900", "EGP 46,800"]]),
        ("h2", "Terms"),
        ("bullets", ["30% advance payment on signature, 70% on delivery and acceptance", "12-month warranty on all devices", "Delivery to the Fifth Settlement office, 3rd floor"]),
        ("rtl", "يلتزم الطرف الثاني بتوريد الأصناف المذكورة بحالة جديدة وبضمان لمدة اثني عشر شهرا، ويحق للطرف الأول رفض أي صنف غير مطابق للمواصفات."),
        ("sign", [("Karim Hassan", "Operations Manager, Orgtik"), ("Ahmed El Sayed", "General Manager, Delta Trading Co.")]),
    ]),
    "pdf_lease": dict(title="Office Lease Agreement", subtitle="New Cairo HQ - Fifth Settlement", blocks=[
        ("h1", "Office Lease Agreement"),
        ("kv", [("Premises", "Unit 3B, Building 14, 90th Street, Fifth Settlement, New Cairo"), ("Area", "850 m2 (plus 12 parking spaces)"),
                ("Landlord", "Capital Business Parks S.A.E."), ("Tenant", "Orgtik LLC"), ("Term", "5 years from 1 March 2026")]),
        ("h2", "Rent and service charges"),
        ("table", [["Period", "Monthly rent (EGP)", "Service charge (EGP)"], ["Year 1", "385,000", "42,500"], ["Year 2", "404,250", "44,600"],
                   ["Year 3", "424,460", "46,800"], ["Years 4-5", "Indexed +5% per year", "At cost"]]),
        ("p", "Rent is payable quarterly in advance. A security deposit equal to three months' rent was paid on signature."),
        ("h2", "Fit-out"),
        ("p", "The landlord grants a rent-free fit-out period of 60 days. The tenant's fit-out plans (open-plan workspace, "
              "4 meeting rooms, a studio and a server room) were approved on 12 February 2026."),
        ("h2", "Maintenance and insurance"),
        ("bullets", ["Landlord: structure, facade, elevators, central air-conditioning", "Tenant: internal finishes, IT cabling, contents insurance",
                     "Fire and civil-defence certificates maintained by the landlord"]),
        ("sign", [("Mona Adel", "Chief Executive Officer, Orgtik LLC"), ("Hesham Zaki", "Leasing Director, Capital Business Parks")]),
    ]),
    "pdf_brand_guidelines": dict(title="Brand Guidelines 2026", subtitle="How the Orgtik brand looks, sounds and behaves", cover=True, blocks=[
        ("h1", "1. Our brand"),
        ("p", "Orgtik helps teams across Egypt and the GCC organise their work, files and customers in one connected suite. "
              "Our brand is confident, clear and warm - a calm operator in a noisy market."),
        ("h2", "Logo usage"),
        ("bullets", ["Use the full lockup on light backgrounds, the icon on small surfaces (under 32 px)",
                     "Keep clear space equal to the height of the 'O' on every side", "Never stretch, rotate or recolour the logo outside the palette"]),
        ("h1", "2. Colour palette"),
        ("swatches", [("#8135CD", "Orgtik Purple", "Primary"), ("#1E1B4B", "Midnight", "Text & dark UI"), ("#F5F3FF", "Lavender Mist", "Backgrounds"),
                      ("#FF692E", "Sunset", "Accent"), ("#32ABB9", "Nile Teal", "Data & charts"), ("#0061FF", "Signal Blue", "Links")]),
        ("h1", "3. Typography"),
        ("table", [["Use", "Typeface", "Weight", "Size"], ["Headlines", "Geist / Segoe UI", "Bold", "32-48 pt"],
                   ["Body", "Geist / Segoe UI", "Regular", "10-12 pt"], ["Arabic", "Dubai", "Regular / Medium", "+1 pt vs Latin"]]),
        ("h1", "4. Voice and tone"),
        ("p", "We write the way we speak to a respected colleague: short sentences, active verbs, no jargon. "
              "In Arabic we prefer Modern Standard Arabic for documents and friendly Egyptian or Gulf phrasing for social media."),
        ("table", [["We are", "We are not"], ["Clear", "Complicated"], ["Helpful", "Pushy"], ["Confident", "Arrogant"], ["Local", "Generic"]]),
    ]),
    "pdf_expo_brochure": dict(title="Orgtik at Riyadh Expo 2026", subtitle="Booth B-214 - Riyadh Front Exhibition Centre - 3-5 November 2026", cover=True, blocks=[
        ("h1", "Meet the Orgtik suite"),
        ("p", "Visit booth B-214 to see how retailers, distributors and service companies in Saudi Arabia run their operations on Orgtik."),
        ("table", [["Product", "What it does"], ["Orgtik Tasks", "Projects, sprints and approvals for distributed teams"],
                   ["Orgtik Files", "Secure file sharing with external links, expiry and download limits"],
                   ["Orgtik Sales", "Pipeline, quotations and multi-currency pricing (SAR, AED, EGP)"],
                   ["Orgtik HR", "Attendance, leave and payroll-ready reports for Saudi labour law"]]),
        ("h2", "Live demos"),
        ("bullets", ["Daily 11:00 - Digital transformation for retail chains", "Daily 14:00 - From spreadsheets to dashboards in 30 days",
                     "5 Nov 16:00 - Customer panel with Riyadh Logistics Co."]),
        ("h2", "Book a meeting"),
        ("kv", [("Email", "expo@orgtik.test"), ("Phone / WhatsApp", "+966 11 555 0142"), ("Sales lead", "Omar Farouk")]),
    ]),
    "pdf_vat_q2": dict(title="VAT Return Q2 2026", subtitle="Egyptian Tax Authority - monthly returns summary", blocks=[
        ("h1", "VAT Return Summary - Q2 2026"),
        ("kv", [("Taxpayer", ORG), ("Registration", ORG_TAX), ("Period", "April - June 2026"), ("Prepared by", "Aya Hamed, Accountant")]),
        ("table", [["Month", "Taxable sales (EGP)", "Output VAT 14%", "Input VAT", "Net payable"],
                   ["April", "2,180,400", "305,256", "118,420", "186,836"], ["May", "2,356,900", "329,966", "126,300", "203,666"],
                   ["June", "2,512,300", "351,722", "131,875", "219,847"], ["Total", "7,049,600", "986,944", "376,595", "610,349"]]),
        ("p", "All three monthly returns were filed through the e-Tax portal before the 30th of the following month. "
              "Electronic invoices were issued for 100% of B2B sales in line with the e-invoicing system."),
        ("note", "Reviewed by Hany Samir, Finance Manager, on 24 July 2026."),
    ]),
    "pdf_handbook": dict(title="Employee Handbook 2026", subtitle="Everything you need to know about working at Orgtik", cover=True, blocks=[
        ("h1", "Welcome to Orgtik"),
        ("p", "We are a team of 140 people across Cairo, Riyadh and Dubai. This handbook explains how we work together, "
              "what you can expect from us and what we expect from you."),
        ("h1", "Working hours"),
        ("p", "Our standard week is Sunday to Thursday, 9:00 to 17:00 local time, with flexible start between 8:00 and 10:00. "
              "During Ramadan working hours are reduced to 10:00-15:00."),
        ("h1", "Leave"),
        ("table", [["Leave type", "Entitlement", "Notes"], ["Annual leave", "21 working days", "30 days after 10 years of service"],
                   ["Sick leave", "Up to 90 days / year", "Medical certificate after 2 days"], ["Maternity leave", "4 months", "Fully paid"],
                   ["Paternity leave", "5 working days", "Within 3 months of birth"], ["Hajj leave", "1 month", "Once during employment"]]),
        ("h1", "Benefits"),
        ("bullets", ["Private medical insurance for you and your family", "Annual learning budget of EGP 20,000",
                     "Hybrid work: up to 2 remote days per week", "Quarterly team events and an annual Iftar"]),
        ("h1", "Code of conduct"),
        ("p", "Treat colleagues, clients and partners with respect. Protect confidential information, avoid conflicts of interest "
              "and report concerns to HR (hr@orgtik.test) or through the anonymous ethics line."),
    ]),
    "pdf_handbook_old": dict(title="Employee Handbook 2025", subtitle="Superseded by the 2026 edition", blocks=[
        ("h1", "Employee Handbook 2025 (superseded)"),
        ("note", "This version is kept for reference only. The 2026 handbook replaces it from 1 January 2026."),
        ("h2", "Working hours"),
        ("p", "Sunday to Thursday, 9:00 to 17:00. Remote work by manager approval only."),
        ("h2", "Leave"),
        ("table", [["Leave type", "Entitlement"], ["Annual leave", "21 working days"], ["Sick leave", "Up to 90 days / year"], ["Maternity leave", "3 months"]]),
    ]),
    "pdf_handoff": dict(title="Design Handoff Notes", subtitle="Mobile App v3 - release 3.2", blocks=[
        ("h1", "Design Handoff - Mobile App v3"),
        ("kv", [("Designer", "Laila Mostafa"), ("Developers", "Salma Nabil, Youssef Ibrahim"), ("Figma file", "Components Library.fig"), ("Status", "Ready for development")]),
        ("h2", "Design tokens"),
        ("table", [["Token", "Value", "Usage"], ["color.primary", "#8135CD", "Buttons, active tabs"], ["color.surface", "#FFFFFF", "Cards"],
                   ["color.background", "#F7F5FC", "Screens"], ["radius.card", "16 px", "Cards, sheets"], ["space.base", "8 px grid", "All layouts"],
                   ["font.body", "Geist 15/22", "Body copy"]]),
        ("h2", "Screens in this release"),
        ("bullets", ["Home - new product carousel and quick re-order", "Checkout - one-page flow with saved addresses",
                     "Order tracking - live courier map", "Arabic RTL mirroring for all screens"]),
        ("h2", "Accessibility"),
        ("p", "All text meets WCAG AA contrast. Touch targets are at least 44 x 44 px. Dynamic type is supported up to 200%."),
    ]),
    "pdf_proposal_nilefoods": dict(title="Digital Growth Program", subtitle="Proposal for Nile Foods S.A.E. - Q4 2026 to Q2 2027", cover=True, blocks=[
        ("h1", "Executive summary"),
        ("p", "Nile Foods wants to grow its direct-to-consumer sales and strengthen the Nile Juice brand among 18-34 year-olds in "
              "Greater Cairo and Alexandria. We propose a nine-month Digital Growth Program combining always-on content, "
              "performance media and a new e-commerce experience."),
        ("h1", "Objectives"),
        ("table", [["Objective", "Baseline (Q3 2026)", "Target (Q2 2027)"], ["Online orders / month", "3,200", "8,000"],
                   ["Instagram engagement rate", "1.8%", "3.5%"], ["Cost per acquisition", "EGP 96", "EGP 60"], ["Repeat purchase rate", "22%", "35%"]]),
        ("h1", "Scope and timeline"),
        ("table", [["Phase", "Months", "Key deliverables"], ["Discover", "Oct 2026", "Audience research, analytics audit"],
                   ["Launch", "Nov-Dec 2026", "Winter campaign, new product pages"], ["Scale", "Jan-Mar 2027", "Ramadan campaign, loyalty pilot"],
                   ["Optimise", "Apr-Jun 2027", "CRO sprints, quarterly review"]]),
        ("h1", "Investment"),
        ("table", [["Item", "Amount (EGP)"], ["Strategy and research", "180,000"], ["Content production (9 months)", "810,000"],
                   ["E-commerce experience", "420,000"], ["Performance media management", "7.5% of spend"], ["Total (excl. media and VAT)", "1,410,000"]]),
        ("h1", "Next steps"),
        ("bullets", ["Workshop with the Nile Foods marketing team - week of 5 October", "Sign SOW-2026-03 under the existing MSA", "Kick-off 15 October 2026"]),
        ("sign", [("Omar Farouk", "Sales Executive, Orgtik"), ("Tamer Wagdy", "Account Manager, Orgtik")]),
    ]),
    "pdf_architecture": dict(title="Architecture Overview", subtitle="Orgtik platform - services, data and infrastructure", blocks=[
        ("h1", "Platform architecture"),
        ("p", "The Orgtik suite is a set of Next.js frontends backed by NestJS services. All services share the SOS identity "
              "service for single sign-on, scopes and roles."),
        ("table", [["Service", "Responsibility", "Stack", "Owner"], ["sos-identity", "Users, scopes, tokens", "NestJS, PostgreSQL", "Youssef Ibrahim"],
                   ["file-manager", "Folders, files, shares, previews", "NestJS, S3, FFmpeg workers", "Youssef Ibrahim"],
                   ["task-manager", "Projects, boards, sprints", "NestJS, PostgreSQL, Redis", "Salma Nabil"],
                   ["sales", "Pipeline, pricing zones, quotations", "NestJS, PostgreSQL", "Ahmed Tarek"],
                   ["notifications", "Email, push, in-app", "Node.js, BullMQ", "Mahmoud Gamal"]]),
        ("h2", "Infrastructure"),
        ("bullets", ["Kubernetes (3 node pools) in the Frankfurt region, CDN edge in Riyadh and Cairo", "PostgreSQL 16 with point-in-time recovery (7 days)",
                     "Object storage with server-side encryption; previews generated asynchronously", "Blue/green deployments via GitHub Actions and Argo CD"]),
        ("h2", "Security"),
        ("p", "Short-lived access tokens, per-scope roles, audit logs on every write, and external share links protected by "
              "secrets, optional passwords, expiry dates and download limits."),
    ]),
    "pdf_company_profile": dict(title="Company Profile 2026", subtitle="Software and services for growing businesses in Egypt and the GCC", cover=True, blocks=[
        ("h1", "Who we are"),
        ("p", "Founded in Cairo in 2019, Orgtik builds a connected suite of business tools - tasks, files, sales, HR and marketing - "
              "and helps companies adopt them. Today we serve 320 customers from offices in Cairo, Riyadh and Dubai."),
        ("table", [["Office", "Address", "Team"], ["Cairo (HQ)", "Fifth Settlement, New Cairo", "96"], ["Riyadh", "Al Olaya, King Fahd Road", "28"],
                   ["Dubai", "Business Bay", "16"]]),
        ("h1", "What we do"),
        ("bullets", ["Orgtik Suite - SaaS for tasks, files, sales, HR and digital marketing", "Implementation and data migration",
                     "Digital marketing services for FMCG and retail brands", "Analytics and dashboards"]),
        ("h1", "Selected clients"),
        ("p", "Nile Foods, Gulf Retail Co., Riyadh Logistics Co., Delta Trading Co., Alexandria Pharma, Red Sea Resorts."),
        ("h1", "In numbers"),
        ("kv", [("Customers", "320"), ("Active users", "18,400"), ("Uptime 2025", "99.95%"), ("Customer satisfaction", "4.7 / 5")]),
    ]),
    "pdf_board_deck": dict(title="Board Meeting - Q3 2026", subtitle="Prepared by Mona Adel, CEO", slides=True, blocks=[
        ("slide", "Q3 2026 at a glance", [("kpi", [("Revenue", "EGP 21.4M", "+18% YoY"), ("New customers", "34", "+9 vs Q2"), ("Churn", "1.1%", "-0.4 pts"), ("Headcount", "140", "+6")])]),
        ("slide", "Revenue by line of business", [("table", [["Line", "Q2 2026", "Q3 2026", "Change"], ["SaaS subscriptions", "11.2M", "12.9M", "+15%"],
                                                              ["Implementation", "3.1M", "3.6M", "+16%"], ["Marketing services", "4.0M", "4.9M", "+23%"], ["Total", "18.3M", "21.4M", "+17%"]])]),
        ("slide", "Highlights", [("bullets", ["Signed Riyadh Logistics (50 seats) and renewed Nile Foods MSA", "Moved into the New Cairo HQ on schedule",
                                              "Launched external share links in Orgtik Files", "Riyadh Expo 2026 booth confirmed (B-214)"])]),
        ("slide", "Risks and asks", [("bullets", ["EGP/USD volatility on cloud costs - hedge 40% of 2027 spend", "Hiring senior backend engineers in Riyadh",
                                                  "Board approval: EGP 6M budget for the Dubai sales team expansion"])]),
    ]),
    "pdf_exec_summary": dict(title="Q3 2026 Executive Summary", subtitle="For the leadership team", blocks=[
        ("h1", "Q3 2026 Executive Summary"),
        ("kv", [("Revenue", "EGP 21.4M (+18% YoY)"), ("Gross margin", "64%"), ("Cash runway", "26 months"), ("NPS", "52")]),
        ("h2", "What went well"),
        ("bullets", ["Record quarter for marketing services, led by Nile Foods and Red Sea Resorts", "Files product: external sharing adopted by 41% of accounts",
                     "Support first-response time down to 38 minutes"]),
        ("h2", "What needs attention"),
        ("bullets", ["Two enterprise renewals slipped to Q4 (Gulf Retail, Alexandria Pharma)", "Cloud costs up 12% after the EGP devaluation"]),
        ("h2", "Priorities for Q4"),
        ("table", [["Priority", "Owner", "Due"], ["Close 2 enterprise renewals", "Omar Farouk", "30 Nov"], ["Launch Orgtik HR payroll export", "Sherif Magdy", "15 Dec"],
                   ["Riyadh Expo - 60 qualified leads", "Dina Fathy", "5 Nov"]]),
    ]),
    "pdf_old_vendor": dict(title="Vendor Agreement 2024", subtitle="Expired - kept for records", blocks=[
        ("h1", "Cleaning Services Agreement 2024"),
        ("kv", [("Vendor", "Sparkle Facility Services"), ("Term", "1 Jan 2024 - 31 Dec 2024"), ("Value", "EGP 18,000 / month"), ("Status", "Expired, not renewed")]),
        ("p", "Daily cleaning of the Maadi office (420 m2), weekly deep cleaning of kitchens and meeting rooms."),
    ]),
}
for _k, _inv in INVOICES.items():
    PDFS[_k] = dict(title=f"Invoice {_inv['number']}", subtitle=_inv["client"][0], blocks=invoice_blocks(_inv))

# ------------------------------------------------------------------ DOCX
DOCX = {
    "docx_nda_riyadh": dict(title="Mutual Non-Disclosure Agreement", blocks=[
        ("h1", "Mutual Non-Disclosure Agreement"),
        ("p", "This Mutual Non-Disclosure Agreement is entered into on 17 September 2026 between Orgtik LLC, New Cairo, Egypt "
              "and Riyadh Logistics Co., Riyadh, Kingdom of Saudi Arabia (each a \"Party\")."),
        ("h2", "1. Purpose"),
        ("p", "The Parties wish to evaluate a fleet analytics integration (the \"Purpose\") and will exchange confidential information for that Purpose only."),
        ("h2", "2. Obligations"),
        ("bullets", ["Keep the other Party's confidential information secret and protect it with reasonable care",
                     "Share it only with employees and advisers who need to know it", "Return or destroy it on written request"]),
        ("h2", "3. Term"),
        ("p", "This agreement lasts two (2) years from signature. Confidentiality obligations survive for a further three (3) years."),
        ("h2", "4. Governing law"),
        ("p", "This agreement is governed by the laws of the Kingdom of Saudi Arabia."),
        ("table", [["For Orgtik LLC", "For Riyadh Logistics Co."], ["Omar Farouk, Sales Executive", "Abdullah Al Harbi, COO"], ["Signature: ____________", "Signature: ____________"]]),
    ]),
    "docx_leave_policy_ar": dict(title="سياسة الإجازات 2026", rtl=True, blocks=[
        ("rtl_h", "سياسة الإجازات لعام ٢٠٢٦"),
        ("rtl", "تهدف هذه السياسة إلى توضيح أنواع الإجازات المتاحة لموظفي شركة أورجتيك في مصر والسعودية والإمارات وطريقة طلبها واعتمادها."),
        ("rtl_h2", "أولا: الإجازة السنوية"),
        ("rtl", "يستحق الموظف إجازة سنوية مدفوعة الأجر مدتها واحد وعشرون يوم عمل، تزيد إلى ثلاثين يوما بعد عشر سنوات من الخدمة."),
        ("rtl_h2", "ثانيا: الإجازة المرضية"),
        ("rtl", "تمنح الإجازة المرضية بناء على تقرير طبي معتمد، ويجب إبلاغ المدير المباشر في أول يوم للغياب."),
        ("rtl_h2", "ثالثا: طلب الإجازة"),
        ("rtl_bullets", ["يقدم طلب الإجازة من خلال نظام أورجتيك للموارد البشرية قبل أسبوع على الأقل", "يعتمد المدير المباشر الطلب خلال يومي عمل", "تُرحّل الأيام غير المستخدمة حتى نهاية شهر مارس من العام التالي"]),
        ("table", [["نوع الإجازة", "المدة", "ملاحظات"], ["سنوية", "٢١ يوم عمل", "٣٠ يوما بعد ١٠ سنوات"], ["مرضية", "حتى ٩٠ يوما", "بتقرير طبي"], ["وضع", "٤ أشهر", "مدفوعة بالكامل"]]),
        ("rtl", "للاستفسار يرجى التواصل مع إدارة الموارد البشرية - رنا سعد."),
    ]),
    "docx_onboarding": dict(title="Onboarding Checklist", blocks=[
        ("h1", "New Joiner Onboarding Checklist"),
        ("p", "Use this checklist for every new team member. HR owns the checklist; the hiring manager owns week one."),
        ("h2", "Before day one"),
        ("bullets", ["Send the offer letter and the Employee Handbook 2026", "Order laptop and accessories (IT ticket)", "Create the Orgtik account and add scopes"]),
        ("h2", "Week one"),
        ("table", [["Day", "Activity", "Owner"], ["Sunday", "Welcome session and office tour", "Rana Saad"], ["Monday", "Tools setup: Tasks, Files, Slack", "IT"],
                   ["Tuesday", "Meet the team and first 1:1", "Hiring manager"], ["Wednesday", "Security and data protection training", "Mahmoud Gamal"],
                   ["Thursday", "First small task shipped", "Buddy"]]),
        ("h2", "After 30 days"),
        ("bullets", ["Probation check-in with the manager", "Feedback survey to HR", "Confirm medical insurance enrolment"]),
    ]),
    "docx_campaign_brief": dict(title="Campaign Brief - Q4 2026", blocks=[
        ("h1", "Campaign Brief - Nile Juice Winter 2026"),
        ("table", [["Client", "Nile Foods S.A.E."], ["Brand", "Nile Juice"], ["Flight dates", "15 November - 31 December 2026"], ["Budget", "EGP 2.4M media + EGP 380K production"]]),
        ("h2", "Background"),
        ("p", "Juice consumption drops in winter. Nile Juice wants to own the \"warm breakfast\" moment with its new mango and guava blends."),
        ("h2", "Audience"),
        ("p", "Young families and students in Greater Cairo and Alexandria, 18-34, heavy Instagram and TikTok users."),
        ("h2", "Key message"),
        ("p", "\"Sunshine in every glass - even in winter.\""),
        ("h2", "Deliverables"),
        ("bullets", ["3 x 15-second videos (Arabic, Egyptian dialect)", "12 Instagram posts and 20 stories", "In-store shelf talkers for Carrefour and Metro", "Influencer kit for 8 creators"]),
        ("h2", "KPIs"),
        ("bullets", ["Reach 6M unique users", "Video completion rate above 35%", "8,000 online orders in December"]),
    ]),
    "docx_sprint18": dict(title="Sprint 18 Report", blocks=[
        ("h1", "Sprint 18 Report"),
        ("table", [["Sprint", "18 (1 - 14 September 2026)"], ["Team", "Platform squad"], ["Velocity", "46 points (plan 50)"], ["Scrum master", "Sherif Magdy"]]),
        ("h2", "Delivered"),
        ("bullets", ["External share links with password, expiry and download limits", "Chunked uploads for large folders", "HLS video previews on public share pages"]),
        ("h2", "Carried over"),
        ("bullets", ["Bulk restore from archive (blocked by API review)", "Arabic search normalisation"]),
        ("h2", "Quality"),
        ("table", [["Metric", "Value"], ["Bugs opened", "9"], ["Bugs closed", "14"], ["Test coverage", "78%"], ["Escaped defects", "1 (minor)"]]),
        ("p", "Next sprint focus: archive UX, activity log filters and performance of the dashboard overview endpoint."),
    ]),
    "docx_runbook": dict(title="Deployment Runbook", blocks=[
        ("h1", "Production Deployment Runbook"),
        ("p", "Owner: Mahmoud Gamal (DevOps). Applies to all Orgtik services deployed through Argo CD."),
        ("h2", "Before you deploy"),
        ("bullets", ["Release notes approved in the Engineering folder", "Database migrations reviewed and reversible", "Status page maintenance window scheduled"]),
        ("h2", "Steps"),
        ("table", [["#", "Step", "Command / action"], ["1", "Tag the release", "git tag v3.2.0 && git push --tags"], ["2", "Promote image", "argocd app set files --revision v3.2.0"],
                   ["3", "Run migrations", "kubectl exec job/migrate -- npm run migration:run"], ["4", "Switch traffic", "Blue/green switch in Argo Rollouts"],
                   ["5", "Verify", "Smoke tests + dashboards for 15 minutes"]]),
        ("h2", "Rollback"),
        ("p", "Switch traffic back to the previous colour, then revert migrations only if the release notes say they are not backward compatible."),
    ]),
    "docx_minutes_aug": dict(title="Board Minutes - August 2026", blocks=[
        ("h1", "Minutes of the Board Meeting - 27 August 2026"),
        ("table", [["Location", "New Cairo HQ, Board Room"], ["Present", "Mona Adel (Chair), Karim Hassan, Hany Samir, two independent directors"], ["Secretary", "Rana Saad"]]),
        ("h2", "1. Financial update"),
        ("p", "Hany Samir presented the July management accounts. Revenue is 6% ahead of budget; cash position remains strong."),
        ("h2", "2. Office move"),
        ("p", "The move to the New Cairo HQ was completed on 1 August. Final fit-out costs were 4% under budget."),
        ("h2", "3. Resolutions"),
        ("bullets", ["Approved the 2027 budget process timeline", "Approved opening a bank account in Riyadh", "Deferred the Dubai expansion decision to the Q3 meeting"]),
        ("h2", "Actions"),
        ("table", [["Action", "Owner", "Due"], ["Dubai expansion business case", "Mona Adel", "Q3 board"], ["FX hedging proposal", "Hany Samir", "15 Sep"]]),
    ]),
}

# ------------------------------------------------------------------ XLSX (sheet name, header, rows, col widths)
XLSX = {
    "xlsx_contract_tracker": [("Contracts 2026", ["Contract", "Counterparty", "Type", "Start", "End", "Value", "Currency", "Status", "Owner"], [
        ["MSA-2026-007", "Nile Foods S.A.E.", "Client MSA", "2026-01-01", "2026-12-31", 1450000, "EGP", "Active", "Omar Farouk"],
        ["SA-2025-031", "Gulf Retail Co.", "Subscription", "2025-09-01", "2027-08-31", 186000, "AED", "Active", "Tamer Wagdy"],
        ["SLA-2026-004", "Gulf Retail Co.", "SLA addendum", "2026-09-01", "2027-08-31", 0, "AED", "Active", "Karim Hassan"],
        ["SUP-2026-012", "Delta Trading Co.", "Supply", "2026-09-13", "2027-09-12", 685000, "EGP", "Active", "Karim Hassan"],
        ["LEASE-2026-01", "Capital Business Parks", "Lease", "2026-03-01", "2031-02-28", 4620000, "EGP", "Active", "Mona Adel"],
        ["NDA-2026-019", "Riyadh Logistics Co.", "NDA", "2026-09-17", "2028-09-16", 0, "SAR", "Pending signature", "Omar Farouk"],
        ["LIC-2026-022", "Riyadh Logistics Co.", "Licence", "2026-09-01", "2027-08-31", 36500, "SAR", "Active", "Tamer Wagdy"],
        ["SRV-2024-003", "Sparkle Facility Services", "Services", "2024-01-01", "2024-12-31", 216000, "EGP", "Expired", "Karim Hassan"],
    ])],
    "xlsx_campaign_calendar": [("Q4 Calendar", ["Date", "Channel", "Campaign", "Content", "Owner", "Status"], [
        ["2026-10-04", "Instagram", "Orgtik 3.0 launch", "Carousel - 5 new features", "Dina Fathy", "Scheduled"],
        ["2026-10-07", "LinkedIn", "Orgtik 3.0 launch", "Founder video (60s)", "Hoda Ashraf", "In review"],
        ["2026-10-15", "Email", "Customer newsletter", "October product digest", "Hoda Ashraf", "Draft"],
        ["2026-10-21", "Instagram", "Riyadh Expo 2026", "Countdown story series", "Dina Fathy", "Planned"],
        ["2026-11-03", "LinkedIn", "Riyadh Expo 2026", "Live coverage day 1", "Dina Fathy", "Planned"],
        ["2026-11-15", "TikTok", "Nile Juice Winter", "Launch video (client)", "Dina Fathy", "Planned"],
        ["2026-11-26", "All", "White Friday", "Offer: 20% off annual plans", "Omar Farouk", "Planned"],
        ["2026-12-02", "LinkedIn", "UAE National Day", "Greeting post", "Hoda Ashraf", "Planned"],
        ["2026-12-15", "Email", "Year in review", "2026 highlights", "Hoda Ashraf", "Planned"],
    ])],
    "xlsx_reconciliation": [("Aug 2026", ["Date", "Reference", "Customer", "Invoice", "Invoiced", "Received", "Difference", "Status"], [
        ["2026-08-03", "TRX-88213", "Nile Foods S.A.E.", "INV-2026-0142", 235410, 235410, 0, "Matched"],
        ["2026-08-06", "TRX-88267", "Red Sea Resorts", "INV-2026-0138", 96900, 96900, 0, "Matched"],
        ["2026-08-11", "TRX-88340", "Alexandria Pharma", "INV-2026-0131", 142500, 140000, 2500, "Short paid"],
        ["2026-08-19", "TRX-88411", "Gulf Retail Co.", "INV-2026-0129", 15500, 15500, 0, "Matched"],
        ["2026-08-24", "TRX-88502", "Delta Trading Co.", "INV-2026-0144", 38760, 0, 38760, "Open"],
        ["2026-08-28", "TRX-88560", "Riyadh Logistics Co.", "INV-2026-0120", 22080, 22080, 0, "Matched"],
    ])],
    "xlsx_payroll": [("Sep 2026", ["Department", "Headcount", "Gross salaries (EGP)", "Social insurance", "Income tax", "Net payable"], [
        ["Management", 4, 1240000, 69500, 238000, 932500], ["Engineering", 46, 5980000, 412000, 897000, 4671000],
        ["Design", 9, 918000, 68400, 128500, 721100], ["Sales", 27, 2565000, 186200, 333450, 2045350],
        ["Marketing", 18, 1422000, 104800, 184860, 1132340], ["Finance", 8, 744000, 55200, 96720, 592080],
        ["Human Resources", 6, 468000, 34800, 60840, 372360], ["Operations", 22, 1386000, 101700, 180180, 1104120],
    ])],
    "xlsx_infra_costs": [("2026", ["Month", "Kubernetes", "Databases", "Object storage", "CDN", "Monitoring", "Total (USD)"], [
        ["Jan", 8420, 3150, 1210, 640, 480, 13900], ["Feb", 8390, 3150, 1260, 610, 480, 13890], ["Mar", 8810, 3280, 1320, 700, 480, 14590],
        ["Apr", 9120, 3280, 1390, 720, 520, 15030], ["May", 9340, 3410, 1450, 760, 520, 15480], ["Jun", 9580, 3410, 1530, 790, 520, 15830],
        ["Jul", 9860, 3560, 1610, 820, 560, 16410], ["Aug", 10240, 3560, 1700, 860, 560, 16920], ["Sep", 10110, 3560, 1760, 840, 560, 16830],
    ])],
    "xlsx_pricing": [("GCC Pricing 2026", ["Plan", "Users", "EGP / month", "SAR / month", "AED / month", "Annual discount"], [
        ["Starter", "Up to 10", 2400, 290, 285, "10%"], ["Growth", "Up to 50", 9800, 1190, 1165, "15%"],
        ["Business", "Up to 200", 32500, 3950, 3860, "18%"], ["Enterprise", "200+", "Custom", "Custom", "Custom", "Custom"],
        ["Add-on: Files 1 TB", "-", 1800, 220, 215, "10%"], ["Add-on: Premium support", "-", 4500, 545, 535, "0%"],
    ])],
    "xlsx_campaign_results_2025": [("2025", ["Campaign", "Period", "Spend (EGP)", "Reach", "Leads", "CPL (EGP)"], [
        ["Summer Sale 2025", "Jul-Aug", 420000, 3100000, 2860, 146.9], ["Back to Work", "Sep", 180000, 1250000, 1320, 136.4],
        ["White Friday 2025", "Nov", 350000, 2800000, 3410, 102.6], ["Year End", "Dec", 120000, 900000, 760, 157.9],
    ])],
    "xlsx_pricing_draft": [("Draft v1", ["Plan", "EGP / month", "Notes"], [
        ["Starter", 1900, "Too low vs competitors?"], ["Growth", 8500, ""], ["Business", 29000, "Check SAR conversion"],
    ])],
}

# ------------------------------------------------------------------ PPTX (slides: title, bullets)
PPTX = {
    "pptx_welcome": dict(title="Welcome to Orgtik", slides=[
        ("Welcome to Orgtik", ["Your first week, the people you will meet and the tools you will use", "Human Resources - 2026"]),
        ("Who we are", ["140 people in Cairo, Riyadh and Dubai", "320 customers across Egypt and the GCC", "One connected suite: Tasks, Files, Sales, HR, Marketing"]),
        ("Your first week", ["Sunday: welcome session and office tour", "Monday: tools setup with IT", "Tuesday: meet your team and buddy", "Thursday: ship your first small task"]),
        ("Where to get help", ["HR: Rana Saad - hr@orgtik.test", "IT: Mahmoud Gamal - it@orgtik.test", "Handbook: HR Documents / Policies"]),
    ]),
    "pptx_sales_kickoff": dict(title="Sales Kickoff 2026", slides=[
        ("Sales Kickoff 2026", ["Grow faster in the GCC", "Omar Farouk - Sales"]),
        ("2025 in review", ["EGP 64M bookings (+31%)", "Win rate 27% (+4 pts)", "Top deal: Nile Foods MSA renewal"]),
        ("2026 targets", ["EGP 85M bookings", "40% of new logos from KSA and UAE", "Average deal size EGP 420K"]),
        ("How we win", ["Lead with the connected suite, not single tools", "Local pricing in EGP, SAR and AED", "Customer stories from our top 10 accounts"]),
    ]),
}

# ------------------------------------------------------------------ CSV / TXT
CSV = {
    "csv_invoice_register": ["Invoice,Customer,Issue date,Due date,Currency,Net,VAT,Total,Status",
                             "INV-2026-0098,Nile Foods S.A.E.,2026-05-28,2026-06-27,EGP,182900.00,25606.00,208506.00,Paid",
                             "INV-2026-0120,Riyadh Logistics Co.,2026-06-10,2026-07-10,SAR,19200.00,2880.00,22080.00,Paid",
                             "INV-2026-0129,Gulf Retail Co.,2026-06-24,2026-07-24,AED,14761.90,738.10,15500.00,Paid",
                             "INV-2026-0131,Alexandria Pharma,2026-07-02,2026-08-01,EGP,125000.00,17500.00,142500.00,Partially paid",
                             "INV-2026-0138,Red Sea Resorts,2026-07-15,2026-08-14,EGP,85000.00,11900.00,96900.00,Paid",
                             "INV-2026-0142,Nile Foods S.A.E.,2026-08-03,2026-09-02,EGP,206500.00,28910.00,235410.00,Paid",
                             "INV-2026-0144,Delta Trading Co.,2026-08-12,2026-09-11,EGP,34000.00,4760.00,38760.00,Overdue",
                             "INV-2026-0157,Riyadh Logistics Co.,2026-09-01,2026-10-01,SAR,36500.00,5475.00,41975.00,Due",
                             "INV-2026-0160,Gulf Retail Co.,2026-09-18,2026-10-18,AED,27800.00,1390.00,29190.00,Draft"],
    "csv_ad_performance": ["Date,Channel,Campaign,Impressions,Clicks,CTR,Spend (EGP),Orders,CPA (EGP)",
                           "2026-09-01,Instagram,Mango Blend Launch,182400,3104,1.70%,18450,214,86.21",
                           "2026-09-02,Facebook,Mango Blend Launch,210950,2742,1.30%,16230,171,94.91",
                           "2026-09-03,TikTok,Mango Blend Launch,356200,5343,1.50%,21900,262,83.59",
                           "2026-09-08,Instagram,Back to School,145300,2470,1.70%,12800,160,80.00",
                           "2026-09-09,Google Search,Brand,48200,4338,9.00%,9650,305,31.64",
                           "2026-09-15,TikTok,Back to School,298700,4779,1.60%,17400,228,76.32",
                           "2026-09-22,Instagram,Family Pack,166900,2837,1.70%,14100,198,71.21",
                           "2026-09-26,Facebook,Family Pack,190400,2285,1.20%,12950,139,93.17"],
    "csv_pipeline": ["Deal,Company,Country,Stage,Value (EGP),Probability,Expected close,Owner",
                     "Fleet dashboard expansion,Riyadh Logistics Co.,KSA,Negotiation,1250000,70%,2026-10-20,Tamer Wagdy",
                     "Retail analytics renewal,Gulf Retail Co.,UAE,Proposal,2180000,60%,2026-11-15,Omar Farouk",
                     "HR suite rollout,Alexandria Pharma,Egypt,Discovery,640000,30%,2026-12-01,Omar Farouk",
                     "Digital Growth Program,Nile Foods S.A.E.,Egypt,Proposal,1410000,65%,2026-10-10,Omar Farouk",
                     "Files for guests,Red Sea Resorts,Egypt,Qualified,380000,40%,2026-11-30,Tamer Wagdy",
                     "Sales suite,Jeddah Home Stores,KSA,Discovery,920000,20%,2027-01-15,Tamer Wagdy"],
}

TXT = {
    "txt_meeting_notes": """Meeting notes - Nile Foods weekly sync
Date: Monday 14 September 2026, 11:00-12:00 (Nile Foods HQ, Nasr City + Teams)
Attendees: Nour Khaled (Nile Foods), Omar Farouk, Tamer Wagdy, Dina Fathy (Orgtik)

1. September performance
   - Online orders up 14% month on month, CPA down to EGP 82.
   - TikTok is the best performing channel for the Mango Blend launch.

2. Q4 Digital Growth Program
   - Nour asked for a phased budget: Discover + Launch approved first.
   - Orgtik to send the updated proposal by Thursday 17 September. (Omar)

3. Winter campaign
   - Brief agreed: "Sunshine in every glass - even in winter".
   - Product photos of the family pack needed by 25 September. (Nour)

Next meeting: Monday 21 September 2026, 11:00.
""",
    "txt_release_notes": """Orgtik Files - release notes v3.2.0 (2026-09-15)

New
- External share links: view-only or download, optional password, expiry date and download limit.
- Public share page with previews for images, PDFs, Office documents and HLS video.
- Folder uploads keep the full directory tree; large uploads continue in the background.

Improved
- Dashboard overview loads 40% faster.
- Archive: restore folders together with their files; bulk restore and bulk permanent delete.

Fixed
- Arabic file names are no longer garbled on download.
- Moving a folder into its own sub-folder is now blocked with a clear message.
""",
    "txt_personal_notes": """To do this week
- Finish the settings page (dark mode toggle, language switcher)
- Pair with Youssef on the share-link API contract
- Review Laila's checkout flow comments
- Book the Riyadh Expo travel (3-5 Nov)

Ideas
- Keyboard shortcuts for the file manager (U = upload, N = new folder)
- Show storage per folder in the details dialog
""",
}
