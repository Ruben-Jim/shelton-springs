import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";

function normalizeFullName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function residentFullName(resident: Pick<Doc<"residents">, "firstName" | "lastName">): string {
  return normalizeFullName(`${resident.firstName} ${resident.lastName}`);
}

/** Keep residents.isBoardMember in sync with the boardMembers roster (matched by full name). */
async function applyResidentBoardFlagSync(ctx: { db: any }) {
  const boardMembers = await ctx.db.query("boardMembers").collect();
  const boardNameSet = new Set(boardMembers.map((bm: Doc<"boardMembers">) => normalizeFullName(bm.name)));

  const residents = await ctx.db.query("residents").collect();
  const now = Date.now();

  for (const resident of residents) {
    const shouldBeBoardMember = boardNameSet.has(residentFullName(resident));
    if (resident.isBoardMember !== shouldBeBoardMember) {
      await ctx.db.patch(resident._id, {
        isBoardMember: shouldBeBoardMember,
        updatedAt: now,
      });
    }
  }

  // Backfill board member photos from resident profile when board image is unset
  for (const boardMember of boardMembers) {
    if (boardMember.image) continue;
    const resident = residents.find(
      (r: Doc<"residents">) => residentFullName(r) === normalizeFullName(boardMember.name),
    );
    if (resident?.profileImage) {
      await ctx.db.patch(boardMember._id, {
        image: resident.profileImage,
        updatedAt: now,
      });
    }
  }
}

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const boardMembers = await ctx.db
      .query("boardMembers")
      .collect();
    
    // Sort by sortOrder (lower numbers first), with undefined/null values last
    return boardMembers.sort((a, b) => {
      const aOrder = a.sortOrder ?? 999;
      const bOrder = b.sortOrder ?? 999;
      return aOrder - bOrder;
    });
  },
});

export const getById = query({
  args: { id: v.id("boardMembers") },
  handler: async (ctx, args) => {
    const boardMember = await ctx.db.get(args.id);
    return boardMember;
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    position: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    bio: v.optional(v.string()),
    image: v.optional(v.string()),
    termEnd: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    let image = args.image;
    if (!image) {
      const residents = await ctx.db.query("residents").collect();
      const resident = residents.find(
        (r: Doc<"residents">) => residentFullName(r) === normalizeFullName(args.name),
      );
      if (resident?.profileImage) {
        image = resident.profileImage;
      }
    }

    const boardMemberId = await ctx.db.insert("boardMembers", {
      ...args,
      image,
      createdAt: now,
      updatedAt: now,
    });

    await applyResidentBoardFlagSync(ctx);

    return boardMemberId;
  },
});

export const update = mutation({
  args: {
    id: v.id("boardMembers"),
    name: v.optional(v.string()),
    position: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    bio: v.optional(v.string()),
    image: v.optional(v.string()),
    termEnd: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const now = Date.now();
    await ctx.db.patch(id, {
      ...updates,
      updatedAt: now,
    });

    await applyResidentBoardFlagSync(ctx);
  },
});

export const remove = mutation({
  args: { id: v.id("boardMembers") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    await applyResidentBoardFlagSync(ctx);
  },
});

/** One-time or manual repair: align all residents.isBoardMember flags with the current board roster. */
export const syncResidentBoardFlags = mutation({
  args: {},
  handler: async (ctx) => {
    await applyResidentBoardFlagSync(ctx);
    return { success: true };
  },
});

// Maintenance: backfill optional fields on existing documents
export const backfillOptionalFields = mutation({
  args: {},
  handler: async (ctx) => {
    const members = await ctx.db.query("boardMembers").collect();
    let updated = 0;
    for (const m of members) {
      const needsPatch =
        (m.phone === undefined || m.phone === null) ||
        (m.bio === undefined || m.bio === null) ||
        (m.image === undefined || m.image === null) ||
        (m.termEnd === undefined || m.termEnd === null);
      if (needsPatch) {
        await ctx.db.patch(m._id, {
          phone: m.phone ?? "",
          bio: m.bio ?? "",
          image: m.image ?? "",
          termEnd: m.termEnd ?? "",
          updatedAt: Date.now(),
        });
        updated++;
      }
    }
    return { total: members.length, updated };
  },
});
