import { useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Redirect, router, Stack, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { activityKey, activityMeta, applyActivity, autoTitle, titleIsAuto } from "@et/core/activities";
import { DANCE_SESSIONS, DANCE_STYLES } from "@et/core/dance";
import { formatStartTime, repeatDates, START_TIME_RE } from "@et/core/domain";
import { startTimeIn, zoneAbbr, zoneDiffers, zonedTimeToUtc } from "@et/core/start-time";
import { currentInjuries } from "@et/core/injuries";
import { findRoutineByName, sameExercises } from "@et/core/routines";
import type { RepeatInput, WorkoutInput } from "@et/core/schemas";
import { SPORTS, sportMeta } from "@et/core/sports";
import { WORKOUT_TYPES, type Workout } from "@et/core/types";
import { badHeartRate, fromDraft, fromExerciseDrafts, statusForDay, toDraft, toExerciseDrafts, unreadableDurations } from "@et/core/workout-draft";
import { formStatuses, STATUS_LABEL } from "@et/core/workout-types";
import { calendarDays, useCalendar } from "@/api/calendar";
import { ApiError, deviceTimeZone } from "@/api/client";
import { write } from "@/api/outbox";
import { useMe } from "@/api/queries";
import { useSession } from "@/auth/session";
import { DetailsFields } from "@/screens/workout/DetailsFields";
import { Body, Button, ErrorText, Field, Screen } from "@/ui";
import { Chips, DateField, MultiChips, Row, SectionTitle, SmallField, SwitchRow, TimeField } from "@/ui/form";

const num = (s: string) => (s.trim() === "" || isNaN(Number(s)) ? undefined : Number(s));
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Add or edit a workout: /workout?date=…[&id=…][&status=…]. The same choices and rules as the
 * website's form (activity, plan and actual, exercises and routines, weekly repeat, effort and
 * injury), saved with POST /workouts.
 */
/** Statuses where something was done, so the form asks what you did rather than what's planned. */
const didIt = (s: Workout["status"]) => s !== "planned" && s !== "skipped" && s !== "missed";

export default function WorkoutScreen() {
  const params = useLocalSearchParams<{ date: string; id?: string; status?: Workout["status"] }>();
  const signedIn = useSession().status === "signedIn";
  const me = useMe(signedIn);
  const profile = me.data?.profile;
  const range = profile && params.date ? calendarDays(params.date, "month", profile.weekStartsOn) : undefined;
  const cal = useCalendar(range?.from, range?.to);
  const workout = params.id ? cal.data?.workouts.find((w) => w.id === params.id) : undefined;
  if (!signedIn) return <Redirect href="/sign-in" />;
  const ready = profile && cal.data && me.data && (!params.id || workout);
  return (
    <>
      <Stack.Screen options={{ title: params.id ? "Edit workout" : "Add workout" }} />
      {ready ? (
        <WorkoutForm
          key={workout?.id ?? "new"}
          date={params.date}
          today={me.data!.today}
          workout={workout}
          presetStatus={params.status}
          profile={profile!}
          data={cal.data!}
        />
      ) : (
        <Screen header>
          <ErrorText>{(me.error ?? cal.error)?.message}</ErrorText>
          {!me.error && !cal.error && <Body muted>Loading…</Body>}
        </Screen>
      )}
    </>
  );
}

function WorkoutForm({
  date,
  today,
  workout,
  presetStatus,
  profile,
  data,
}: {
  date: string;
  today: string;
  workout?: Workout;
  presetStatus?: Workout["status"];
  profile: NonNullable<ReturnType<typeof useMe>["data"]>["profile"];
  data: NonNullable<ReturnType<typeof useCalendar>["data"]>;
}) {
  const qc = useQueryClient();
  const units = profile.units;
  const { routines, injuries, recent } = data;
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [type, setType] = useState<Workout["type"]>(workout?.type ?? "run");
  const [sport, setSport] = useState(workout?.sport ?? "");
  const [sportName, setSportName] = useState(workout?.sportName ?? "");
  const [sportSession, setSportSession] = useState(workout?.sportSession ?? "");
  const [danceStyle, setDanceStyle] = useState(workout?.danceStyle ?? "");
  const [danceStyleName, setDanceStyleName] = useState(workout?.danceStyleName ?? "");
  const [danceSession, setDanceSession] = useState(workout?.danceSession ?? "");
  // A generated title ("10 km Run") stays a placeholder, so it keeps following the details.
  const [title, setTitle] = useState(workout && !titleIsAuto(workout, profile.units) ? workout.title : "");
  const [location, setLocation] = useState(workout?.location ?? "");
  const [startTime, setStartTime] = useState(workout?.startTime ?? "");
  // The zone the start time was entered in; typing a new time means it's in the phone's zone.
  const [startZone, setStartZone] = useState(workout?.startZone);
  const [day, setDay] = useState(workout?.date ?? date);
  const [status, setStatus] = useState<Workout["status"]>(presetStatus ?? workout?.status ?? statusForDay(date, today));
  const [initialStatus] = useState(status);
  const [statusChosen, setStatusChosen] = useState(!!workout || !!presetStatus);
  const [planned, setPlanned] = useState(() => toDraft(workout?.planned, units));
  // Logging a planned workout as done starts "What you did" from the plan.
  const [actual, setActual] = useState(() => toDraft(workout?.actual ?? (didIt(status) ? workout?.planned : undefined), units));
  const [reason, setReason] = useState(workout?.reason ?? "");
  const [rpe, setRpe] = useState(workout?.rpe != null ? String(workout.rpe) : "");
  const [pain, setPain] = useState(workout?.painLevel != null ? String(workout.painLevel) : "");
  const [injuryId, setInjuryId] = useState(workout?.injuryId ?? "");
  const [injuryOpen, setInjuryOpen] = useState(false);
  const [notes, setNotes] = useState(workout?.notes ?? "");
  const [repeating, setRepeating] = useState(false);
  const [repeat, setRepeat] = useState<RepeatInput>({ weekdays: [parseISO(date).getDay()], every: 1, weeks: 12 });
  const [weeksText, setWeeksText] = useState("12");
  const [routineSel, setRoutineSel] = useState(workout?.routineId ?? "");
  const [saveRoutine, setSaveRoutine] = useState(false);
  const [routineName, setRoutineName] = useState("");

  const showActual = didIt(status);
  const showReason = status !== "planned" && status !== "completed";
  const canRepeat = !workout && status === "planned";
  const primary = fromExerciseDrafts((showActual ? actual : planned).exercises, units);
  const selected = routines.find((r) => r.id === routineSel);
  const linkedRoutine = type === "strength" && selected && sameExercises(primary, selected.exercises) ? selected : undefined;
  const canSaveRoutine = type === "strength" && !linkedRoutine && primary.length > 0;
  const current = currentInjuries(injuries, day);
  const showInjury = injuryOpen || current.length > 0 || pain.trim() !== "" || injuryId !== "";
  const sportDef = type === "sport" ? sportMeta(sport) : undefined;

  const autoName = autoTitle(
    {
      type,
      sport,
      sportName,
      sportSession,
      danceStyle,
      danceStyleName,
      danceSession,
      status,
      planned: fromDraft(planned, units),
      actual: showActual ? fromDraft(actual, units) : undefined,
      routineName: linkedRoutine?.name ?? (canSaveRoutine && saveRoutine ? routineName.trim() || undefined : undefined),
    },
    units,
  );

  // Recent activities first, then every type (a recent sport counts as its own choice).
  const activityOptions = useMemo(() => {
    const keys = [...recent, ...WORKOUT_TYPES.filter((k) => !recent.includes(k))];
    return keys.map((k) => ({ value: k, label: `${activityMeta(k).emoji} ${activityMeta(k).label}` }));
  }, [recent]);
  const currentKey = activityKey({ type, sport });
  const activityValue = recent.includes(currentKey) ? currentKey : type;

  const repeatPreview = canRepeat && repeating && repeat.weekdays.length ? repeatDates(day, repeat.weekdays, repeat.every, repeat.weeks, profile.weekStartsOn) : [];

  /** Back to where the form was opened from (the day sheet), or the calendar when opened by a link. */
  const close = () => (router.canGoBack() ? router.back() : router.replace("/"));

  function pickRoutine(id: string) {
    setRoutineSel(id);
    const r = routines.find((x) => x.id === id);
    if (!r) return;
    // Into the fields on show: the plan while planned, what you did once done.
    (showActual ? setActual : setPlanned)((d) => ({ ...d, exercises: toExerciseDrafts(r.exercises, units) }));
    setSaveRoutine(false);
  }

  /** A new status; moving to a done one fills "What you did" from the plan if it's still empty. */
  function chooseStatus(s: Workout["status"]) {
    if (didIt(s) && !didIt(status) && !fromDraft(actual, units)) setActual(planned);
    setStatus(s);
  }

  function changeDay(next: string) {
    setDay(next);
    if (!statusChosen) chooseStatus(statusForDay(next, today));
  }

  async function save() {
    setError(null);
    if (startTime && !START_TIME_RE.test(startTime)) return setError("Start time should look like 07:30 (24-hour).");
    if (showActual && badHeartRate(actual)) return setError("Heart rate should be between 30 and 250 bpm.");
    if (type === "sport" && sport === "other" && !sportName.trim()) return setError("Name the sport (or pick one from the list).");
    const savingRoutine = canSaveRoutine && saveRoutine;
    if (savingRoutine && !routineName.trim()) return setError("Give the routine a name to save it.");
    const taken = savingRoutine ? findRoutineByName(routines, routineName) : undefined;
    if (taken) return setError(`You already have "${taken.name}". Pick another name.`);
    if (canRepeat && repeating && !repeat.weekdays.length) return setError("Pick at least one day to repeat on.");
    const bad = [...unreadableDurations(planned), ...(showActual ? unreadableDurations(actual) : [])];
    if (bad.length) return setError(`Can't read ${[...new Set(bad)].join(", ").toLowerCase()}. Use minutes (45) or a time (87:45).`);

    const input: WorkoutInput = {
      id: workout?.id,
      originalDate: workout?.date,
      date: day,
      startTime: startTime || undefined,
      // A time keeps the zone it was entered in; a new one is in the phone's zone.
      startZone: startTime ? (startZone ?? deviceTimeZone()) : undefined,
      type,
      title: title.trim() || autoName,
      autoTitle: !title.trim(),
      location: location.trim() || undefined,
      ...(type === "sport" ? { sport: sport || undefined, sportName: sport === "other" ? sportName.trim() || undefined : undefined, sportSession: sportSession || undefined } : {}),
      ...(type === "dance"
        ? { danceStyle: danceStyle || undefined, danceStyleName: danceStyle === "other" ? danceStyleName.trim() || undefined : undefined, danceSession: danceSession || undefined }
        : {}),
      ...(linkedRoutine ? { routineId: linkedRoutine.id, routineName: linkedRoutine.name } : {}),
      status,
      planned: fromDraft(planned, units),
      actual: showActual ? fromDraft(actual, units) : undefined,
      reason: showReason ? reason.trim() || undefined : undefined,
      painLevel: num(pain),
      injuryId: injuryId || undefined,
      rpe: num(rpe),
      notes: notes.trim() || undefined,
    };
    setBusy(true);
    try {
      await write("/workouts", {
        body: { workout: input, repeat: canRepeat && repeating ? repeat : undefined, saveAsRoutine: savingRoutine ? { name: routineName.trim() } : undefined },
      });
      await Promise.all(["calendar", "me", "race-distances", "sports"].map((k) => qc.invalidateQueries({ queryKey: [k] })));
      close();
    } catch (e) {
      setError((e as ApiError).message);
      setBusy(false);
    }
  }

  return (
    <Screen header>
      <Chips label="Activity" options={activityOptions} value={activityValue} onChange={(k) => {
        if (!k) return;
        const next = applyActivity(k);
        setType(next.type);
        if (next.sport && next.sport !== sport) {
          setSport(next.sport);
          setSportSession("");
        }
      }} />
      {type === "sport" && (
        <>
          <Chips label="Which sport" options={SPORTS.map((s) => ({ value: s.key, label: `${s.emoji} ${s.label}` }))} value={sport} onChange={(v) => { setSport(v); setSportSession(""); }} />
          {sport === "other" && <Field label="Sport name" value={sportName} onChangeText={setSportName} placeholder="Squash, padel…" />}
          {sportDef && <Chips label="Session" clearable options={sportDef.sessions.map((s) => ({ value: s.key, label: s.label }))} value={sportSession} onChange={setSportSession} />}
        </>
      )}
      {type === "dance" && (
        <>
          <Chips label="Style (optional)" clearable options={DANCE_STYLES.map((s) => ({ value: s.key, label: s.label }))} value={danceStyle} onChange={setDanceStyle} />
          {danceStyle === "other" && <Field label="Style name" value={danceStyleName} onChangeText={setDanceStyleName} placeholder="Reggaeton, voguing…" />}
          <Chips label="Session" clearable options={DANCE_SESSIONS.map((s) => ({ value: s.key, label: s.label }))} value={danceSession} onChange={setDanceSession} />
        </>
      )}

      <Field label="Title" value={title} onChangeText={setTitle} placeholder={autoName} />
      <Field label="Location" value={location} onChangeText={setLocation} placeholder={type === "swim" ? "YMCA pool, open water…" : "Park, gym, treadmill…"} />

      <DateField label="Date" value={day} onChange={changeDay} />
      <TimeField
        label="Start time (optional)"
        value={startTime}
        clock={profile.clock}
        onChange={(v) => {
          setStartTime(v);
          setStartZone(deviceTimeZone());
        }}
      />
      <StartZoneHint
        timed={{ date: day, startTime, startZone }}
        clock={profile.clock}
        onSwitch={(time) => {
          setStartTime(time);
          setStartZone(deviceTimeZone());
        }}
      />

      <Chips
        label="Status"
        options={formStatuses(initialStatus).map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
        value={status}
        onChange={(s) => {
          if (!s) return;
          chooseStatus(s);
          setStatusChosen(true);
        }}
      />

      {canRepeat && (
        <>
          <SwitchRow label="Repeat weekly" value={repeating} onChange={(on) => {
            setRepeating(on);
            if (on && repeat.weekdays.length <= 1) setRepeat({ ...repeat, weekdays: [parseISO(day).getDay()] });
          }} />
          {repeating && (
            <View>
              <MultiChips
                options={Array.from({ length: 7 }, (_, i) => (i + profile.weekStartsOn) % 7).map((d) => ({ value: d, label: WEEKDAYS[d] }))}
                value={repeat.weekdays}
                onChange={(weekdays) => setRepeat({ ...repeat, weekdays })}
              />
              <Chips label="How often" options={[1, 2, 3, 4].map((n) => ({ value: n, label: n === 1 ? "Every week" : `Every ${n} weeks` }))} value={repeat.every} onChange={(n) => n && setRepeat({ ...repeat, every: n })} />
              <SmallField
                label="For how many weeks"
                value={weeksText}
                keyboardType="number-pad"
                onChangeText={(v) => {
                  const tx = v.replace(/\D/g, "").slice(0, 2);
                  setWeeksText(tx);
                  if (Number(tx) >= 1) setRepeat({ ...repeat, weeks: Math.min(52, Number(tx)) });
                }}
              />
              <Body muted style={{ marginBottom: 10 }}>
                {!repeat.weekdays.length
                  ? "Pick at least one day."
                  : !repeatPreview.length
                    ? "None of those days fall in that range."
                    : `Adds ${repeatPreview.length} workout${repeatPreview.length === 1 ? "" : "s"} · ${format(parseISO(repeatPreview[0]), "EEE MMM d")}${repeatPreview.length > 1 ? ` – ${format(parseISO(repeatPreview.at(-1)!), "EEE MMM d")}` : ""}`}
              </Body>
            </View>
          )}
        </>
      )}

      {type === "strength" && (routines.length > 0 || canSaveRoutine) && (
        <View>
          {routines.length > 0 && (
            <Chips label="Routine" clearable options={routines.map((r) => ({ value: r.id, label: r.name }))} value={linkedRoutine?.id ?? ""} onChange={(id) => (id ? pickRoutine(id) : setRoutineSel(""))} />
          )}
          {canSaveRoutine && (
            <>
              <SwitchRow label="Save as a routine" value={saveRoutine} onChange={setSaveRoutine} />
              {saveRoutine && <Field label="Routine name" value={routineName} onChangeText={setRoutineName} placeholder="Push day" maxLength={60} />}
            </>
          )}
        </View>
      )}

      {/* One set of fields at a time: the plan while it's planned, what you did once it's done (the plan is kept). */}
      {showActual ? (
        <>
          <SectionTitle right={fromDraft(planned, units) ? <Button title="Same as plan" variant="link" onPress={() => setActual(planned)} /> : undefined}>
            What you did
          </SectionTitle>
          <DetailsFields value={actual} onChange={setActual} units={units} type={type} showHeartRate />
        </>
      ) : (
        <>
          <SectionTitle>Plan</SectionTitle>
          <DetailsFields value={planned} onChange={setPlanned} units={units} type={type} />
        </>
      )}

      {showReason && (
        <Field label={status === "substituted" ? "What you did instead / why" : "Why?"} value={reason} onChangeText={setReason} placeholder="Wedding, ankle pain, travel…" />
      )}

      <Row>
        <SmallField label="Effort (1–10)" value={rpe} onChangeText={setRpe} keyboardType="number-pad" />
        {showInjury ? <SmallField label="Pain (0–10)" value={pain} onChangeText={setPain} keyboardType="number-pad" /> : <View style={{ flex: 1 }} />}
      </Row>
      {showInjury ? (
        injuries.some((i) => i.status !== "healed" || i.id === injuryId) && (
          <Chips
            label="Injury"
            clearable
            options={injuries.filter((i) => i.status !== "healed" || i.id === injuryId).map((i) => ({ value: i.id, label: i.name }))}
            value={injuryId}
            onChange={setInjuryId}
          />
        )
      ) : (
        <Button title="Something hurt?" variant="link" onPress={() => setInjuryOpen(true)} />
      )}

      <Field label="Notes" value={notes} onChangeText={setNotes} multiline style={{ minHeight: 70, textAlignVertical: "top", paddingTop: 10 }} placeholder="Felt great, heart rate was high…" />

      <ErrorText>{error}</ErrorText>
      <Button title={workout ? "Save changes" : canRepeat && repeating ? "Add workouts" : "Add workout"} onPress={() => void save()} loading={busy} />
      <Button title="Cancel" variant="link" onPress={close} />
    </Screen>
  );
}

/**
 * Under the start time when it was entered in another zone: says which zone it's in, and offers
 * the same moment where the phone is now. As on the website.
 */
function StartZoneHint({
  timed,
  clock,
  onSwitch,
}: {
  timed: Pick<Workout, "date" | "startTime" | "startZone">;
  clock?: "12h" | "24h";
  onSwitch: (time: string) => void;
}) {
  const zone = deviceTimeZone();
  if (!START_TIME_RE.test(timed.startTime ?? "") || !zoneDiffers(timed, zone)) return null;
  const at = zonedTimeToUtc(timed.date, timed.startTime, timed.startZone);
  const here = startTimeIn(timed, zone);
  return (
    <View style={{ marginTop: -6, marginBottom: 12 }}>
      <Body muted style={{ fontSize: 13 }}>This start time is in {zoneAbbr(timed.startZone, at)}.</Body>
      {here ? <Button title={`Change to ${formatStartTime(here, clock)} ${zoneAbbr(zone, at)}`} variant="link" onPress={() => onSwitch(here)} /> : null}
    </View>
  );
}
