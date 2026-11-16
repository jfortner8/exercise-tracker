import "server-only";
import {
  BatchWriteCommand,
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  type QueryCommandInput,
} from "@aws-sdk/lib-dynamodb";
import { env } from "@/lib/env";
import type { BenchmarkDef, BenchmarkResult, DayLog, Injury, Profile, Workout } from "@/lib/types";
import { db } from "./client";

/*
 * Single-table layout, everything partitioned by user:
 *   PK = USER#<sub>
 *   SK = PROFILE | DAY#<date> | WO#<date>#<id> | INJ#<id> | BM#<id> | BMR#<bmId>#<date>#<id>
 */
const pk = (sub: string) => `USER#${sub}`;
const T = () => env.tableName;
const strip = <X>(item: Record<string, unknown>): X => {
  const { PK: _pk, SK: _sk, entity: _e, ...rest } = item;
  void _pk;
  void _sk;
  void _e;
  return rest as X;
};

async function queryAll<X>(input: Omit<QueryCommandInput, "TableName">): Promise<X[]> {
  const out: X[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const res = await db().send(new QueryCommand({ TableName: T(), ...input, ExclusiveStartKey }));
    for (const it of res.Items ?? []) out.push(strip<X>(it));
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return out;
}

const between = (sub: string, prefix: string, start: string, end: string) =>
  queryAll({
    KeyConditionExpression: "PK = :pk AND SK BETWEEN :a AND :b",
    ExpressionAttributeValues: { ":pk": pk(sub), ":a": `${prefix}${start}`, ":b": `${prefix}${end}~` },
  });

const beginsWith = <X>(sub: string, prefix: string, extra?: Partial<QueryCommandInput>) =>
  queryAll<X>({
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :p)",
    ...extra,
    ExpressionAttributeValues: { ":pk": pk(sub), ":p": prefix, ...extra?.ExpressionAttributeValues },
  });

const put = (sub: string, SK: string, entity: string, data: object) =>
  db().send(new PutCommand({ TableName: T(), Item: { PK: pk(sub), SK, entity, ...data } }));

const del = (sub: string, SK: string) => db().send(new DeleteCommand({ TableName: T(), Key: { PK: pk(sub), SK } }));

async function batchDelete(sub: string, sks: string[]) {
  for (let i = 0; i < sks.length; i += 25) {
    await db().send(
      new BatchWriteCommand({
        RequestItems: {
          [T()]: sks.slice(i, i + 25).map((SK) => ({ DeleteRequest: { Key: { PK: pk(sub), SK } } })),
        },
      }),
    );
  }
}

// ---------- Profile ----------
export const defaultProfile = (email: string, name?: string): Profile => ({
  displayName: name ?? email.split("@")[0],
  email,
  units: "imperial",
  weekStartsOn: 1,
  trackDrinks: false,
});

export async function ensureProfile(sub: string, email: string, name?: string) {
  try {
    await db().send(
      new PutCommand({
        TableName: T(),
        Item: { PK: pk(sub), SK: "PROFILE", entity: "profile", ...defaultProfile(email, name) },
        ConditionExpression: "attribute_not_exists(PK)",
      }),
    );
  } catch (e) {
    if ((e as Error).name !== "ConditionalCheckFailedException") throw e;
  }
}

export async function getProfile(sub: string): Promise<Profile | null> {
  const res = await db().send(new GetCommand({ TableName: T(), Key: { PK: pk(sub), SK: "PROFILE" } }));
  return res.Item ? strip<Profile>(res.Item) : null;
}

export const saveProfile = (sub: string, p: Profile) => put(sub, "PROFILE", "profile", p);

// ---------- Workouts ----------
const woSK = (date: string, id: string) => `WO#${date}#${id}`;

export const listWorkouts = (sub: string, start: string, end: string) =>
  between(sub, "WO#", start, end) as Promise<Workout[]>;

export async function getWorkout(sub: string, date: string, id: string) {
  const res = await db().send(new GetCommand({ TableName: T(), Key: { PK: pk(sub), SK: woSK(date, id) } }));
  return res.Item ? strip<Workout>(res.Item) : null;
}

export const saveWorkout = (sub: string, w: Workout) => put(sub, woSK(w.date, w.id), "workout", w);

export const deleteWorkout = (sub: string, date: string, id: string) => del(sub, woSK(date, id));

/** Date is part of the key, so moving = delete + put in one transaction. */
export async function moveWorkout(sub: string, w: Workout, toDate: string) {
  const moved: Workout = {
    ...w,
    date: toDate,
    originalDate: w.originalDate ?? w.date,
    updatedAt: new Date().toISOString(),
  };
  if (moved.originalDate === toDate) delete moved.originalDate;
  await db().send(
    new TransactWriteCommand({
      TransactItems: [
        { Delete: { TableName: T(), Key: { PK: pk(sub), SK: woSK(w.date, w.id) } } },
        { Put: { TableName: T(), Item: { PK: pk(sub), SK: woSK(toDate, w.id), entity: "workout", ...moved } } },
      ],
    }),
  );
  return moved;
}

export async function saveWorkouts(sub: string, ws: Workout[]) {
  for (let i = 0; i < ws.length; i += 25) {
    await db().send(
      new BatchWriteCommand({
        RequestItems: {
          [T()]: ws.slice(i, i + 25).map((w) => ({
            PutRequest: { Item: { PK: pk(sub), SK: woSK(w.date, w.id), entity: "workout", ...w } },
          })),
        },
      }),
    );
  }
}

export const listWorkoutsForInjury = (sub: string, injuryId: string) =>
  beginsWith<Workout>(sub, "WO#", {
    FilterExpression: "injuryId = :i",
    ExpressionAttributeValues: { ":i": injuryId },
  });

// ---------- Day logs ----------
export const listDays = (sub: string, start: string, end: string) =>
  between(sub, "DAY#", start, end) as Promise<DayLog[]>;

export async function saveDay(sub: string, d: DayLog) {
  const empty = !d.notes?.trim() && !d.drinks;
  if (empty) return del(sub, `DAY#${d.date}`);
  return put(sub, `DAY#${d.date}`, "day", d);
}

// ---------- Injuries ----------
export const listInjuries = (sub: string) => beginsWith<Injury>(sub, "INJ#");
export const saveInjury = (sub: string, i: Injury) => put(sub, `INJ#${i.id}`, "injury", i);
export const deleteInjury = (sub: string, id: string) => del(sub, `INJ#${id}`);

// ---------- Benchmarks ----------
export const listBenchmarks = (sub: string) => beginsWith<BenchmarkDef>(sub, "BM#");
export async function getBenchmark(sub: string, id: string) {
  const res = await db().send(new GetCommand({ TableName: T(), Key: { PK: pk(sub), SK: `BM#${id}` } }));
  return res.Item ? strip<BenchmarkDef>(res.Item) : null;
}
export const saveBenchmark = (sub: string, b: BenchmarkDef) => put(sub, `BM#${b.id}`, "benchmark", b);

const bmrSK = (r: Pick<BenchmarkResult, "benchmarkId" | "date" | "id">) => `BMR#${r.benchmarkId}#${r.date}#${r.id}`;
export const listAllResults = (sub: string) => beginsWith<BenchmarkResult>(sub, "BMR#");
export const listResults = (sub: string, benchmarkId: string) =>
  beginsWith<BenchmarkResult>(sub, `BMR#${benchmarkId}#`);
export const saveResult = (sub: string, r: BenchmarkResult) => put(sub, bmrSK(r), "result", r);
export const deleteResult = (sub: string, r: Pick<BenchmarkResult, "benchmarkId" | "date" | "id">) =>
  del(sub, bmrSK(r));

export async function deleteBenchmark(sub: string, id: string) {
  const results = await listResults(sub, id);
  await batchDelete(sub, [`BM#${id}`, ...results.map(bmrSK)]);
}
