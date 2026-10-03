import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  RINGS,
  isGender,
  isRingId,
  type Gender,
  type RingId,
} from "@/lib/encuesta";

export type Vote = {
  id: string;
  gender: Gender;
  picks: [RingId, RingId, RingId];
  at: string;
};

export type ColorTally = {
  id: RingId;
  title: string;
  src: string;
  points: number;
  first: number;
  picks: number;
};

export type SurveyResults = {
  total: number;
  byGender: Record<Gender, number>;
  colors: ColorTally[];
  mujer: ColorTally[];
  hombre: ColorTally[];
};

const FILE = path.join(process.cwd(), "data", "encuesta.json");
const POINTS = [3, 2, 1] as const;

let queue: Promise<void> = Promise.resolve();

function locked<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function isVote(value: unknown): value is Vote {
  if (!value || typeof value !== "object") return false;
  const vote = value as Vote;
  return (
    typeof vote.id === "string" &&
    isGender(vote.gender) &&
    Array.isArray(vote.picks) &&
    vote.picks.length === 3 &&
    vote.picks.every((id) => typeof id === "string" && isRingId(id)) &&
    new Set(vote.picks).size === 3
  );
}

async function readVotes(): Promise<Vote[]> {
  try {
    const raw = await readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as { votes?: unknown[] };
    if (!Array.isArray(parsed.votes)) return [];
    return parsed.votes.filter(isVote);
  } catch {
    return [];
  }
}

async function writeVotes(votes: Vote[]) {
  await mkdir(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify({ votes }, null, 2));
  await rename(tmp, FILE);
}

export function parseVoteBody(body: unknown): {
  voterId: string;
  gender: Gender;
  picks: [RingId, RingId, RingId];
} | null {
  if (!body || typeof body !== "object") return null;
  const raw = body as { voterId?: unknown; gender?: unknown; picks?: unknown };
  if (typeof raw.gender !== "string" || !isGender(raw.gender)) return null;
  if (!Array.isArray(raw.picks) || raw.picks.length !== 3) return null;
  if (!raw.picks.every((id) => typeof id === "string" && isRingId(id))) return null;
  if (new Set(raw.picks).size !== 3) return null;
  const voterId =
    typeof raw.voterId === "string" && raw.voterId.trim().length > 0
      ? raw.voterId.trim().slice(0, 80)
      : randomUUID();
  return {
    voterId,
    gender: raw.gender,
    picks: raw.picks as [RingId, RingId, RingId],
  };
}

export function saveVote(input: {
  voterId: string;
  gender: Gender;
  picks: [RingId, RingId, RingId];
}) {
  return locked(async () => {
    const votes = await readVotes();
    const next: Vote = {
      id: input.voterId,
      gender: input.gender,
      picks: input.picks,
      at: new Date().toISOString(),
    };
    const index = votes.findIndex((vote) => vote.id === input.voterId);
    if (index >= 0) votes[index] = next;
    else votes.push(next);
    await writeVotes(votes);
    return next;
  });
}

function tally(votes: Vote[]): ColorTally[] {
  const rows = new Map<RingId, ColorTally>(
    RINGS.map((ring) => [
      ring.id,
      {
        id: ring.id,
        title: ring.title,
        src: ring.src,
        points: 0,
        first: 0,
        picks: 0,
      },
    ]),
  );
  for (const vote of votes) {
    vote.picks.forEach((id, index) => {
      const row = rows.get(id);
      if (!row) return;
      row.points += POINTS[index] ?? 0;
      row.picks += 1;
      if (index === 0) row.first += 1;
    });
  }
  return [...rows.values()].sort(
    (a, b) => b.points - a.points || b.first - a.first || a.title.localeCompare(b.title, "es"),
  );
}

export async function surveyResults(): Promise<SurveyResults> {
  const votes = await readVotes();
  return {
    total: votes.length,
    byGender: {
      mujer: votes.filter((vote) => vote.gender === "mujer").length,
      hombre: votes.filter((vote) => vote.gender === "hombre").length,
    },
    colors: tally(votes),
    mujer: tally(votes.filter((vote) => vote.gender === "mujer")),
    hombre: tally(votes.filter((vote) => vote.gender === "hombre")),
  };
}
