// GET /uploads/seed/:file - sample documents generated on the fly (no files on disk needed).
module.exports = function filesRoutes(app, h) {
  const { db, F, V } = h;

  function cvPdf(a) {
    const job = db.jobs.find(a.jobId);
    return F.documentPdf({
      title: a.fullName,
      subtitle: `${a.email}  |  ${a.phoneNumber}  |  ${a.address}`,
      sections: [
        { heading: "Objective", lines: [`Applying for: ${job ? job.title : "Open position"} at ${db.company.name}.`] },
        { heading: "Education", lines: [`${a.qualification} - ${a.university} (${String(a.graduationDate).slice(0, 4)})`] },
        { heading: "Experience", lines: ["2023 - present   Senior role at a Cairo-based technology company", "2020 - 2023      Mid-level role at a regional services firm", "2018 - 2020      Internship and junior roles"] },
        { heading: "Skills", lines: [(job?.jobSkills || []).join(", ") || "Communication, Teamwork", "Languages: Arabic (native), English (fluent)"] },
        { heading: "References", lines: ["Available on request."] },
      ],
    });
  }

  app.get("/uploads/seed/:file", (req, res) => {
    const name = req.params.file;
    const doc = db.seedDocs[name];
    if (!doc) return res.status(404).type("text/plain").send("Not found");
    if (doc.kind === "avatar") {
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.type("image/svg+xml").send(F.avatarSvg(doc.initials, doc.seed));
    }
    let buf;
    if (doc.kind === "cv") {
      const a = db.applications.find(doc.candidateId);
      if (!a) return res.status(404).type("text/plain").send("Not found");
      buf = cvPdf(a);
    } else {
      buf = F.documentPdf({ title: doc.title, subtitle: doc.subtitle, sections: [{ lines: doc.lines || [] }] });
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${name}"`);
    res.end(buf);
  });

  // Avatars for employees created at runtime reuse the same generator.
  app.get("/uploads/avatar/:id.svg", (req, res) => {
    const e = V.empAny(Number(req.params.id));
    if (!e) return res.status(404).type("text/plain").send("Not found");
    res.type("image/svg+xml").send(F.avatarSvg(`${e.firstName[0] || ""}${e.lastName[0] || ""}`.toUpperCase(), e.id));
  });
};
