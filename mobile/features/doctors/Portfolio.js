import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  Avatar,
  Banner,
  Button,
  Card,
  Chip,
  ErrorState,
  LoadingState,
  Text,
} from "@/components/ui";
import { useToast } from "@/contexts/ToastContext";
import { BlogRow } from "@/features/blogs/BlogCard";
import { blogsApi } from "@/features/blogs/api";
import { useChat } from "@/features/chat/ChatContext";
import { chatApi } from "@/features/chat/api";
import { MemoryTile } from "@/features/memories/MemoryCard";
import { memoriesApi } from "@/features/memories/api";
import { useResource } from "@/hooks/useResource";
import { messageOf } from "@/services/api";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, shadow, space } from "@/theme/tokens";
import { CREDENTIAL_TYPES, EMPLOYMENT_TYPES } from "@/utils/constants";
import { formatDate, joinParts, labelOf, yearRange } from "@/utils/format";
import { formatPhone, openLink, openWhatsApp } from "@/utils/phone";
import { doctorsApi } from "./api";

// A doctor's professional portfolio, written for colleagues and batchmates:
// who they are, how they trained, where they have worked and what they share
// with the community. It is not a patient-facing page — there is no booking,
// no fees and no ratings.
//
// Everything shown comes from GET /doctors/:id, which already applies the
// doctor's visibility choices: hidden sections arrive empty and are not
// rendered, and `contact` holds only what the doctor decided to share.

const UNDERGRADUATE = /^(mbbs|bds|bams|bhms|bums|bachelorofmedicine)/;
const isMedicalDegree = (entry) =>
  entry.level === "UNDERGRADUATE" ||
  UNDERGRADUATE.test(
    String(entry.degree || "")
      .toLowerCase()
      .replace(/[^a-z]/g, ""),
  );

function Section({ icon, title, children, delay = 0 }) {
  const { colors } = useTheme();
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(360)}>
      <Card style={styles.section}>
        <View style={styles.sectionHead}>
          <View
            style={[styles.sectionIcon, { backgroundColor: colors.brandSoft }]}
          >
            <Ionicons name={icon} size={17} color={colors.brandInk} />
          </View>
          <Text variant="h3" style={styles.flex} accessibilityRole="header">
            {title}
          </Text>
        </View>
        {children}
      </Card>
    </Animated.View>
  );
}

// One dated entry (education, experience, fellowship…) on a vertical line.
function Entry({ title, subtitle, period, note, badge, last }) {
  const { colors } = useTheme();
  return (
    <View style={styles.entry}>
      <View style={styles.rail}>
        <View
          style={[
            styles.dot,
            { backgroundColor: badge ? colors.leaf : colors.brand },
          ]}
        />
        {!last ? (
          <View style={[styles.line, { backgroundColor: colors.line }]} />
        ) : null}
      </View>
      <View style={[styles.flex, !last && styles.entryGap]}>
        <View style={styles.entryHead}>
          <Text variant="bodyStrong" style={styles.flex}>
            {title}
          </Text>
          {badge ? (
            <View style={[styles.badge, { backgroundColor: colors.leafSoft }]}>
              <Text variant="caption" color={colors.leafStrong}>
                {badge}
              </Text>
            </View>
          ) : null}
        </View>
        {subtitle ? (
          <Text variant="small" tone="soft">
            {subtitle}
          </Text>
        ) : null}
        {period ? (
          <Text variant="caption" tone="muted">
            {period}
          </Text>
        ) : null}
        {note ? (
          <Text variant="small" tone="muted" style={styles.note}>
            {note}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function Tags({ label, items, tone }) {
  if (!items || !items.length) return null;
  return (
    <View style={styles.tagBlock}>
      {label ? (
        <Text variant="caption" tone="muted">
          {label}
        </Text>
      ) : null}
      <View style={styles.tags}>
        {items.map((item) => (
          <Chip key={item} label={item} small selected tone={tone} />
        ))}
      </View>
    </View>
  );
}

function Fact({ icon, children, onPress }) {
  const { colors } = useTheme();
  return (
    <View style={styles.fact}>
      <Ionicons
        name={icon}
        size={16}
        color={colors.muted}
        style={styles.factIcon}
      />
      <Text
        variant="small"
        tone={onPress ? "brand" : "soft"}
        style={styles.flex}
        onPress={onPress}
        accessibilityRole={onPress ? "link" : undefined}
      >
        {children}
      </Text>
    </View>
  );
}

export function Portfolio({ doctorId, own = false, ownActions = null }) {
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { upsertConversation } = useChat();
  const [opening, setOpening] = useState(false);

  const profileRes = useResource(() => doctorsApi.get(doctorId), [doctorId], {
    topics: own ? ["profile"] : [],
  });
  const doctor = profileRes.data;
  const full = Boolean(doctor && !doctor.limited);
  // This doctor's community blogs, and the photos in their own profile Gallery
  // (a separate list from the community Memories).
  const blogs = useResource(
    () => blogsApi.list({ author: doctorId, limit: 5 }),
    [doctorId],
    { topics: ["blogs"], enabled: full },
  );
  const gallery = useResource(
    () => memoriesApi.list({ owner: doctorId, limit: 6 }),
    [doctorId],
    { topics: ["memories"], enabled: full },
  );

  if (profileRes.status === "loading")
    return <LoadingState label="Loading profile…" />;
  if (profileRes.status === "error")
    return <ErrorState error={profileRes.error} onRetry={profileRes.reload} />;

  const p = doctor.profile;
  const contact = doctor.contact || {};
  const mine = own || doctor.isMine;

  const message = async () => {
    if (opening) return;
    setOpening(true);
    try {
      const { data } = await chatApi.openDirect(doctor.id);
      upsertConversation(data);
      router.push(`/chat/${data.id}`);
    } catch (error) {
      toast.error(messageOf(error));
      if (error.code === "WHATSAPP_REQUIRED")
        router.push("/profile/section/practice");
    } finally {
      setOpening(false);
    }
  };

  const refresh = (
    <RefreshControl
      refreshing={profileRes.refreshing}
      onRefresh={() => {
        profileRes.refresh();
        if (full) {
          blogs.refresh();
          gallery.refresh();
        }
      }}
      tintColor={colors.brand}
      colors={[colors.brand]}
      progressBackgroundColor={colors.surface}
    />
  );

  const hero = (
    <LinearGradient
      colors={colors.gradientHero}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.hero}
    >
      <View style={[styles.photoFrame, shadow(colors, 3)]}>
        {p.photoUrl ? (
          <Image
            source={{ uri: p.photoUrl }}
            style={styles.photo}
            contentFit="cover"
            transition={250}
            accessibilityLabel={`Photo of ${doctor.name}`}
          />
        ) : (
          <Avatar name={doctor.name} size={112} square />
        )}
      </View>
      <Text
        variant="display"
        color="#ffffff"
        center
        style={styles.heroName}
        accessibilityRole="header"
      >
        {doctor.name}
      </Text>
      {p.professionalTitle ? (
        <Text color="rgba(255,255,255,0.9)" center>
          {p.professionalTitle}
        </Text>
      ) : null}
      {p.specialization ? (
        <View style={styles.heroChip}>
          <Ionicons name="medkit" size={13} color="#6fe3ad" />
          <Text variant="smallStrong" color="#ffffff">
            {joinParts([p.specialization, full ? p.subspecialty : ""])}
          </Text>
        </View>
      ) : null}
    </LinearGradient>
  );

  // A doctor who left the directory, or keeps the portfolio private: name card only.
  if (!full) {
    return (
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={refresh}
      >
        {hero}
        <View style={styles.body}>
          <Banner
            tone="info"
            icon="lock-closed"
            title="Private profile"
            message="This doctor has chosen to keep their full portfolio private."
          />
        </View>
      </ScrollView>
    );
  }

  const college = (p.education || []).find(isMedicalDegree);
  const highest = (p.education || [])[0]; // the API returns education highest first
  const currentRoles = (p.experience || []).filter((e) => e.current);
  const years =
    doctor.summary && doctor.summary.experience
      ? doctor.summary.experience.years
      : null;
  const identity = [
    highest && highest.degree
      ? {
          icon: "school-outline",
          text: joinParts([highest.degree, highest.fieldOfStudy], ", "),
        }
      : null,
    college && college.institution
      ? {
          icon: "business-outline",
          text: joinParts([
            college.institution,
            p.batchYear ? `Batch of ${p.batchYear}` : "",
          ]),
        }
      : p.batchYear
        ? { icon: "people-outline", text: `Batch of ${p.batchYear}` }
        : null,
    joinParts([p.designation, p.hospital], ", ")
      ? {
          icon: "briefcase-outline",
          text: joinParts([p.designation, p.hospital], ", "),
        }
      : null,
    joinParts([p.city, p.state], ", ")
      ? { icon: "location-outline", text: joinParts([p.city, p.state], ", ") }
      : null,
  ].filter(Boolean);

  const hasAbout = Boolean(
    p.bio ||
    p.headline ||
    years ||
    (p.languages && p.languages.length) ||
    p.bloodGroup,
  );
  const hasEducation = Boolean(
    (p.education && p.education.length) ||
    (p.qualifications && p.qualifications.length) ||
    (p.credentials && p.credentials.length),
  );
  const hasExpertise = Boolean(
    p.fieldOfWork ||
    p.practiceArea ||
    (p.expertise && p.expertise.length) ||
    (p.procedures && p.procedures.length),
  );
  const hasAffiliations = Boolean(
    p.hospital || (p.practiceLocations && p.practiceLocations.length),
  );
  const hasContact = Boolean(
    contact.email ||
    contact.phone ||
    contact.whatsapp ||
    contact.workEmail ||
    contact.workPhone,
  );
  const blogItems = blogs.data || [];
  const galleryItems = gallery.data || [];
  let step = 0;
  const next = () => (step += 1) * 50;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={refresh}
    >
      {/* 1 — Professional hero */}
      {hero}

      <View style={styles.body}>
        <Card style={styles.identity}>
          {identity.map((row) => (
            <Fact key={row.text} icon={row.icon}>
              {row.text}
            </Fact>
          ))}
          {!identity.length ? (
            <Text variant="small" tone="muted">
              {mine
                ? "Add your education and current role so batchmates can recognise you."
                : "This doctor has not added professional details yet."}
            </Text>
          ) : null}
          {mine ? (
            ownActions
          ) : (
            <View style={styles.actions}>
              <Button
                title="Message"
                icon="chatbubble-ellipses"
                onPress={message}
                loading={opening}
                style={styles.flex}
                full
              />
              {contact.whatsapp ? (
                <Button
                  title="WhatsApp"
                  icon="logo-whatsapp"
                  variant="secondary"
                  style={styles.flex}
                  full
                  onPress={async () => {
                    if (!(await openWhatsApp(contact.whatsapp)))
                      toast.error(
                        "WhatsApp could not be opened on this phone.",
                      );
                  }}
                />
              ) : null}
            </View>
          )}
        </Card>

        {/* 2 — About and career overview */}
        {hasAbout ? (
          <Section icon="person-outline" title="About" delay={next()}>
            {p.headline ? <Text variant="bodyStrong">{p.headline}</Text> : null}
            {p.bio ? <Text tone="soft">{p.bio}</Text> : null}
            {years ? (
              <Fact icon="time-outline">
                {years === 1
                  ? "1 year in practice"
                  : `${years} years in practice`}
              </Fact>
            ) : null}
            {p.bloodGroup ? (
              <Fact icon="water-outline">Blood group {p.bloodGroup}</Fact>
            ) : null}
            <Tags label="Languages" items={p.languages} />
          </Section>
        ) : null}

        {/* 4 — Professional experience (the API lists current roles first) */}
        {p.experience && p.experience.length ? (
          <Section
            icon="briefcase-outline"
            title="Professional experience"
            delay={next()}
          >
            {p.experience.map((e, i) => (
              <Entry
                key={e.id}
                title={e.role}
                subtitle={joinParts([
                  e.organization,
                  joinParts([e.city, e.state], ", "),
                ])}
                period={joinParts([
                  yearRange(e.startYear, e.endYear, e.current),
                  e.employmentType
                    ? labelOf(EMPLOYMENT_TYPES, e.employmentType)
                    : "",
                ])}
                note={e.description}
                badge={e.current ? "Current" : null}
                last={i === p.experience.length - 1}
              />
            ))}
          </Section>
        ) : null}

        {/* 3 — Education and qualifications */}
        {hasEducation ? (
          <Section
            icon="school-outline"
            title="Education & qualifications"
            delay={next()}
          >
            {(p.education || []).map((e, i) => (
              <Entry
                key={e.id}
                title={joinParts([e.degree, e.fieldOfStudy], ", ")}
                subtitle={e.institution}
                period={yearRange(e.startYear, e.year)}
                note={joinParts([e.certification, e.details])}
                last={
                  i === p.education.length - 1 && !(p.credentials || []).length
                }
              />
            ))}
            {(p.credentials || []).map((c, i) => (
              <Entry
                key={c.id}
                title={c.title}
                subtitle={joinParts([
                  c.type ? labelOf(CREDENTIAL_TYPES, c.type) : "",
                  c.institution,
                ])}
                period={joinParts([
                  c.year ? String(c.year) : "",
                  c.registration ? `Reg. ${c.registration}` : "",
                ])}
                note={c.details}
                last={i === p.credentials.length - 1}
              />
            ))}
            <Tags label="Qualifications" items={p.qualifications} tone="leaf" />
          </Section>
        ) : null}

        {/* 5 — Specialization and expertise */}
        {hasExpertise ? (
          <Section
            icon="medkit-outline"
            title="Specialization & expertise"
            delay={next()}
          >
            {p.fieldOfWork ? (
              <Fact icon="pulse-outline">{p.fieldOfWork}</Fact>
            ) : null}
            {p.practiceArea ? (
              <Fact icon="fitness-outline">{p.practiceArea}</Fact>
            ) : null}
            <Tags label="Areas of expertise" items={p.expertise} />
            <Tags label="Procedures" items={p.procedures} tone="leaf" />
          </Section>
        ) : null}

        {/* 6 — Fellowships and advanced training */}
        {p.fellowships && p.fellowships.length ? (
          <Section
            icon="ribbon-outline"
            title="Fellowships & advanced training"
            delay={next()}
          >
            {p.fellowships.map((f, i) => (
              <Entry
                key={f.id}
                title={f.title}
                subtitle={joinParts([f.institution, f.specialty])}
                period={yearRange(f.startYear, f.endYear)}
                note={joinParts([f.certificate, f.description])}
                last={i === p.fellowships.length - 1}
              />
            ))}
          </Section>
        ) : null}

        {/* 7 — Awards and memberships */}
        {p.achievements && p.achievements.length ? (
          <Section icon="trophy-outline" title="Awards" delay={next()}>
            {p.achievements.map((a, i) => (
              <View key={a.id} style={styles.award}>
                {a.imageThumbUrl ? (
                  <Image
                    source={{ uri: a.imageThumbUrl }}
                    style={styles.awardImage}
                    contentFit="cover"
                    transition={200}
                  />
                ) : null}
                <View style={styles.flex}>
                  <Entry
                    title={a.title}
                    subtitle={a.issuer}
                    period={a.year ? String(a.year) : ""}
                    note={a.description}
                    last={i === p.achievements.length - 1}
                  />
                </View>
              </View>
            ))}
          </Section>
        ) : null}
        {p.memberships && p.memberships.length ? (
          <Section
            icon="people-circle-outline"
            title="Professional memberships"
            delay={next()}
          >
            {p.memberships.map((m, i) => (
              <Entry
                key={m.id}
                title={m.organization}
                subtitle={joinParts([
                  m.type,
                  m.number ? `No. ${m.number}` : "",
                ])}
                period={yearRange(m.startYear, m.endYear, m.current)}
                last={i === p.memberships.length - 1}
              />
            ))}
          </Section>
        ) : null}

        {/* 8 — Research and publications */}
        {p.publications && p.publications.length ? (
          <Section
            icon="document-text-outline"
            title="Research & publications"
            delay={next()}
          >
            {p.publications.map((pub, i) => (
              <View key={pub.id}>
                <Entry
                  title={pub.title}
                  subtitle={joinParts([
                    pub.journal,
                    pub.year ? String(pub.year) : "",
                  ])}
                  period={pub.authors}
                  note={pub.description}
                  last={i === p.publications.length - 1 && !pub.url}
                />
                {pub.url ? (
                  <Text
                    variant="smallStrong"
                    tone="brand"
                    onPress={() => openLink(pub.url)}
                    style={styles.pubLink}
                    accessibilityRole="link"
                  >
                    Open publication ›
                  </Text>
                ) : null}
              </View>
            ))}
          </Section>
        ) : null}

        {/* 9 — Current professional affiliations (kept short on purpose) */}
        {hasAffiliations ? (
          <Section
            icon="business-outline"
            title="Current affiliations"
            delay={next()}
          >
            {p.hospital ? (
              <Fact icon="medical-outline">
                {joinParts([
                  p.hospital,
                  p.designation,
                  joinParts([p.city, p.state], ", "),
                ])}
              </Fact>
            ) : null}
            {currentRoles
              .filter((r) => r.organization && r.organization !== p.hospital)
              .map((r) => (
                <Fact key={r.id} icon="briefcase-outline">
                  {joinParts([r.organization, r.role])}
                </Fact>
              ))}
            {(p.practiceLocations || []).map((l) => (
              <Fact key={l.id} icon="location-outline">
                {joinParts([
                  l.hospital,
                  l.designation,
                  joinParts([l.area, l.city], ", "),
                ])}
              </Fact>
            ))}
          </Section>
        ) : null}

        {/* 10 — Blogs, and the doctor's own gallery (not the community Memories) */}
        {blogItems.length || (mine && blogs.status === "ready") ? (
          <Section icon="book-outline" title="Blogs" delay={next()}>
            {blogItems.map((blog) => (
              <BlogRow key={blog.id} blog={blog} />
            ))}
            {!blogItems.length ? (
              <Text variant="small" tone="muted">
                You have not written a blog yet.
              </Text>
            ) : null}
            {mine ? (
              <Button
                title="Write a blog"
                icon="create-outline"
                variant="secondary"
                size="sm"
                onPress={() => router.push("/create/blog")}
              />
            ) : null}
          </Section>
        ) : null}
        {galleryItems.length || (mine && gallery.status === "ready") ? (
          <Section icon="images-outline" title="Gallery" delay={next()}>
            {galleryItems.length ? (
              <View style={styles.gallery}>
                {galleryItems.map((memory) => (
                  <MemoryTile
                    key={memory.id}
                    memory={memory}
                    height={150}
                    style={styles.galleryCell}
                  />
                ))}
              </View>
            ) : (
              <Text variant="small" tone="muted">
                No photos in your gallery yet.
              </Text>
            )}
            {mine ? (
              <Button
                title="Add photos"
                icon="camera-outline"
                variant="secondary"
                size="sm"
                onPress={() => router.push("/create/memory?gallery=1")}
              />
            ) : null}
          </Section>
        ) : null}

        {/* Contact and links — only what the doctor chose to share with members */}
        {hasContact || (p.links && p.links.length) ? (
          <Section
            icon="at-outline"
            title={mine ? "Contact (as saved)" : "Contact shared with members"}
            delay={next()}
          >
            {contact.workEmail ? (
              <Fact
                icon="mail-outline"
                onPress={() => openLink(`mailto:${contact.workEmail}`)}
              >
                {contact.workEmail}
              </Fact>
            ) : null}
            {contact.workPhone ? (
              <Fact
                icon="call-outline"
                onPress={() => openLink(`tel:${contact.workPhone}`)}
              >{`${formatPhone(contact.workPhone)} (work)`}</Fact>
            ) : null}
            {contact.email ? (
              <Fact
                icon="mail-open-outline"
                onPress={() => openLink(`mailto:${contact.email}`)}
              >
                {contact.email}
              </Fact>
            ) : null}
            {contact.phone ? (
              <Fact
                icon="phone-portrait-outline"
                onPress={() => openLink(`tel:${contact.phone}`)}
              >
                {formatPhone(contact.phone)}
              </Fact>
            ) : null}
            {contact.whatsapp ? (
              <Fact
                icon="logo-whatsapp"
                onPress={() => openWhatsApp(contact.whatsapp)}
              >{`${formatPhone(contact.whatsapp)} (WhatsApp)`}</Fact>
            ) : null}
            {(p.links || []).map((link) => (
              <Fact
                key={link.id}
                icon="link-outline"
                onPress={() => openLink(link.url)}
              >
                {link.label}
              </Fact>
            ))}
            {mine ? (
              <Text variant="caption" tone="muted">
                You always see your own details. Other members see only what you
                switch on in Settings → Contact visibility.
              </Text>
            ) : null}
          </Section>
        ) : null}

        {doctor.memberSince ? (
          <Text variant="caption" tone="muted" center>
            Member since {formatDate(doctor.memberSince)}
          </Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingBottom: space.xxxl },
  hero: {
    alignItems: "center",
    paddingTop: 26,
    paddingBottom: 56,
    paddingHorizontal: space.xl,
    gap: 4,
  },
  photoFrame: {
    borderRadius: 30,
    padding: 3,
    backgroundColor: "rgba(255,255,255,0.9)",
    marginBottom: 12,
  },
  photo: { width: 112, height: 112, borderRadius: 27 },
  heroName: { fontSize: 25, lineHeight: 31 },
  heroChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.14)",
    paddingHorizontal: 12,
    height: 30,
    borderRadius: 15,
    marginTop: 8,
  },
  body: { paddingHorizontal: space.lg, gap: 14, marginTop: -34 },
  identity: { gap: 9 },
  actions: { flexDirection: "row", gap: 10, marginTop: 6 },
  section: { gap: 10 },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 2,
  },
  sectionIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  entry: { flexDirection: "row", gap: 12 },
  rail: { alignItems: "center", width: 10, paddingTop: 7 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  line: { width: 2, flex: 1, marginTop: 4, borderRadius: 1 },
  entryGap: { paddingBottom: 14 },
  entryHead: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9 },
  note: { marginTop: 3 },
  tagBlock: { gap: 6 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  fact: { flexDirection: "row", gap: 9, alignItems: "flex-start" },
  factIcon: { marginTop: 2 },
  award: { flexDirection: "row", gap: 10 },
  awardImage: { width: 54, height: 54, borderRadius: radius.md },
  pubLink: { marginLeft: 22, marginTop: -8, marginBottom: 12 },
  gallery: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  galleryCell: { width: "48.5%" },
});
