const request = require("supertest");
const User = require("../src/models/User");
const {
  setupTestApp,
  registerDoctor,
  createAdmin,
} = require("./helpers/harness");
const { displayCase } = require("../src/services/specialty.service");
const {
  sortEducation,
  experienceSummary,
} = require("../src/services/profileOrder");

const ctx = setupTestApp();

const me = (client) => client.get("/api/v1/doctors/me");
const save = (client, body) => client.patch("/api/v1/doctors/me", body);
const portfolioOf = (viewer, doctor) =>
  viewer.get(`/api/v1/doctors/${doctor.user.id}`);

describe("specialization and subspecialization", () => {
  test("the catalogue requires a session and relates each subspecialization to its specialization", async () => {
    expect(
      (await request(ctx.app).get("/api/v1/doctors/specialties")).status,
    ).toBe(401);

    const doctor = await registerDoctor(ctx.app);
    const res = await doctor.get("/api/v1/doctors/specialties");
    expect(res.status).toBe(200);
    const list = res.body.data.specializations;
    expect(list.length).toBeGreaterThanOrEqual(50);

    const ortho = list.find((s) => s.name === "Orthopaedics");
    expect(ortho.aliases).toContain("Orthopedics");
    expect(ortho.subspecializations).toEqual(
      expect.arrayContaining([
        "Spine Surgery",
        "Joint Replacement",
        "Sports Injuries",
        "Trauma",
      ]),
    );
    expect(ortho.custom).toBe(false);

    const cardio = list.find((s) => s.name === "Cardiology");
    expect(cardio.subspecializations).toContain("Interventional Cardiology");
    expect(cardio.subspecializations).not.toContain("Joint Replacement");
  });

  test("typed values are stored in a consistent form and offered to other doctors", async () => {
    const doctor = await registerDoctor(ctx.app);
    const saved = await save(doctor, {
      profile: {
        specialization: "  lifestyle   medicine ",
        subspecialty: "sleep AND recovery coaching",
      },
    });
    expect(saved.status).toBe(200);
    expect(saved.body.data.profile).toMatchObject({
      specialization: "Lifestyle Medicine",
      subspecialty: "Sleep and Recovery Coaching",
    });
    const stored = await User.findById(doctor.user.id).lean();
    expect(stored.profile.specialization).toBe("Lifestyle Medicine");
    expect(stored.profile.subspecialty).toBe("Sleep and Recovery Coaching");

    // A custom subspecialization under a predefined specialization (found here by its alias).
    const ortho = await registerDoctor(ctx.app);
    await save(ortho, {
      profile: {
        specialization: "orthopedics",
        subspecialty: "limb lengthening",
      },
    });
    expect((await me(ortho)).body.data.profile).toMatchObject({
      specialization: "Orthopedics",
      subspecialty: "Limb Lengthening",
    });

    const viewer = await registerDoctor(ctx.app);
    const all = (await viewer.get("/api/v1/doctors/specialties")).body.data
      .specializations;
    const custom = all.find((s) => s.name === "Lifestyle Medicine");
    expect(custom).toMatchObject({
      custom: true,
      subspecializations: ["Sleep and Recovery Coaching"],
    });
    expect(
      all.find((s) => s.name === "Orthopaedics").subspecializations,
    ).toContain("Limb Lengthening");
    expect(
      all.filter((s) => s.name.toLowerCase().startsWith("orthop")),
    ).toHaveLength(1); // the alias is not a second entry

    // Searchable by name, alias or subspecialization.
    const search = async (q) =>
      (
        await viewer.get(
          `/api/v1/doctors/specialties?q=${encodeURIComponent(q)}`,
        )
      ).body.data.specializations.map((s) => s.name);
    expect(await search("lifestyle")).toEqual(["Lifestyle Medicine"]);
    expect(await search("orthopedic")).toEqual(["Orthopaedics"]);
    expect(await search("limb length")).toEqual(["Orthopaedics"]);
    expect(await search("zzz-no-such-specialty")).toEqual([]);

    // A doctor who is not listed in the directory does not feed the suggestions.
    const hidden = await registerDoctor(ctx.app);
    await save(hidden, {
      profile: { specialization: "Space Medicine" },
      visibility: { directory: false },
    });
    expect(await search("space medicine")).toEqual([]);
  });

  test("display formatting keeps abbreviations and deliberate capitals", () => {
    expect(displayCase("spine surgery")).toBe("Spine Surgery");
    expect(displayCase("JOINT REPLACEMENT")).toBe("Joint Replacement");
    expect(displayCase("ent and head-neck surgery")).toBe(
      "ENT and Head-Neck Surgery",
    );
    expect(displayCase("PAEDIATRIC ICU")).toBe("Paediatric ICU");
    expect(displayCase("LASIK and MCh training")).toBe(
      "LASIK and MCh Training",
    );
    expect(displayCase("oncology (medical)")).toBe("Oncology (Medical)");
    expect(displayCase("women's health")).toBe("Women's Health");
    expect(displayCase("")).toBe("");
  });

  test("predefined options keep their listed spelling, also at registration", async () => {
    const doctor = await registerDoctor(ctx.app, {
      specialization: "ent (otorhinolaryngology)",
    });
    expect(doctor.user.profile.specialization).toBe(
      "ENT (Otorhinolaryngology)",
    );
    const saved = await save(doctor, {
      profile: {
        specialization: "CARDIOLOGY",
        subspecialty: "interventional cardiology",
      },
    });
    expect(saved.body.data.profile).toMatchObject({
      specialization: "Cardiology",
      subspecialty: "Interventional Cardiology",
    });
    expect(
      (await save(doctor, { profile: { specialization: "x".repeat(81) } }))
        .status,
    ).toBe(400);
  });

  test("a subspecialization is never carried over silently to a different specialization", async () => {
    const doctor = await registerDoctor(ctx.app);
    await save(doctor, {
      profile: {
        specialization: "Orthopaedics",
        subspecialty: "Joint Replacement",
      },
    });

    // Only the specialization changes: an incompatible subspecialization is dropped…
    let saved = await save(doctor, {
      profile: { specialization: "Cardiology" },
    });
    expect(saved.body.data.profile).toMatchObject({
      specialization: "Cardiology",
      subspecialty: "",
    });

    // …one that is also an option of the new specialization stays…
    await save(doctor, {
      profile: {
        specialization: "Orthopaedics",
        subspecialty: "Spine Surgery",
      },
    });
    saved = await save(doctor, { profile: { specialization: "Neurosurgery" } });
    expect(saved.body.data.profile).toMatchObject({
      specialization: "Neurosurgery",
      subspecialty: "Spine Surgery",
    });

    // …a change of capitals alone is not a change of specialization…
    saved = await save(doctor, { profile: { specialization: "neurosurgery" } });
    expect(saved.body.data.profile.subspecialty).toBe("Spine Surgery");

    // …and naming both is the doctor's explicit choice, including a typed value.
    saved = await save(doctor, {
      profile: {
        specialization: "Urology",
        subspecialty: "Robotic Stone Surgery",
      },
    });
    expect(saved.body.data.profile).toMatchObject({
      specialization: "Urology",
      subspecialty: "Robotic Stone Surgery",
    });
  });

  test("a doctor may hold several subspecializations", async () => {
    const doctor = await registerDoctor(ctx.app);
    let saved = await save(doctor, {
      profile: {
        specialization: "Orthopaedics",
        subspecialty: "spine surgery, joint replacement,, Spine Surgery , limb lengthening",
      },
    });
    expect(saved.status).toBe(200);
    // Listed spellings, typed ones tidied, repeats and blanks dropped.
    expect(saved.body.data.profile.subspecialty).toBe(
      "Spine Surgery, Joint Replacement, Limb Lengthening",
    );

    // Each one is offered on its own, never the combined text.
    const viewer = await registerDoctor(ctx.app);
    const ortho = (
      await viewer.get("/api/v1/doctors/specialties")
    ).body.data.specializations.find((s) => s.name === "Orthopaedics");
    expect(ortho.subspecializations).toContain("Limb Lengthening");
    expect(
      ortho.subspecializations.filter((sub) => sub.includes(",")),
    ).toEqual([]);

    // Changing only the specialization keeps the ones that are also its options.
    saved = await save(doctor, { profile: { specialization: "Neurosurgery" } });
    expect(saved.body.data.profile.subspecialty).toBe("Spine Surgery");

    const tooMany = Array.from({ length: 9 }, (_, i) => `Focus ${i + 1}`).join(", ");
    expect(
      (await save(doctor, { profile: { subspecialty: tooMany } })).status,
    ).toBe(400);
    expect(
      (await save(doctor, { profile: { subspecialty: `Spine Surgery, ${"x".repeat(81)}` } })).status,
    ).toBe(400);
  });
});

describe("basic profile additions", () => {
  let viewer;
  let doctor;
  let admin;

  beforeAll(async () => {
    viewer = await registerDoctor(ctx.app, { name: "Dr Blood Viewer" });
    doctor = await registerDoctor(ctx.app, { name: "Dr Blood Owner" });
    admin = await createAdmin(ctx.app);
  });

  test("blood group is optional, validated and private by default", async () => {
    expect((await me(doctor)).body.data.profile.bloodGroup).toBe("");
    expect((await me(doctor)).body.data.visibility.showBloodGroup).toBe(false);

    const bad = await save(doctor, { profile: { bloodGroup: "C+" } });
    expect(bad.status).toBe(400);
    expect(bad.body.error.details["profile.bloodGroup"]).toBeDefined();

    const saved = await save(doctor, {
      profile: {
        bloodGroup: "AB-",
        headline: "Teacher and clinician",
        specialization: "Cardiology",
        city: "Cuttack",
      },
      visibility: { publicListing: true },
      submit: true,
    });
    expect(saved.status).toBe(200);
    expect(saved.body.data.profile).toMatchObject({
      bloodGroup: "AB-",
      headline: "Teacher and clinician",
    });
    expect(saved.body.data.profileCompletion.isComplete).toBe(true); // leaving it out would not have blocked submission either
    expect((await User.findById(doctor.user.id)).profile.bloodGroup).toBe(
      "AB-",
    );

    // Other members never receive it by default — not on the portfolio, a card or the public list.
    const seen = await portfolioOf(viewer, doctor);
    expect(seen.body.data.profile.bloodGroup).toBe("");
    expect(seen.body.data.profile.headline).toBe("Teacher and clinician");
    expect(JSON.stringify(seen.body)).not.toContain("AB-");
    expect(
      JSON.stringify(
        (await viewer.get("/api/v1/doctors?q=blood%20owner")).body,
      ),
    ).not.toContain("AB-");
    await admin.patch(`/api/v1/admin/doctors/${doctor.user.id}/visibility`, {
      featured: true,
    });
    const featured = await request(ctx.app).get("/api/v1/doctors/featured");
    expect(featured.body.data).toHaveLength(1);
    expect(JSON.stringify(featured.body)).not.toContain("AB-");

    // The doctor and administrators see it.
    expect(
      (await portfolioOf(doctor, doctor)).body.data.profile.bloodGroup,
    ).toBe("AB-");
    expect(
      (await portfolioOf(admin, doctor)).body.data.profile.bloodGroup,
    ).toBe("AB-");
  });

  test("no other visibility setting reveals the blood group; only its own switch does", async () => {
    await save(doctor, {
      visibility: {
        showEmail: true,
        showPhone: true,
        showWorkContact: true,
        showRegistration: true,
        sections: { education: true, qualifications: true, experience: true },
      },
    });
    expect(
      JSON.stringify((await portfolioOf(viewer, doctor)).body),
    ).not.toContain("AB-");

    await save(doctor, { visibility: { showBloodGroup: true } });
    expect(
      (await portfolioOf(viewer, doctor)).body.data.profile.bloodGroup,
    ).toBe("AB-");
    // Still nowhere outside the portfolio.
    expect(
      JSON.stringify(
        (await viewer.get("/api/v1/doctors?q=blood%20owner")).body,
      ),
    ).not.toContain("AB-");
    expect(
      JSON.stringify(
        (await request(ctx.app).get("/api/v1/doctors/featured")).body,
      ),
    ).not.toContain("AB-");

    // It can be cleared again.
    expect(
      (await save(doctor, { profile: { bloodGroup: "" } })).body.data.profile
        .bloodGroup,
    ).toBe("");
  });

  test("the portfolio can be kept to a name card while staying in the directory", async () => {
    const owner = await registerDoctor(ctx.app, {
      name: "Dr Portfolio Private",
    });
    await save(owner, {
      profile: {
        specialization: "Neurology",
        city: "Puri",
        bio: "Kept private.",
      },
    });
    expect((await me(owner)).body.data.visibility.portfolio).toBe(true);
    expect((await portfolioOf(viewer, owner)).body.data.limited).toBe(false);

    await save(owner, { visibility: { portfolio: false } });
    const limited = await portfolioOf(viewer, owner);
    expect(limited.body.data.limited).toBe(true);
    expect(limited.body.data.contact).toEqual({});
    expect(JSON.stringify(limited.body)).not.toContain("Kept private.");
    expect(
      (await viewer.get("/api/v1/doctors?q=portfolio%20private")).body.data,
    ).toHaveLength(1); // still listed

    expect((await portfolioOf(owner, owner)).body.data.limited).toBe(false);
    expect((await portfolioOf(admin, owner)).body.data.profile.bio).toBe(
      "Kept private.",
    );
  });

  test("fields the form no longer shows are left untouched when the form saves", async () => {
    const owner = await registerDoctor(ctx.app);
    await save(owner, {
      profile: { interests: ["Medical education", "Rural health"] },
    });
    await save(owner, {
      profile: {
        specialization: "Psychiatry",
        expertise: ["Mood disorders"],
        procedures: [],
      },
      wizardStep: 2,
    });
    expect((await User.findById(owner.user.id)).profile.interests).toEqual([
      "Medical education",
      "Rural health",
    ]);
  });
});

describe("practice and contacts", () => {
  test("each practice location carries its own designation, and WhatsApp follows its switch", async () => {
    const viewer = await registerDoctor(ctx.app);
    const doctor = await registerDoctor(ctx.app);
    const saved = await save(doctor, {
      whatsapp: { sameAsPhone: false, number: "94370 12345" },
      profile: {
        designation: "Senior Consultant",
        hospital: "City Heart Institute",
        practiceLocations: [
          {
            hospital: "Evening Clinic",
            designation: "Visiting Consultant",
            area: "Outpatient cardiology",
            city: "Cuttack",
          },
        ],
      },
    });
    expect(saved.status).toBe(200);
    expect(saved.body.data.profile.practiceLocations[0]).toMatchObject({
      hospital: "Evening Clinic",
      designation: "Visiting Consultant",
    });
    expect(saved.body.data.whatsapp).toEqual({
      number: "+919437012345",
      sameAsPhone: false,
    });

    let seen = (await portfolioOf(viewer, doctor)).body.data;
    expect(seen.profile.practiceLocations[0].designation).toBe(
      "Visiting Consultant",
    );
    expect(seen.contact).toEqual({ whatsapp: "+919437012345" }); // shown by default; account email and phone are not

    await save(doctor, { visibility: { showWhatsapp: false } });
    seen = (await portfolioOf(viewer, doctor)).body.data;
    expect(seen.contact).toEqual({});

    expect(
      (await save(doctor, { whatsapp: { number: "call me" } })).status,
    ).toBe(400);
  });
});

describe("portfolio ordering", () => {
  const education = [
    {
      degree: "Class 10",
      level: "SECONDARY",
      institution: "Zilla School",
      year: 1994,
    },
    { degree: "MBBS", institution: "MKCG Medical College", year: 2002 }, // level left out: recognised from the title
    {
      degree: "DM",
      level: "SUPER_SPECIALITY",
      fieldOfStudy: "Cardiology",
      year: 2012,
    },
    { degree: "+2 Science", level: "HIGHER_SECONDARY", year: 1996 },
    {
      degree: "MD",
      level: "POSTGRADUATE",
      fieldOfStudy: "General Medicine",
      year: 2007,
    },
    { degree: "Certificate in Echocardiography" }, // no level, no year
  ];
  const experience = [
    {
      role: "Senior Resident",
      organization: "SCB",
      startYear: 2007,
      endYear: 2009,
    },
    {
      role: "Consultant",
      organization: "City Heart",
      startYear: 2013,
      current: true,
    },
    {
      role: "Assistant Professor",
      organization: "MKCG",
      startYear: 2009,
      endYear: 2013,
    },
    { role: "House Surgeon", organization: "MKCG" }, // undated
  ];
  const fellowships = [
    { title: "Fellowship A", startYear: 2012, endYear: 2013 },
    { title: "Fellowship B", endYear: 2018 },
    { title: "Fellowship C" },
  ];
  const publications = [
    { title: "Paper 2015", year: 2015 },
    { title: "Paper undated" },
    { title: "Paper 2022", year: 2022 },
    { title: "Paper 2015 second", year: 2015 },
  ];
  const achievements = [
    { title: "Award 2010", year: 2010 },
    { title: "Award 2021", year: 2021 },
  ];
  const memberships = [
    { organization: "Past Society", startYear: 2005, endYear: 2010 },
    { organization: "Current Association", startYear: 2011, current: true },
  ];

  test("the portfolio shows the highest and most recent entries first; the stored order is untouched", async () => {
    const viewer = await registerDoctor(ctx.app);
    const doctor = await registerDoctor(ctx.app);
    const saved = await save(doctor, {
      profile: {
        education,
        experience,
        fellowships,
        publications,
        achievements,
        memberships,
      },
    });
    expect(saved.status).toBe(200);

    // The owner's form data keeps the order of entry…
    expect(saved.body.data.profile.education.map((e) => e.degree)).toEqual(
      education.map((e) => e.degree),
    );
    expect(saved.body.data.profile.experience.map((e) => e.role)).toEqual(
      experience.map((e) => e.role),
    );
    const stored = await User.findById(doctor.user.id).lean();
    expect(stored.profile.education.map((e) => e.degree)).toEqual(
      education.map((e) => e.degree),
    );
    expect(stored.profile.publications.map((p) => p.title)).toEqual(
      publications.map((p) => p.title),
    );

    // …while the portfolio is ordered for reading, for the owner and for other members alike.
    for (const client of [viewer, doctor]) {
      const { profile, summary } = (await portfolioOf(client, doctor)).body
        .data;
      expect(profile.education.map((e) => e.degree)).toEqual([
        "DM",
        "MD",
        "Certificate in Echocardiography",
        "MBBS",
        "+2 Science",
        "Class 10",
      ]);
      expect(profile.experience.map((e) => e.role)).toEqual([
        "Consultant",
        "Assistant Professor",
        "Senior Resident",
        "House Surgeon",
      ]);
      expect(profile.experience[0]).toMatchObject({
        current: true,
        startYear: 2013,
        endYear: null,
      }); // dates are not rewritten
      expect(profile.fellowships.map((f) => f.title)).toEqual([
        "Fellowship B",
        "Fellowship A",
        "Fellowship C",
      ]);
      expect(profile.publications.map((p) => p.title)).toEqual([
        "Paper 2022",
        "Paper 2015",
        "Paper 2015 second",
        "Paper undated",
      ]);
      expect(profile.achievements.map((a) => a.title)).toEqual([
        "Award 2021",
        "Award 2010",
      ]);
      expect(profile.memberships.map((m) => m.organization)).toEqual([
        "Current Association",
        "Past Society",
      ]);
      expect(summary.experience.since).toBe(2007);
      expect(summary.experience.years).toBe(new Date().getFullYear() - 2007);
    }

    // A hidden section does not leak through the summary.
    await save(doctor, { visibility: { sections: { experience: false } } });
    const hidden = (await portfolioOf(viewer, doctor)).body.data;
    expect(hidden.profile.experience).toEqual([]);
    expect(hidden.summary.experience).toEqual({ years: null, since: null });
  });

  test("education levels and career length are worked out conservatively", () => {
    const titles = (list) => sortEducation(list).map((e) => e.degree);
    expect(
      titles([
        { degree: "M.B.B.S.", year: 2001 },
        { degree: "M.S. (Ortho)", year: 2006 },
        { degree: "MCh", year: 2010 },
      ]),
    ).toEqual(["MCh", "M.S. (Ortho)", "M.B.B.S."]);
    expect(
      titles([
        { degree: "HSC", year: 1995 },
        { degree: "CHSE (+2)", year: 1997 },
      ]),
    ).toEqual(["CHSE (+2)", "HSC"]);
    // Same level and year: the saved order decides.
    expect(
      titles([
        { degree: "MD", year: 2008 },
        { degree: "DNB", year: 2008 },
      ]),
    ).toEqual(["MD", "DNB"]);
    // An explicit level wins over the title.
    expect(
      titles([
        { degree: "MBBS", year: 2001 },
        { degree: "MD", level: "SECONDARY", year: 2008 },
      ]),
    ).toEqual(["MBBS", "MD"]);

    expect(
      experienceSummary(
        [
          { startYear: 2005, endYear: 2010 },
          { startYear: 2008, endYear: 2012 },
          { startYear: 2015, current: true },
        ],
        2026,
      ),
    ).toEqual({ years: 18, since: 2005 });
    expect(
      experienceSummary([{ role: "Undated" }, { startYear: 2010 }], 2026),
    ).toEqual({ years: null, since: null });
    expect(experienceSummary([], 2026)).toEqual({ years: null, since: null });
  });
});

describe("wizard position after the steps were reorganised", () => {
  test("a position saved by the former 11-step wizard still loads, saves and resumes on the matching step", async () => {
    const doctor = await registerDoctor(ctx.app);
    const setLegacy = (step) =>
      User.collection.updateOne(
        { email: doctor.credentials.email },
        {
          $set: { "profileWizard.step": step },
          $unset: { "profileWizard.layout": "" },
        },
      );

    await setLegacy(10); // the old review step
    expect((await me(doctor)).body.data.profileCompletion.resumeStep).toBe(8);
    // Any later save of the account must still pass schema validation.
    expect(
      (await save(doctor, { profile: { bio: "Still saves." } })).status,
    ).toBe(200);
    expect((await me(doctor)).body.data.profileCompletion.resumeStep).toBe(8);

    await setLegacy(3); // old "education" came after "practice"; it is step 3 (index 2) now
    expect((await me(doctor)).body.data.profileCompletion.resumeStep).toBe(2);
    await setLegacy(6); // old "membership" is part of "awards & memberships"
    expect((await me(doctor)).body.data.profileCompletion.resumeStep).toBe(5);

    // Once the current wizard saves a position it is used as it is.
    const saved = await save(doctor, { wizardStep: 3 });
    expect(saved.body.data.profileCompletion.resumeStep).toBe(3);
    expect((await User.findById(doctor.user.id)).profileWizard.layout).toBe(2);
    expect((await save(doctor, { wizardStep: 9 })).status).toBe(400);
  });
});
