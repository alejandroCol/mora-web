import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { DocumentData } from "firebase-admin/firestore";
import { COLLECTIONS } from "@/commerce/paths";
import {
  RINGS,
  isGender,
  isRingId,
  type Gender,
  type RingId,
} from "@/lib/encuesta";
import { adminDb } from "@/lib/firebaseAdmin";

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

function votesCol() {
  return adminDb().collection(COLLECTIONS.encuestaVotes);
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

function voteFromDoc(id: string, data: DocumentData | undefined): Vote | null {
  if (!data) return null;
  return isVote({ id, gender: data.gender, picks: data.picks, at: data.at })
    ? { id, gender: data.gender, picks: data.picks, at: data.at }
    : null;
}

async function readVotesFile(): Promise<Vote[]> {
  try {
    const raw = await readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as { votes?: unknown[] };
    if (!Array.isArray(parsed.votes)) return [];
    return parsed.votes.filter(isVote);
  } catch {
    return [];
  }
}

async function writeVotesFile(votes: Vote[]) {
  await mkdir(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify({ votes }, null, 2));
  await rename(tmp, FILE);
}

async function readVotesFirestore(): Promise<Vote[] | null> {
  try {
    const snap = await votesCol().get();
    return snap.docs
      .map((doc) => voteFromDoc(doc.id, doc.data()))
      .filter((vote): vote is Vote => vote !== null);
  } catch (error) {
    console.error("[encuesta] no se pudo leer Firestore:", error);
    return null;
  }
}

async function readVotes(): Promise<Vote[]> {
  const fromDb = await readVotesFirestore();
  if (fromDb !== null) return fromDb;
  return readVotesFile();
}

async function persistVote(vote: Vote) {
  try {
    await votesCol().doc(vote.id).set({
      gender: vote.gender,
      picks: vote.picks,
      at: vote.at,
    });
    return;
  } catch (error) {
    console.error("[encuesta] no se pudo guardar en Firestore:", error);
  }

  const votes = await readVotesFile();
  const index = votes.findIndex((row) => row.id === vote.id);
  if (index >= 0) votes[index] = vote;
  else votes.push(vote);
  await writeVotesFile(votes);
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
    const next: Vote = {
      id: input.voterId,
      gender: input.gender,
      picks: input.picks,
      at: new Date().toISOString(),
    };
    await persistVote(next);
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
